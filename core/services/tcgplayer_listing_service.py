import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, TypedDict

import redis.asyncio as redis
from fastapi import BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.dao.sales import (
    SalesDataRow,
    get_recent_sales_for_product_variant,
    upsert_sales_listings,
)
from core.database import SessionLocal
from core.models.catalog import SKU
from core.models.listings import SaleRecord
from core.models.price import Marketplace
from core.services.base_marketplace_listing_service import BaseMarketplaceListingService
from core.services.redis_service import get_redis_client
from core.services.schemas.tcgplayer import (
    TCGPlayerSaleSchema,
    TCGPlayerListingSchema,
)
from core.services.sku_lookup import build_sku_name_lookup_from_skus
from core.services.tcgplayer_internal_api_client import (
    TCGPlayerInternalAPIClient,
    get_tcgplayer_internal_api_client,
)

logger = logging.getLogger(__name__)


def _persist_sales_to_db_background(
    product_variant_id: uuid.UUID,
    tcgplayer_sales: List[TCGPlayerSaleSchema],
    marketplace: "Marketplace",
) -> None:
    """
    Background task to persist sales to database.

    This function runs AFTER the HTTP response is sent.
    It creates its own database session to avoid session lifecycle issues.

    Args:
        product_variant_id: Product variant UUID to query SKUs for
        tcgplayer_sales: List of sale DTOs from TCGPlayer API
        marketplace: Marketplace enum
    """
    with SessionLocal.begin() as session:
        # Query SKUs for this variant
        variant_skus = session.scalars(
            select(SKU).where(SKU.variant_id == product_variant_id)
        ).all()

        # Build SKU lookup for mapping sales to SKU IDs
        sku_lookup = build_sku_name_lookup_from_skus(variant_skus)

        # Transform API sales to database format
        sales_data: List[SalesDataRow] = []
        for sale in tcgplayer_sales:
            sku_key = (sale.condition, sale.variant, sale.language)
            sku = sku_lookup.get(sku_key)

            if sku:
                sales_data.append(
                    {
                        "sku_id": sku.id,
                        "marketplace": marketplace,
                        "sale_date": sale.order_date,
                        "sale_price": sale.purchase_price,
                        "shipping_price": sale.shipping_price
                        if sale.shipping_price
                        else None,
                        "quantity": sale.quantity,
                    }
                )

        # Persist to database (upsert handles duplicates automatically)
        if sales_data:
            inserted_records = upsert_sales_listings(session, sales_data)
            logger.info(
                f"Persisted {len(inserted_records)} new sales "
                f"(out of {len(sales_data)} total, duplicates skipped)"
            )
        else:
            logger.warning(
                f"No sales could be mapped to SKUs from {len(tcgplayer_sales)} API sales"
            )


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
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> None:
        super().__init__(redis_client)
        self.api_client = api_client
        self.background_tasks = background_tasks

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
        self, request: CardSaleRequestData, time_delta: Optional[timedelta] = None
    ) -> list[TCGPlayerSaleSchema]:
        """
        Fetch recent sales for a product from TCGPlayer API.

        Sales data is persisted to database via get_and_persist_sales().
        This method always fetches fresh data from the API.

        Args:
            request: TCGPlayer sales request (product_id, optional filters)
            time_delta: Time window for sales (e.g., last 30 days). If None, defaults to 30 days.

        Returns:
            List of sales from TCGPlayer API

        Note:
            For endpoints needing persistence, use get_and_persist_sales() instead.
        """
        sales: list[TCGPlayerSaleSchema] = []
        product_id = request["product_id"]
        cur_offset = 0

        # Default to 30 days if not specified
        if time_delta is None:
            time_delta = timedelta(days=30)

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

    async def get_and_persist_sales(
        self,
        request: CardSaleRequestData,
        time_delta: Optional[timedelta],
        product_variant_id: uuid.UUID,
        session: Session,
    ) -> tuple[list[TCGPlayerSaleSchema], list["SaleRecord"]]:
        """
        Fetch sales from API and schedule background persistence to database.

        This method combines three operations:
        1. Query existing sales from database
        2. Fetch new sales from TCGPlayer API
        3. Schedule background task to persist new sales to DB

        Args:
            request: TCGPlayer sales request parameters
            time_delta: Time window for sales (e.g., last 30 days). If None, queries all sales.
            product_variant_id: Product variant UUID for DB queries
            session: Active database session for queries

        Returns:
            Tuple of (api_sales, db_sales) for merging in API layer

        Side Effects:
            - Schedules background task to persist sales (if BackgroundTasks available)
            - Background task runs after HTTP response is sent
            - Duplicates are automatically handled via database unique constraints

        Note:
            Use get_sales() instead if you don't need database persistence.
        """
        # Step 1: Query existing sales from database
        if time_delta is None:
            # Query all sales from the beginning of time
            cutoff_date = datetime.min.replace(tzinfo=timezone.utc)
        else:
            cutoff_date = datetime.now(timezone.utc) - time_delta

        db_sales = get_recent_sales_for_product_variant(
            session=session,
            product_variant_id=product_variant_id,
            marketplace=Marketplace.TCGPLAYER,
            since_date=cutoff_date,
        )

        logger.debug(
            f"Found {len(db_sales)} existing sales in DB for variant {product_variant_id}"
        )

        # Step 2: Fetch new sales from API (reuse existing method)
        # Note: API always fetches from TCGPlayer (defaults to 30 days if time_delta is None)
        api_sales = await self.get_sales(request, time_delta)

        logger.debug(
            f"Fetched {len(api_sales)} sales from API for product {request['product_id']}"
        )

        # Step 3: Schedule background persistence (if BackgroundTasks available)
        if self.background_tasks and api_sales:
            self.background_tasks.add_task(
                _persist_sales_to_db_background,
                product_variant_id=product_variant_id,
                tcgplayer_sales=api_sales,
                marketplace=Marketplace.TCGPLAYER,
            )

            logger.debug(
                f"Scheduled background task to persist {len(api_sales)} sales for "
                f"variant {product_variant_id}"
            )
        elif not self.background_tasks and api_sales:
            logger.warning(
                f"BackgroundTasks not available - sales will not be persisted to DB "
                f"(got {len(api_sales)} API sales)"
            )

        # Step 4: Return both for merging in API layer
        return api_sales, db_sales


def get_tcgplayer_listing_service(
    background_tasks: BackgroundTasks,
    redis: redis.Redis = Depends(get_redis_client),
    api_client: TCGPlayerInternalAPIClient = Depends(get_tcgplayer_internal_api_client),
) -> TCGPlayerListingService:
    """FastAPI dependency to get TCGPlayer listing service with BackgroundTasks injection."""
    return TCGPlayerListingService(redis, api_client, background_tasks)
