import json
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import MappingProxyType
from typing import List, TypedDict, Any, Optional

import aiohttp
import redis.asyncio as redis
from fastapi import Depends
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from core.environment import get_environment
from core.services.redis_service import get_redis_client
from core.services.tcgplayer_types import TCGPlayerListing, TCGPlayerSale

logger = logging.getLogger(__name__)


class CardListingRequestData(TypedDict, total=False):
    """Payload for TCGPlayer listing requests."""

    product_id: int  # Required
    printings: Optional[List[str]]  # Optional, defaults to None
    conditions: Optional[List[str]]  # Optional, defaults to None
    languages: Optional[List[str]]  # Optional, defaults to None


class CardSaleRequestData(TypedDict, total=False):
    """Payload for TCGPlayer sales requests."""

    product_id: int  # Required
    printings: Optional[List[int]]  # Optional, defaults to None
    conditions: Optional[List[int]]  # Optional, defaults to None
    languages: Optional[List[int]]  # Optional, defaults to None


class TCGPlayerResponseModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )


class CardSaleResponse(TCGPlayerResponseModel):
    """Individual sale record from TCGPlayer sales API, with parsed orderDate."""

    condition: str
    variant: str
    language: str
    quantity: int
    title: str
    listing_type: str
    custom_listing_id: str
    purchase_price: Decimal
    shipping_price: Decimal
    order_date: datetime


class CardSalesResponse(TCGPlayerResponseModel):
    """Full response from TCGPlayer sales API."""

    previous_page: Optional[str] = None
    next_page: Optional[str] = None
    result_count: int
    total_results: int
    data: List[CardSaleResponse] = Field(default_factory=list)


CACHE_TTL_SECONDS = 60 * 60
CACHE_VERSION = "v1"  # Increment when DTO schemas change to invalidate cache
"""
To invalidate cache when DTOs change:
1. Increment CACHE_VERSION (e.g., "v1" -> "v2")
2. Deploy the change - old cache keys become unreachable
3. Optionally call invalidate_cache_version("v1") to clean up old keys
"""


class TCGPlayerListingService:
    """Service for fetching TCGPlayer listings and sales with Redis caching."""

    # Class constants
    LISTING_PAGINATION_SIZE = 50
    BASE_LISTINGS_URL = "https://mp-search-api.tcgplayer.com/v1/product/%d/listings"
    BASE_SALES_URL = "https://mpapi.tcgplayer.com/v2/product/%d/latestsales"

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

        # Initialize headers with cookie
        self._base_headers = {
            "origin": "https://www.tcgplayer.com",
            "Referer": "https://www.tcgplayer.com",
            "accept": "application/json",
            "content-type": "application/json",
            "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Mobile Safari/537.36",
        }

        env = get_environment()
        cookie = env.get_tcgplayer_cookie()
        if cookie:
            self._base_headers["Cookie"] = cookie

        self.headers = MappingProxyType(self._base_headers)

    def _get_cache_key(self, cache_type: str, product_id: int) -> str:
        """Generate versioned Redis cache key for DTO cache invalidation."""
        return f"{CACHE_VERSION}:tcgplayer:{cache_type}:{product_id}"

    async def _get_from_cache(self, cache_key: str, data_class: type) -> Optional[List]:
        """Get data from Redis cache and deserialize."""
        try:
            cached_data = await self.redis.get(cache_key)
            if cached_data:
                data = json.loads(cached_data)
                return [data_class.model_validate(item) for item in data]
        except Exception as e:
            logger.warning(f"Cache retrieval error for key {cache_key}: {e}")
        return None

    async def _set_cache(self, cache_key: str, data: List) -> None:
        """Serialize and store data in Redis cache."""
        try:
            serializable_data = [item.model_dump(mode="json") for item in data]
            await self.redis.setex(
                cache_key, CACHE_TTL_SECONDS, json.dumps(serializable_data)
            )
        except Exception as e:
            logger.warning(f"Cache storage error for key {cache_key}: {e}")

    async def invalidate_cache_version(self, version: str = None) -> int:
        """
        Invalidate all cache keys for a specific version.

        Args:
            version: Cache version to invalidate (defaults to current version)

        Returns:
            Number of keys deleted
        """
        target_version = version or CACHE_VERSION
        pattern = f"v{target_version}:tcgplayer:*"

        try:
            keys = []
            async for key in self.redis.scan_iter(match=pattern):
                keys.append(key)

            if keys:
                deleted_count = await self.redis.delete(*keys)
                logger.info(
                    f"Invalidated {deleted_count} cache keys for version v{target_version}"
                )
                return deleted_count
            else:
                logger.info(f"No cache keys found for version v{target_version}")
                return 0

        except Exception as e:
            logger.error(f"Cache invalidation error for version v{target_version}: {e}")
            return 0

    def _get_product_active_listings_request_payload(
        self,
        offset: int,
        limit: int,
        printings: Optional[List[str]] = None,
        conditions: Optional[List[str]] = None,
        languages: Optional[List[str]] = None,
    ):
        # Build term filters conditionally
        term = {
            "sellerStatus": "Live",
            "channelId": 0,
            "listingType": "standard",
        }

        if languages:
            term["language"] = languages
        if printings:
            term["printing"] = printings
        if conditions:
            term["condition"] = conditions

        return {
            "filters": {
                "term": term,
                "range": {"quantity": {"gte": 1}},
                "exclude": {"channelExclusion": 0, "listingType": "custom"},
            },
            "from": offset,
            "size": limit,
            "context": {"shippingCountry": "US", "cart": {}},
            "sort": {"field": "price+shipping", "order": "asc"},
        }

    def _get_sales_request_payload(
        self,
        count: int,
        offset: int,
        printings: Optional[List[str]] = None,
        conditions: Optional[List[str]] = None,
        languages: Optional[List[str]] = None,
    ):
        payload = {
            "listingType": "ListingWithoutPhotos",
            "limit": count,
            "offset": offset,
            "time": datetime.now().timestamp() * 1000,
        }

        # Only add filters if non-empty values provided
        if printings:
            payload["variants"] = printings
        if conditions:
            payload["conditions"] = conditions
        if languages:
            payload["languages"] = languages

        return payload

    def _convert_listing_to_dto(self, listing: "ListingSchema") -> TCGPlayerListing:
        """Convert Pydantic ListingSchema to DTO."""
        return TCGPlayerListing(
            price=listing.price,
            shipping_price=listing.shipping_price,
            quantity=listing.quantity,
            listing_id=listing.listing_id,
            product_id=listing.product_id,
            product_condition_id=listing.product_condition_id,
            condition=listing.condition,
            printing=listing.printing,
            language=listing.language,
            language_abbreviation=listing.language_abbreviation,
            language_id=listing.language_id,
            seller_id=listing.seller_id,
            seller_name=listing.seller_name,
            seller_rating=listing.seller_rating,
            seller_sales=listing.seller_sales,
            seller_key=listing.seller_key,
            channel_id=listing.channel_id,
            condition_id=listing.condition_id,
            listing_type=listing.listing_type,
            gold_seller=listing.gold_seller,
            verified_seller=listing.verified_seller,
            direct_seller=listing.direct_seller,
            direct_product=listing.direct_product,
            direct_inventory=listing.direct_inventory,
            ranked_shipping_price=listing.ranked_shipping_price,
            seller_shipping_price=listing.seller_shipping_price,
            forward_freight=listing.forward_freight,
            score=listing.score,
            custom_data=listing.custom_data,
        )

    def _convert_sale_to_dto(self, sale: CardSaleResponse) -> TCGPlayerSale:
        """Convert Pydantic CardSaleResponse to DTO."""
        return TCGPlayerSale(
            purchase_price=sale.purchase_price,
            shipping_price=sale.shipping_price,
            quantity=sale.quantity,
            order_date=sale.order_date,
            condition=sale.condition,
            variant=sale.variant,
            language=sale.language,
            title=sale.title,
            listing_type=sale.listing_type,
            custom_listing_id=sale.custom_listing_id,
        )

    async def get_product_active_listings(
        self,
        request: CardListingRequestData,
    ) -> list[TCGPlayerListing]:
        """Fetch all active listings for a product with Redis caching."""
        product_id = request["product_id"]

        # Only cache requests without filters (most common case)
        has_filters = (
            request.get("printings")
            or request.get("conditions")
            or request.get("languages")
        )

        if not has_filters:
            # Try cache first
            cache_key = self._get_cache_key("listings", product_id)
            cached_listings = await self._get_from_cache(cache_key, TCGPlayerListing)
            if cached_listings:
                logger.debug(f"Cache hit for listings product_id={product_id}")
                return cached_listings

        # Cache miss or filtered request - fetch from API
        logger.debug(
            f"Cache miss for listings product_id={product_id}, fetching from API"
        )
        listings = await self._fetch_product_active_listings_from_api(request)

        # Cache the result if no filters
        if not has_filters and listings:
            cache_key = self._get_cache_key("listings", product_id)
            await self._set_cache(cache_key, listings)

        return listings

    async def _fetch_product_active_listings_from_api(
        self, request: CardListingRequestData
    ) -> list[TCGPlayerListing]:
        """Fetch listings directly from TCGPlayer API."""
        product_id = request["product_id"]
        listings: dict[int, TCGPlayerListing] = {}
        url = self.BASE_LISTINGS_URL % product_id
        cur_offset = 0

        async with aiohttp.ClientSession(headers=self.headers) as session:
            while True:
                payload = self._get_product_active_listings_request_payload(
                    offset=cur_offset,
                    limit=self.LISTING_PAGINATION_SIZE,
                    printings=request.get("printings"),
                    conditions=request.get("conditions"),
                    languages=request.get("languages"),
                )

                async with session.post(url, json=payload) as response:
                    response.raise_for_status()
                    raw = await response.json()
                # Validate and parse raw API response
                parsed = TCGPlayerListingsResponseSchema.model_validate(raw)
                page = parsed.results[0]
                total_listings = page.total_results
                results = page.results

                # Convert each ListingSchema into a DTO
                for listing in results:
                    dto = self._convert_listing_to_dto(listing)
                    listings[listing.listing_id] = dto

                cur_offset += len(results)
                if cur_offset >= total_listings:
                    break

        return list(listings.values())

    async def get_sales(
        self, request: CardSaleRequestData, time_delta: timedelta
    ) -> list[TCGPlayerSale]:
        """Fetch recent sales for a product with Redis caching."""
        product_id = request["product_id"]

        # Only cache requests without filters (most common case)
        has_filters = (
            request.get("printings")
            or request.get("conditions")
            or request.get("languages")
        )

        if not has_filters:
            # Try cache first
            cache_key = self._get_cache_key("sales", product_id)
            cached_sales = await self._get_from_cache(cache_key, TCGPlayerSale)
            if cached_sales:
                logger.debug(f"Cache hit for sales product_id={product_id}")
                return cached_sales

        # Cache miss or filtered request - fetch from API
        logger.debug(f"Cache miss for sales product_id={product_id}, fetching from API")
        sales = await self._fetch_sales_from_api(request, time_delta)

        # Cache the result if no filters
        if not has_filters and sales:
            cache_key = self._get_cache_key("sales", product_id)
            await self._set_cache(cache_key, sales)

        return sales

    async def _fetch_sales_from_api(
        self, request: CardSaleRequestData, time_delta: timedelta
    ) -> list[TCGPlayerSale]:
        """Fetch sales directly from TCGPlayer API."""
        sales: list[TCGPlayerSale] = []
        url = self.BASE_SALES_URL % request["product_id"]

        async with aiohttp.ClientSession(headers=self.headers) as session:
            while True:
                payload = self._get_sales_request_payload(
                    count=25,
                    offset=len(sales),
                    printings=request.get("printings"),
                    conditions=request.get("conditions"),
                    languages=request.get("languages"),
                )

                async with session.post(url, json=payload) as response:
                    response.raise_for_status()
                    raw = await response.json()
                # Parse with Pydantic to convert orderDate to datetime
                parsed = CardSalesResponse.model_validate(raw)

                has_new_sales = True
                for sale in parsed.data:
                    # sale.orderDate is already a datetime
                    if sale.order_date >= datetime.now(timezone.utc) - time_delta:
                        dto = self._convert_sale_to_dto(sale)
                        sales.append(dto)
                    else:
                        has_new_sales = False

                if not parsed.next_page or not has_new_sales:
                    break

        return sales


# Define Pydantic schemas for TCGPlayer listings API response
class AggregationItemSchema(TCGPlayerResponseModel):
    value: Any
    count: int


class AggregationsSchema(TCGPlayerResponseModel):
    condition: List[AggregationItemSchema]
    quantity: List[AggregationItemSchema]
    language: List[AggregationItemSchema]
    printing: List[AggregationItemSchema]


class ListingSchema(TCGPlayerResponseModel):
    direct_product: bool
    gold_seller: bool
    listing_id: int
    channel_id: int
    condition_id: int
    verified_seller: bool
    direct_inventory: int
    ranked_shipping_price: Decimal
    product_id: int
    printing: str
    language_abbreviation: str
    seller_name: str
    forward_freight: bool
    seller_shipping_price: Decimal
    language: str
    shipping_price: Decimal
    condition: str
    language_id: int
    score: float
    direct_seller: bool
    product_condition_id: int
    seller_id: str
    listing_type: str
    seller_rating: float
    seller_sales: str
    quantity: int
    seller_key: str
    price: Decimal
    custom_data: Any


class PageSchema(TCGPlayerResponseModel):
    total_results: int
    result_id: str
    aggregations: AggregationsSchema
    results: List[ListingSchema]


class TCGPlayerListingsResponseSchema(TCGPlayerResponseModel):
    errors: List[str] = Field(default_factory=list)
    results: List[PageSchema] = Field(default_factory=list)


# FastAPI dependency function
def get_tcgplayer_listing_service(
    redis: redis.Redis = Depends(get_redis_client),
) -> TCGPlayerListingService:
    """FastAPI dependency to get TCGPlayer listing service with Redis client."""
    return TCGPlayerListingService(redis)
