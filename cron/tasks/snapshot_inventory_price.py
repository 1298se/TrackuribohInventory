import asyncio
import logging
from datetime import datetime, UTC
import uuid

from core.dao.inventory import query_inventory_items
from core.services.price_service import update_latest_sku_prices
from core.database import SessionLocal
from core.services.tcgplayer_catalog_service import tcgplayer_service_context
from core.utils.workers import process_task_queue

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

PARTITION_SIZE = 200  # Process results in chunks
JOB_NAME = "inventory_price_update"


async def snapshot_inventory_price_data():
    logger.info("Starting %s...", JOB_NAME)
    job_start_time = datetime.now(UTC)

    async with tcgplayer_service_context() as service:
        with SessionLocal() as session:
            try:
                # 1. Gather all SKUs currently in inventory
                all_sku_ids: list[uuid.UUID] = [
                    sku.id
                    for (sku, _, _, _) in session.execute(query_inventory_items()).all()
                ]

                total_skus_targeted = len(all_sku_ids)

                if not all_sku_ids:
                    logger.info("No SKUs in inventory to update prices for.")
                    return

                # 2. Build async tasks per batch
                task_queue = asyncio.Queue()

                for i in range(0, len(all_sku_ids), PARTITION_SIZE):
                    batch_sku_ids = all_sku_ids[i : i + PARTITION_SIZE]

                    async def _process_batch(batch_ids=batch_sku_ids):
                        with SessionLocal() as batch_session:
                            inserted_cnt = await update_latest_sku_prices(
                                session=batch_session,
                                catalog_service=service,
                                sku_ids=batch_ids,
                            )
                            logger.debug(
                                "%s: batch of %d SKUs inserted %d snapshots",
                                JOB_NAME,
                                len(batch_ids),
                                inserted_cnt,
                            )
                            return inserted_cnt

                    await task_queue.put(_process_batch())

                # 3. Process all tasks concurrently
                # `process_task_queue` returns a tuple of (successes, failures)
                successes, failures = await process_task_queue(task_queue)

                inserted_snapshots = sum(successes)

                if failures:
                    logger.error(
                        "%s: %d batch tasks failed during execution.",
                        JOB_NAME,
                        len(failures),
                    )

                logger.info(
                    "%s: completed. SKUs targeted: %d, SKU price snapshots inserted: %d",
                    JOB_NAME,
                    total_skus_targeted,
                    inserted_snapshots,
                )
            except ValueError as ve:
                logger.error("%s: Setup failed - %s", JOB_NAME, ve)
            except Exception as e:
                logger.exception(
                    "%s: Unhandled error during orchestration: %s", JOB_NAME, e
                )
            finally:
                job_end_time = datetime.now(UTC)
                logger.info(
                    "%s: finished in %.2fs",
                    JOB_NAME,
                    (job_end_time - job_start_time).total_seconds(),
                )


if __name__ == "__main__":
    asyncio.run(snapshot_inventory_price_data())
