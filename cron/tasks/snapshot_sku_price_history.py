import asyncio
import logging
import uuid
from datetime import datetime, UTC
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

# Models
from core.models.catalog import SKU, Product, Set, Catalog, Condition, Language
from core.models.price import SKUPriceSnapshotJob, SKUPriceDataSnapshot

# Database
from core.database import SessionLocal

# TCGPlayer Service
from core.services.tcgplayer_catalog_service import tcgplayer_service_context
from core.services.schemas.schema import ProductType  # For type hinting and ProductType

# Utilities
from core.utils.workers import process_task_queue

# Logging setup
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# --- Constants ---
SKU_BATCH_SIZE = 200  # TCGPlayer allows ~200 IDs per GET URL before length limits
NUM_WORKERS = 10
JOB_NAME = "sku_price_history_snapshot"

# --- Helper Functions ---


async def get_market_indicator_sku_tcgplayer_ids(session: Session) -> list[int]:
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

    card_skus_stmt = (
        select(SKU.tcgplayer_id)
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
        select(SKU.tcgplayer_id)
        .join(Product, SKU.product_id == Product.id)
        .join(Set, Product.set_id == Set.id)
        .where(
            Product.product_type.in_(ProductType),
            Set.catalog_id.in_(catalog_ids),
            SKU.condition_id == unopened_condition_uuid,
        )
    )
    card_tcgplayer_ids = session.execute(card_skus_stmt).scalars().all()
    sealed_tcgplayer_ids = session.execute(sealed_skus_stmt).scalars().all()
    combined_ids = list(set(card_tcgplayer_ids + sealed_tcgplayer_ids))

    logger.info("Market Indicator SKUs: %s", len(combined_ids))

    return combined_ids


async def process_sku_batch_for_history(
    sku_batch_tcgplayer_ids: list[int],
    job_id: int,
) -> None:
    """Fetch pricing for a batch; store snapshots when price changes."""
    if not sku_batch_tcgplayer_ids:
        logger.debug("Job %s: empty SKU batch — skipping", job_id)
        return

    logger.info(
        f"Job {job_id}: Processing batch of {len(sku_batch_tcgplayer_ids)} SKUs."
    )
    async with tcgplayer_service_context() as service:
        with SessionLocal() as session, session.begin():
            active_tcgplayer_ids_in_batch = [
                tid for tid in sku_batch_tcgplayer_ids if tid
            ]
            if not active_tcgplayer_ids_in_batch:
                logger.debug(f"Job {job_id}: Batch only None TCGPlayer IDs. Skipping.")
                return

            sku_map_stmt = select(SKU.tcgplayer_id, SKU.id).where(
                SKU.tcgplayer_id.in_(active_tcgplayer_ids_in_batch)
            )
            sku_map_results = session.execute(sku_map_stmt).all()
            tcgplayer_id_to_sku_id_map: dict[int, uuid.UUID] = {
                res.tcgplayer_id: res.id for res in sku_map_results
            }

            sku_prices_response = await service.get_sku_prices(
                active_tcgplayer_ids_in_batch
            )

            current_utc_time = datetime.now(UTC)

            latest_lowest_listing_prices_map = {
                row.sku_id: row.lowest_listing_price_total
                for row in session.execute(
                    select(
                        SKUPriceDataSnapshot.sku_id,
                        SKUPriceDataSnapshot.lowest_listing_price_total,
                    )
                    .where(
                        SKUPriceDataSnapshot.sku_id.in_(
                            tcgplayer_id_to_sku_id_map.values()
                        )
                    )
                    .distinct(SKUPriceDataSnapshot.sku_id)
                    .order_by(
                        SKUPriceDataSnapshot.sku_id,
                        SKUPriceDataSnapshot.snapshot_datetime.desc(),
                    )
                ).all()
            }

            for price_data in sku_prices_response.results:
                tcgplayer_sku_id = price_data.sku_id
                sku_id = tcgplayer_id_to_sku_id_map.get(tcgplayer_sku_id)

                if not sku_id:
                    logger.warning(
                        f"Job {job_id}: SKU TCGPlayer ID {tcgplayer_sku_id} from API not in map. Skipping."
                    )
                    continue

                new_snapshot = SKUPriceDataSnapshot(
                    sku_id=sku_id,
                    snapshot_datetime=current_utc_time,
                    job_id=job_id,
                    lowest_listing_price_total=price_data.lowest_listing_price_total,
                )

                latest_lowest_listing_price = latest_lowest_listing_prices_map.get(
                    sku_id
                )

                # Skip if API did not provide a price (None)
                if price_data.lowest_listing_price_total is None:
                    continue

                if (
                    latest_lowest_listing_price is None
                    or latest_lowest_listing_price
                    != price_data.lowest_listing_price_total
                ):
                    session.add(new_snapshot)


async def main():
    logger.info("Starting %s...", JOB_NAME)
    job_start_time = datetime.now(UTC)
    current_job_id: Optional[int] = None

    total_skus_targeted = 0

    # keep one orchestration session alive for the whole job
    with SessionLocal(expire_on_commit=False) as session:
        try:
            job_row = SKUPriceSnapshotJob(start_time=job_start_time)
            session.add(job_row)
            session.commit()  # get id
            current_job_id = job_row.id
            logger.info("Created %s row id %s", JOB_NAME, current_job_id)

            # fetch Market Indicator SKUs using same session
            market_indicator_tcgplayer_ids = (
                await get_market_indicator_sku_tcgplayer_ids(session)
            )

            total_skus_targeted = len(market_indicator_tcgplayer_ids)

            if not market_indicator_tcgplayer_ids:
                logger.info(
                    f"Job {current_job_id}: No Market Indicator SKUs found to process."
                )
                # job_status = "completed_no_data"
            else:
                task_queue = asyncio.Queue()
                for i in range(0, len(market_indicator_tcgplayer_ids), SKU_BATCH_SIZE):
                    batch_ids = market_indicator_tcgplayer_ids[i : i + SKU_BATCH_SIZE]
                    await task_queue.put(
                        process_sku_batch_for_history(batch_ids, current_job_id)
                    )

                await process_task_queue(task_queue, num_workers=NUM_WORKERS)

                logger.info(
                    "Job %s: completed. SKUs targeted: %s",
                    current_job_id,
                    total_skus_targeted,
                )

        except ValueError as ve:
            logger.error(f"Job {current_job_id or 'PRE-INIT'}: Setup failed - {ve}")
        except Exception as e:
            logger.exception(
                f"Job {current_job_id or 'PRE-INIT'}: Unhandled error during orchestration: {e}"
            )
        finally:
            job_end_time = datetime.now(UTC)
            if current_job_id:
                job_row.end_time = job_end_time
                session.commit()
                logger.info(
                    "Job %s: finished in %.2fs",
                    current_job_id,
                    (job_end_time - job_start_time).total_seconds(),
                )
            else:
                logger.error("Job failed before row creation.")


if __name__ == "__main__":
    asyncio.run(main())
