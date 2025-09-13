import logging
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, List, Optional, TypedDict, NamedTuple
from dataclasses import dataclass
from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import select
from aiohttp import ClientResponseError

from core.models.price import Marketplace
from core.models.decisions import BuyDecision
from core.models.catalog import Condition, Printing, Language
from core.services.tcgplayer_listing_service import (
    get_sales,
    CardSaleRequestData,
    CardSaleResponse,
)
from core.dao.sales_listing import upsert_sales_listings, SalesDataRow
from core.dao.sync_state import (
    upsert_sync_timestamps,
    get_sales_refresh_timestamps,
    SyncStateRow,
)
from core.utils.request_pacer import RequestPacer
from core.services.sku_selection import ProcessingSKU
from core.dao.catalog import get_all_skus_by_product_ids
from core.database import SessionLocal


logger = logging.getLogger(__name__)


class CatalogMappings(TypedDict):
    condition_name_to_id: Dict[str, uuid.UUID]
    printing_name_to_id_by_catalog_id: Dict[uuid.UUID, Dict[str, uuid.UUID]]
    language_name_to_id: Dict[str, uuid.UUID]


class SKUKey(NamedTuple):
    condition_id: uuid.UUID
    printing_id: uuid.UUID
    language_id: uuid.UUID


@dataclass
class SuccessResult:
    sku_id: uuid.UUID
    sales_rows: List[SalesDataRow]
    sync_state_rows: List[SyncStateRow]
    buy_decision: Optional[BuyDecision]
    sales_count: int
    listings_count: int
    decision: str  # "BUY" or "PASS" or ""
    quantity: int
    buy_vwap: Optional[Decimal]
    expected_resale_net: Optional[Decimal]
    reason_codes: List[str]


@dataclass
class FailureResult:
    sku_id: uuid.UUID
    status_code: int  # 403, 500, etc.
    exception: Exception


@dataclass
class ProductProcessingGroup:
    product_tcgplayer_id: int
    skus: List[ProcessingSKU]


def get_catalog_mappings(session: Session) -> CatalogMappings:
    """
    Query database to get name→id mappings for Condition, Printing, and Language tables.
    These are used to resolve string values from TCGPlayer API to catalog IDs.
    Printing mappings are grouped by catalog_id since printings are catalog-specific.
    """
    condition_mappings = {
        c.name: c.id for c in session.execute(select(Condition)).scalars().all()
    }
    language_mappings = {
        language.name: language.id
        for language in session.execute(select(Language)).scalars().all()
    }

    # Group printing mappings by catalog_id since printings are catalog-specific
    printing_mappings_by_catalog: Dict[uuid.UUID, Dict[str, uuid.UUID]] = {}
    printings = session.execute(select(Printing)).scalars().all()
    for p in printings:
        if p.catalog_id not in printing_mappings_by_catalog:
            printing_mappings_by_catalog[p.catalog_id] = {}
        printing_mappings_by_catalog[p.catalog_id][p.name] = p.id

    return CatalogMappings(
        condition_name_to_id=condition_mappings,
        printing_name_to_id_by_catalog_id=printing_mappings_by_catalog,
        language_name_to_id=language_mappings,
    )


def build_sku_lookup_from_processing_skus(
    skus_in_product: List[ProcessingSKU],
) -> Dict[SKUKey, uuid.UUID]:
    """
    Build lookup table from ProcessingSKU objects (no database query needed).
    """
    sku_lookup: Dict[SKUKey, uuid.UUID] = {}
    for sku in skus_in_product:
        key = SKUKey(
            condition_id=sku.condition_id,
            printing_id=sku.printing_id,
            language_id=sku.language_id,
        )
        sku_lookup[key] = sku.sku_id
    return sku_lookup


def transform_card_sale_responses_to_sales_data_by_sku(
    sales_responses: List[CardSaleResponse],
    skus_in_product: List[ProcessingSKU],
    marketplace: Marketplace,
    mappings: CatalogMappings,
    catalog_id: uuid.UUID,
) -> Dict[uuid.UUID, List[SalesDataRow]]:
    """
    Transform TCGPlayer CardSaleResponse objects to SalesListing data format,
    mapping them to specific SKUs based on condition, variant (printing), and language.

    Args:
        sales_responses: List of sales from TCGPlayer API for the entire product
        skus_in_product: List of SKUs that belong to this product
        marketplace: Marketplace enum
        mappings: Name to ID mappings for catalog entities
        catalog_id: The catalog ID for this product (needed for printing mappings)

    Returns:
        Mapping of sku_id -> list of matched SalesDataRow
    """
    # Build lookup table for (condition_id, printing_id, language_id) -> sku_id
    sku_lookup = build_sku_lookup_from_processing_skus(skus_in_product)

    sales_by_sku_id: Dict[uuid.UUID, List[SalesDataRow]] = defaultdict(list)

    # Get product_tcgplayer_id from the SKUs (all SKUs in the same product have the same product_tcgplayer_id)
    product_tcgplayer_id = (
        skus_in_product[0].product_tcgplayer_id if skus_in_product else None
    )

    for sale in sales_responses:
        # Map API strings to catalog IDs
        condition_id = mappings["condition_name_to_id"].get(sale.condition)
        # Use catalog-specific printing mappings
        printing_mappings_for_catalog = mappings[
            "printing_name_to_id_by_catalog_id"
        ].get(catalog_id, {})
        printing_id = printing_mappings_for_catalog.get(sale.variant)
        language_id = mappings["language_name_to_id"].get(sale.language)

        # Skip if any mapping is missing
        if condition_id is None or printing_id is None or language_id is None:
            logger.error(
                f"Could not map sale to catalog for product {product_tcgplayer_id}: "
                f"condition='{sale.condition}', variant='{sale.variant}', language='{sale.language}'"
            )
            continue

        # Find the SKU that matches this combination
        sku_key = SKUKey(
            condition_id=condition_id, printing_id=printing_id, language_id=language_id
        )
        sku_id = sku_lookup.get(sku_key)

        if sku_id is None:
            logger.error(
                f"No SKU found for product {product_tcgplayer_id} with sale values "
                f"(condition='{sale.condition}', variant='{sale.variant}', language='{sale.language}'); "
                f"mapped IDs: condition_id={condition_id}, printing_id={printing_id}, language_id={language_id}"
            )
            continue

        # Create sales data row for this SKU
        sale_dict: SalesDataRow = {
            "sku_id": sku_id,
            "marketplace": marketplace,
            "sale_date": sale.orderDate,
            "sale_price": Decimal(str(sale.purchasePrice)),
            "shipping_price": Decimal(str(sale.shippingPrice))
            if sale.shippingPrice
            else None,
            "quantity": int(sale.quantity),
        }
        sales_by_sku_id[sku_id].append(sale_dict)

    return dict(sales_by_sku_id)


async def process_product_sales_sync(
    product_tcgplayer_id: int,
    last_sales_refresh_at: Optional[datetime],
) -> List[CardSaleResponse]:
    """
    Fetch incremental sales for a product and return raw responses.
    Caller is responsible for transforming to sales rows per SKU.
    """
    # Calculate time delta for incremental sales fetch
    if last_sales_refresh_at:
        time_delta = datetime.now(timezone.utc) - last_sales_refresh_at
    else:
        # Bootstrap: fetch 90 days of history
        time_delta = timedelta(days=90)

    # Create sales request
    sales_request = CardSaleRequestData(
        product_id=product_tcgplayer_id,
    )

    # Fetch sales data (let exceptions propagate)
    return await get_sales(sales_request, time_delta)


async def run_sales_sync_sweep(
    marketplace: Marketplace,
    product_tcgplayer_ids: List[int],
) -> None:
    """
    Run sales sync sweep to refresh sales data for all SKUs in given products.
    Optimized to process by product_tcgplayer_id to avoid duplicate API calls.
    Performs a single batched upsert of all sales, then updates sync state.
    """
    product_count = len(product_tcgplayer_ids)
    logger.info(f"Starting sales sync sweep with {product_count} products")

    # Prefetch static data using one short-lived session
    with SessionLocal() as session:
        # Query all SKUs for the given products
        all_processing_skus = get_all_skus_by_product_ids(
            session, product_tcgplayer_ids
        )

        # Prefetch catalog mappings for string→ID resolution
        mappings = get_catalog_mappings(session)
        total_printings = sum(
            len(v) for v in mappings["printing_name_to_id_by_catalog_id"].values()
        )
        num_catalogs_with_printings = len(mappings["printing_name_to_id_by_catalog_id"])
        logger.debug(
            f"Loaded catalog mappings: {len(mappings['condition_name_to_id'])} conditions, "
            f"{total_printings} printings across {num_catalogs_with_printings} catalogs, {len(mappings['language_name_to_id'])} languages"
        )

        # Prefetch last refresh timestamps for all SKUs
        all_sku_ids = [p.sku_id for p in all_processing_skus]
        refresh_timestamps = get_sales_refresh_timestamps(
            session, all_sku_ids, marketplace
        )

    # Group SKUs by product_tcgplayer_id
    product_groups: Dict[int, List[ProcessingSKU]] = defaultdict(list)
    for sku in all_processing_skus:
        product_groups[sku.product_tcgplayer_id].append(sku)

    total_sku_count = len(all_processing_skus)
    logger.debug(f"Fetched {total_sku_count} SKUs for {product_count} products")

    # Configure request pacer with defaults (burst-only)
    request_pacer = RequestPacer(
        session_break_after_requests=100,
        session_break_seconds=120.0,
    )

    # Accumulators
    all_sales_rows: List[SalesDataRow] = []
    successfully_synced_skus: List[uuid.UUID] = []

    # Track retry counts per product to prevent infinite loops
    retry_counts: Dict[int, int] = {}
    max_retries = 2

    # Convert to list for indexed iteration
    product_items = list(product_groups.items())

    # Drive requests by product
    processing_index = 0
    async for _ in request_pacer.create_schedule(product_count):
        product_tcgplayer_id, skus_in_product = product_items[processing_index]
        current_retry_count = retry_counts.get(product_tcgplayer_id, 0)

        # Calculate time delta based on earliest refresh time across SKUs in this product
        refresh_times = [refresh_timestamps.get(sku.sku_id) for sku in skus_in_product]
        refresh_times = [t for t in refresh_times if t is not None]
        earliest_refresh_at = min(refresh_times) if refresh_times else None

        logger.debug(
            f"Processing product {product_tcgplayer_id} with {len(skus_in_product)} SKUs; "
            f"earliest_refresh_at={earliest_refresh_at}"
        )

        try:
            # Make one API call for the entire product (covers all SKUs in this product)
            sales_responses = await process_product_sales_sync(
                product_tcgplayer_id=product_tcgplayer_id,
                last_sales_refresh_at=earliest_refresh_at,
            )

            # Get catalog_id from the first SKU (all SKUs in same product have same catalog_id)
            catalog_id = skus_in_product[0].catalog_id
            sales_by_sku: Dict[uuid.UUID, List[SalesDataRow]] = (
                transform_card_sale_responses_to_sales_data_by_sku(
                    sales_responses, skus_in_product, marketplace, mappings, catalog_id
                )
            )

            # Collect sales data for each SKU in the product
            for sku in skus_in_product:
                sku_sales_rows = sales_by_sku.get(sku.sku_id, [])
                all_sales_rows.extend(sku_sales_rows)
                successfully_synced_skus.append(sku.sku_id)

            logger.debug(
                f"Successfully processed product {product_tcgplayer_id} with {len(skus_in_product)} SKUs"
            )
            # Success: move to next product
            processing_index += 1

        except ClientResponseError as e:
            if e.status == 403 and current_retry_count < max_retries:
                retry_counts[product_tcgplayer_id] = current_retry_count + 1
                logger.warning(
                    f"Got 403 for product {product_tcgplayer_id}, retry {current_retry_count + 1}/{max_retries}. Cooling down and retrying."
                )
                # Notify pacer about rate limiting and cooldown adaptively
                request_pacer.on_rate_limited()
                await request_pacer.cooldown(add_retry_request=True)
                # Retry same product on next slot (do not advance index)
                continue

            # Non-403 or max retries reached → skip this product and all its SKUs
            if e.status == 403:
                logger.error(
                    f"Max retries ({max_retries}) reached for product {product_tcgplayer_id} with 403 error. Skipping {len(skus_in_product)} SKUs."
                )
            else:
                logger.error(
                    f"Error processing product {product_tcgplayer_id}: {e.status} {e.message}. Skipping {len(skus_in_product)} SKUs."
                )

            processing_index += 1
            continue

    # Persist results using one short-lived session
    if all_sales_rows or successfully_synced_skus:
        with SessionLocal.begin() as session:
            if all_sales_rows:
                upsert_sales_listings(session, all_sales_rows)
            if successfully_synced_skus:
                now_ts = datetime.now(timezone.utc)
                sync_rows: List[SyncStateRow] = [
                    {
                        "sku_id": sku_id,
                        "marketplace": marketplace,
                        "last_sales_refresh_at": now_ts,
                    }
                    for sku_id in successfully_synced_skus
                ]
                upsert_sync_timestamps(session, sync_rows)

    summary = {
        "total_successes": len(successfully_synced_skus),
        "requested_count": total_sku_count,
        "successful_sync_count": len(successfully_synced_skus),
    }

    logger.info(f"Sales sync sweep completed: {summary}")
