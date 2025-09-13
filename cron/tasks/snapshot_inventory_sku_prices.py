import asyncio
import logging
import uuid

from sqlalchemy import select

from core.dao.inventory import query_inventory_items
from core.database import SessionLocal
from core.models.user import User
from core.models.price import Marketplace
from core.services.price_service import update_latest_sku_prices
from core.services.tcgplayer_catalog_service import tcgplayer_service_context
from core.utils.workers import process_task_queue
from cron.telemetry import init_sentry

init_sentry("snapshot_inventory_sku_prices")

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


PARTITION_SIZE = 200  # Process results in chunks
JOB_NAME = "inventory_price_update"


async def snapshot_inventory_sku_price_data():
    logger.info(f"Starting {JOB_NAME}...")

    async with tcgplayer_service_context() as service:
        with SessionLocal() as session:
            # 1. Get all users
            users = session.scalars(select(User)).all()

            logger.info(f"Processing inventory price updates for {len(users)} users")

            all_sku_ids: list[uuid.UUID] = []
            users_with_inventory = 0

            # 2. Gather all SKUs currently in inventory across all users
            for user in users:
                user_sku_ids = [
                    sku.id
                    for (sku, _, _) in session.execute(
                        query_inventory_items(user.id)
                    ).all()
                ]
                if user_sku_ids:
                    users_with_inventory += 1
                    logger.debug(
                        f"User {user.email}: {len(user_sku_ids)} SKUs in inventory"
                    )
                all_sku_ids.extend(user_sku_ids)

            # Remove duplicates since multiple users might own the same SKU
            unique_sku_ids = list(set(all_sku_ids))
            total_skus_targeted = len(unique_sku_ids)

            if not unique_sku_ids:
                logger.info("No SKUs in inventory to update prices for.")
                return

            logger.info(f"Total unique SKUs across all users: {total_skus_targeted}")

            # 2. Build async tasks per batch
            task_queue = asyncio.Queue()

            for i in range(0, len(unique_sku_ids), PARTITION_SIZE):
                batch_sku_ids = unique_sku_ids[i : i + PARTITION_SIZE]

                async def _process_batch(batch_ids=batch_sku_ids):
                    with SessionLocal() as batch_session:
                        updated_cnt = await update_latest_sku_prices(
                            session=batch_session,
                            catalog_service=service,
                            sku_ids=batch_ids,
                            marketplace=Marketplace.TCGPLAYER,
                            write_through=False,
                        )
                        logger.debug(
                            f"{JOB_NAME}: batch of {len(batch_ids)} SKUs updated {updated_cnt} cache entries"
                        )
                        return updated_cnt

                await task_queue.put(_process_batch())

            # 3. Process all tasks concurrently
            successes = await process_task_queue(task_queue)

            updated_cache_entries = sum(successes)

            logger.info(
                f"{JOB_NAME}: completed. {users_with_inventory} users with inventory, "
                f"{total_skus_targeted} unique SKUs targeted, {updated_cache_entries} cache entries updated"
            )


if __name__ == "__main__":
    asyncio.run(snapshot_inventory_sku_price_data())
