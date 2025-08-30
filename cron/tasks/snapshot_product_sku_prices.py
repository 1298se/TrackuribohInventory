import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.database import SessionLocal
from core.models.catalog import Catalog, Condition, Language, Product, SKU, Set
from core.models.price import Marketplace
from core.services.price_service import update_latest_sku_prices
from core.dao.latest_price import get_today_updated_sku_ids
from core.services.schemas.schema import ProductType
from core.services.tcgplayer_catalog_service import tcgplayer_service_context
from core.utils.workers import process_task_queue
from cron.telemetry import init_sentry

init_sentry("snapshot_product_sku_prices")

# from typing import Optional  # No longer used here

# Logging setup
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# --- Constants ---
SKU_BATCH_SIZE = 200  # TCGPlayer allows ~200 IDs per GET URL before length limits
JOB_NAME = "sku_price_history_snapshot"


async def get_market_indicator_sku_tcgplayer_ids(
    session: Session,
) -> tuple[list[int], int]:
    nm_condition_uuid = session.execute(
        select(Condition.id).where(Condition.abbreviation == "NM")
    ).scalar_one()

    lp_condition_uuid = session.execute(
        select(Condition.id).where(Condition.abbreviation == "LP")
    ).scalar_one()

    unopened_condition_uuid = session.execute(
        select(Condition.id).where(Condition.abbreviation == "U")
    ).scalar_one()

    english_language_uuid = session.execute(
        select(Language.id).where(Language.abbreviation == "EN")
    ).scalar_one()

    catalog_ids = session.execute(select(Catalog.id).distinct()).scalars().all()

    # Get SKU IDs and Product IDs for counting
    card_skus_stmt = (
        select(SKU.tcgplayer_id, SKU.product_id)
        .join(Product, SKU.product_id == Product.id)
        .join(Set, Product.set_id == Set.id)
        .where(
            Product.product_type == ProductType.CARDS,
            Set.catalog_id.in_(catalog_ids),
            SKU.condition_id.in_([nm_condition_uuid, lp_condition_uuid]),
            SKU.language_id == english_language_uuid,
        )
    )

    sealed_skus_stmt = (
        select(SKU.tcgplayer_id, SKU.product_id)
        .join(Product, SKU.product_id == Product.id)
        .join(Set, Product.set_id == Set.id)
        .where(
            Product.product_type.in_(ProductType),
            Set.catalog_id.in_(catalog_ids),
            SKU.condition_id == unopened_condition_uuid,
        )
    )

    card_results = session.execute(card_skus_stmt).all()
    sealed_results = session.execute(sealed_skus_stmt).all()

    # Extract SKU IDs and Product IDs
    card_tcgplayer_ids = [row.tcgplayer_id for row in card_results]
    sealed_tcgplayer_ids = [row.tcgplayer_id for row in sealed_results]

    card_product_ids = {row.product_id for row in card_results}
    sealed_product_ids = {row.product_id for row in sealed_results}

    # Combine and deduplicate
    combined_sku_ids = list(set(card_tcgplayer_ids + sealed_tcgplayer_ids))
    unique_product_count = len(card_product_ids | sealed_product_ids)

    return combined_sku_ids, unique_product_count


async def process_sku_batch_for_daily_flush(
    sku_batch_tcgplayer_ids: list[int],
) -> int:
    """
    Fetch pricing for a batch, update cache, and write to history.

    Returns number of cache entries updated.
    """

    if not sku_batch_tcgplayer_ids:
        logger.debug("Empty SKU batch — skipping")
        return 0

    async with tcgplayer_service_context() as service:
        with SessionLocal() as session:
            # Filter out any None values
            active_tcgplayer_ids = [tid for tid in sku_batch_tcgplayer_ids if tid]

            # Map external TCGPlayer IDs to internal UUIDs
            sku_id_rows = session.execute(
                select(SKU.id).where(SKU.tcgplayer_id.in_(active_tcgplayer_ids))
            ).all()

            internal_sku_ids = [row.id for row in sku_id_rows]

            if not internal_sku_ids:
                logger.debug("No internal SKU IDs found for batch; skipping.")
                return 0

            # Use unified price service - updates cache AND writes history
            try:
                cache_updates = await update_latest_sku_prices(
                    session=session,
                    catalog_service=service,
                    sku_ids=internal_sku_ids,
                    marketplace=Marketplace.TCGPLAYER,
                    write_through=True,  # Write both cache and history
                )
                return cache_updates
            except Exception as e:
                logger.error(f"Failed to update prices for batch: {e}")
                return 0


async def main():
    # Fixed snapshot datetime for day start (00:00:00 UTC today)
    snapshot_dt = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)

    total_skus_targeted = 0
    product_count = 0
    total_cache_updates = 0

    # keep one orchestration session alive for the whole job
    with SessionLocal(expire_on_commit=False) as session:
        try:
            # 1. Get Market Indicator SKUs (existing logic)
            (
                market_indicator_tcgplayer_ids,
                product_count,
            ) = await get_market_indicator_sku_tcgplayer_ids(session)

            # 2. Get SKUs that were updated today in the cache
            # (these are inventory SKUs that got price updates from the hourly job)
            today_start_utc = snapshot_dt
            today_updated_sku_ids = get_today_updated_sku_ids(
                session,
                marketplace=Marketplace.TCGPLAYER,
                cutoff_datetime=today_start_utc,
            )

            # Map today's updated internal SKU IDs to TCGPlayer IDs
            if today_updated_sku_ids:
                today_updated_tcg_ids = (
                    session.execute(
                        select(SKU.tcgplayer_id).where(
                            SKU.id.in_(today_updated_sku_ids),
                            SKU.tcgplayer_id.isnot(None),
                        )
                    )
                    .scalars()
                    .all()
                )
            else:
                today_updated_tcg_ids = []

            # 3. Build union of target SKUs (avoid duplicates)
            all_target_tcgplayer_ids = list(
                set(market_indicator_tcgplayer_ids + today_updated_tcg_ids)
            )
            total_skus_targeted = len(all_target_tcgplayer_ids)

            logger.info(
                f"{JOB_NAME}: Targeting {len(market_indicator_tcgplayer_ids)} market indicator SKUs + "
                f"{len(today_updated_tcg_ids)} today-updated SKUs = {total_skus_targeted} total SKUs"
            )

            if not all_target_tcgplayer_ids:
                logger.info("No SKUs found to process.")
                return

            # 4. Process in batches
            task_queue = asyncio.Queue()
            for i in range(0, len(all_target_tcgplayer_ids), SKU_BATCH_SIZE):
                batch_ids = all_target_tcgplayer_ids[i : i + SKU_BATCH_SIZE]
                await task_queue.put(process_sku_batch_for_daily_flush(batch_ids))

            successes = await process_task_queue(task_queue)

            # Sum up results from all batches
            total_cache_updates = sum(successes)

            logger.info(
                f"{JOB_NAME}: completed. {product_count} products, {total_skus_targeted} SKUs targeted, "
                f"{total_cache_updates} cache entries updated"
            )

        except ValueError as ve:
            logger.error(f"{JOB_NAME}: Setup failed - {ve}")
        except Exception as e:
            logger.exception(f"{JOB_NAME}: Unhandled error during orchestration: {e}")
        finally:
            pass


if __name__ == "__main__":
    asyncio.run(main())
