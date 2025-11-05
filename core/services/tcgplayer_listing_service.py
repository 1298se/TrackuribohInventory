import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, TypedDict

import redis.asyncio as redis
from fastapi import Depends

from core.services.base_marketplace_listing_service import BaseMarketplaceListingService
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


class TCGPlayerListingService(BaseMarketplaceListingService[TCGPlayerListingSchema]):
    """Service for fetching TCGPlayer listings and sales with Redis caching."""

    # Class constants
    LISTING_PAGINATION_SIZE = 50

    @property
    def marketplace_name(self) -> str:
        return "tcgplayer"

    def __init__(
        self,
        redis_client: redis.Redis,
        api_client: TCGPlayerInternalAPIClient,
    ) -> None:
        super().__init__(redis_client)
        self.api_client = api_client

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

        if has_filters:
            return await self._fetch_product_active_listings_from_api(request)

        cache_key = self._get_cache_key("listings", product_id)
        cached_listings = await self._get_from_cache(cache_key, TCGPlayerListingSchema)
        if cached_listings:
            logger.debug("Cache hit for listings product_id=%d", product_id)
            return cached_listings

        async with self._cache_fetch_lock(cache_key) as have_lock:
            if have_lock:
                cached_listings = await self._get_from_cache(
                    cache_key, TCGPlayerListingSchema
                )
                if cached_listings:
                    logger.debug(
                        "Cache filled while acquiring lock for listings product_id=%d",
                        product_id,
                    )
                    return cached_listings

                listings = await self._fetch_product_active_listings_from_api(request)
                if listings:
                    await self._set_cache(cache_key, listings)
                return listings

        # No lock acquired (another request is fetching); wait briefly for cache
        cached_listings = await self._wait_for_cache_population(
            cache_key, TCGPlayerListingSchema
        )
        if cached_listings is not None:
            logger.debug(
                "Cache populated during wait for listings product_id=%d", product_id
            )
            return cached_listings

        # Fallback: fetch to ensure we return data even if cache population failed
        listings = await self._fetch_product_active_listings_from_api(request)
        if listings:
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

        if has_filters:
            return await self._fetch_sales_from_api(request, time_delta)

        cache_key = self._get_cache_key("sales", product_id)
        cached_sales = await self._get_from_cache(cache_key, TCGPlayerSaleSchema)
        if cached_sales:
            logger.debug("Cache hit for sales product_id=%d", product_id)
            return cached_sales

        async with self._cache_fetch_lock(cache_key) as have_lock:
            if have_lock:
                cached_sales = await self._get_from_cache(
                    cache_key, TCGPlayerSaleSchema
                )
                if cached_sales:
                    logger.debug(
                        "Cache filled while acquiring lock for sales product_id=%d",
                        product_id,
                    )
                    return cached_sales

                sales = await self._fetch_sales_from_api(request, time_delta)
                if sales:
                    await self._set_cache(cache_key, sales)
                return sales

        cached_sales = await self._wait_for_cache_population(
            cache_key, TCGPlayerSaleSchema
        )
        if cached_sales is not None:
            logger.debug(
                "Cache populated during wait for sales product_id=%d", product_id
            )
            return cached_sales

        sales = await self._fetch_sales_from_api(request, time_delta)
        if sales:
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
