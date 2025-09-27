import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, TypedDict

import redis.asyncio as redis
from fastapi import Depends

from core.services.redis_service import get_redis_client
from core.services.schemas.tcgplayer import (
    TCGPlayerSaleSchema,
    TCGPlayerListingSchema,
)
from core.services.tcgplayer_internal_api_client import (
    TCGPlayerInternalAPIClient,
    get_tcgplayer_internal_api_client,
)

logger = logging.getLogger(__name__)


class CardListingRequestData(TypedDict, total=False):
    """Payload for TCGPlayer listing requests."""

    product_id: int  # Product TCGPlayer ID
    printings: Optional[List[str]]  # I.e. "Holofoil"
    conditions: Optional[List[str]]  # I.e. "Near Mint"
    languages: Optional[List[str]]  # I.e. "English"


class CardSaleRequestData(TypedDict, total=False):
    """Payload for TCGPlayer sales requests."""

    product_id: int  # Product TCGPlayer ID
    printings: Optional[List[int]]  # Printing TCGPlayer ID
    conditions: Optional[List[int]]  # Condition TCGPlayer ID
    languages: Optional[List[int]]  # Language TCGPlayer ID


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

    def __init__(
        self,
        redis_client: redis.Redis,
        api_client: TCGPlayerInternalAPIClient,
    ) -> None:
        self.redis = redis_client
        self.api_client = api_client

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
            logger.warning("Cache retrieval error for key %s: %s", cache_key, e)
        return None

    async def _set_cache(self, cache_key: str, data: List) -> None:
        """Serialize and store data in Redis cache."""
        try:
            serializable_data = [item.model_dump(mode="json") for item in data]
            await self.redis.setex(
                cache_key, CACHE_TTL_SECONDS, json.dumps(serializable_data)
            )
        except Exception as e:
            logger.warning("Cache storage error for key %s: %s", cache_key, e)

    async def invalidate_cache_version(self, version: str | None = None) -> int:
        """Invalidate all cache keys for a specific version."""

        target_version = version or CACHE_VERSION
        pattern = f"v{target_version}:tcgplayer:*"

        try:
            keys = []
            async for key in self.redis.scan_iter(match=pattern):
                keys.append(key)

            if keys:
                deleted_count = await self.redis.delete(*keys)
                logger.info(
                    "Invalidated %d cache keys for version v%s",
                    deleted_count,
                    target_version,
                )
                return deleted_count

            logger.info("No cache keys found for version v%s", target_version)
            return 0

        except Exception as e:
            logger.error(
                "Cache invalidation error for version v%s: %s", target_version, e
            )
            return 0

    async def get_product_active_listings(
        self,
        request: CardListingRequestData,
    ) -> list[TCGPlayerListingSchema]:
        """Fetch all active listings for a product with Redis caching."""
        product_id = request["product_id"]

        has_filters = (
            request.get("printings")
            or request.get("conditions")
            or request.get("languages")
        )

        if not has_filters:
            cache_key = self._get_cache_key("listings", product_id)
            cached_listings = await self._get_from_cache(
                cache_key, TCGPlayerListingSchema
            )
            if cached_listings:
                logger.debug("Cache hit for listings product_id=%d", product_id)
                return cached_listings

        logger.debug(
            "Cache miss for listings product_id=%d, fetching from API", product_id
        )
        listings = await self._fetch_product_active_listings_from_api(request)

        if not has_filters and listings:
            cache_key = self._get_cache_key("listings", product_id)
            await self._set_cache(cache_key, listings)

        return listings

    async def _fetch_product_active_listings_from_api(
        self, request: CardListingRequestData
    ) -> list[TCGPlayerListingSchema]:
        """Fetch listings directly from TCGPlayer API."""
        product_id = request["product_id"]
        listings: dict[int, TCGPlayerListingSchema] = {}
        cur_offset = 0

        while True:
            response = await self.api_client.fetch_product_active_listings(
                product_id=product_id,
                offset=cur_offset,
                limit=self.LISTING_PAGINATION_SIZE,
                printings=request.get("printings"),
                conditions=request.get("conditions"),
                languages=request.get("languages"),
            )

            if not response.results:
                break

            page = response.results[0]
            total_listings = page.total_results
            results = page.results

            if not results:
                break

            for listing in results:
                listings[listing.listing_id] = listing

            cur_offset += len(results)
            if cur_offset >= total_listings:
                break

        return list(listings.values())

    async def get_sales(
        self, request: CardSaleRequestData, time_delta: timedelta
    ) -> list[TCGPlayerSaleSchema]:
        """Fetch recent sales for a product with Redis caching."""
        product_id = request["product_id"]

        has_filters = (
            request.get("printings")
            or request.get("conditions")
            or request.get("languages")
        )

        if not has_filters:
            cache_key = self._get_cache_key("sales", product_id)
            cached_sales = await self._get_from_cache(cache_key, TCGPlayerSaleSchema)
            if cached_sales:
                logger.debug("Cache hit for sales product_id=%d", product_id)
                return cached_sales

        logger.debug(
            "Cache miss for sales product_id=%d, fetching from API", product_id
        )
        sales = await self._fetch_sales_from_api(request, time_delta)

        if not has_filters and sales:
            cache_key = self._get_cache_key("sales", product_id)
            await self._set_cache(cache_key, sales)

        return sales

    async def _fetch_sales_from_api(
        self, request: CardSaleRequestData, time_delta: timedelta
    ) -> list[TCGPlayerSaleSchema]:
        """Fetch sales directly from TCGPlayer API."""
        sales: list[TCGPlayerSaleSchema] = []
        product_id = request["product_id"]
        cur_offset = 0
        cutoff = datetime.now(timezone.utc) - time_delta

        while True:
            response = await self.api_client.fetch_sales(
                product_id=product_id,
                count=25,
                offset=cur_offset,
                printings=request.get("printings"),
                conditions=request.get("conditions"),
                languages=request.get("languages"),
            )

            if not response.data:
                break

            has_new_sales = True
            for sale in response.data:
                if sale.order_date >= cutoff:
                    sales.append(sale)
                else:
                    has_new_sales = False

            cur_offset += len(response.data)

            if not response.next_page or not has_new_sales:
                break

        return sales


def get_tcgplayer_listing_service(
    redis: redis.Redis = Depends(get_redis_client),
    api_client: TCGPlayerInternalAPIClient = Depends(get_tcgplayer_internal_api_client),
) -> TCGPlayerListingService:
    """FastAPI dependency to get TCGPlayer listing service with Redis client."""
    return TCGPlayerListingService(redis, api_client)
