import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.database import SessionLocal
from core.models.catalog import Catalog, Condition, Language, Product, SKU, Set
from core.services.price_service import update_latest_sku_prices
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


async def process_sku_batch_for_history(
    sku_batch_tcgplayer_ids: list[int],
) -> int:
    """Fetch pricing for a batch and delegate snapshot insertion to `update_latest_sku_prices`."""

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

            # Delegate to shared DAO util that handles price-change detection and insertion
            inserted = await update_latest_sku_prices(
                session=session,
                catalog_service=service,
                sku_ids=internal_sku_ids,
            )

            return inserted


async def main():
    datetime.now(UTC)

    total_skus_targeted = 0
    product_count = 0

    # keep one orchestration session alive for the whole job
    with SessionLocal(expire_on_commit=False) as session:
        try:
            # fetch Market Indicator SKUs using same session
            (
                market_indicator_tcgplayer_ids,
                product_count,
            ) = await get_market_indicator_sku_tcgplayer_ids(session)

            total_skus_targeted = len(market_indicator_tcgplayer_ids)

            if not market_indicator_tcgplayer_ids:
                logger.info("No Market Indicator SKUs found to process.")
                # job_status = "completed_no_data"
            else:
                task_queue = asyncio.Queue()
                for i in range(0, len(market_indicator_tcgplayer_ids), SKU_BATCH_SIZE):
                    batch_ids = market_indicator_tcgplayer_ids[i : i + SKU_BATCH_SIZE]
                    await task_queue.put(process_sku_batch_for_history(batch_ids))

                successes = await process_task_queue(task_queue)
                inserted_snapshots = sum(successes)

                logger.info(
                    f"{JOB_NAME}: completed. {product_count} products, {total_skus_targeted} SKUs targeted, {inserted_snapshots} price snapshots inserted"
                )

        except ValueError as ve:
            logger.error(f"%s: Setup failed - {ve}", JOB_NAME)
        except Exception as e:
            logger.exception(f"%s: Unhandled error during orchestration: {e}", JOB_NAME)
        finally:
            pass


if __name__ == "__main__":
    asyncio.run(main())
