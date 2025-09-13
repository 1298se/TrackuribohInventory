import asyncio
import logging
import uuid
import os
import json
import boto3

from core.database import SessionLocal
from core.models.price import Marketplace
from core.services.snapshot_scoring_service import compute_and_store_scores
from core.dao.market_indicators import get_market_indicator_sku_ids
from core.utils.workers import process_task_queue
from cron.telemetry import init_sentry

init_sentry("compute_sku_listing_data_refresh_priority")

# Logging setup
logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Constants
SCORE_BATCH_SIZE = 5000
JOB_NAME = "compute_sku_listing_data_refresh_priority"


async def process_scoring_batch(sku_batch: list[uuid.UUID]) -> int:
    """
    Process a batch of SKUs for priority scoring.

    Args:
        sku_batch: List of SKU IDs (UUIDs) to score

    Returns:
        Number of records updated
    """
    with SessionLocal.begin() as session:
        updated_count = await compute_and_store_scores(
            session, sku_batch, Marketplace.TCGPLAYER
        )
        logger.debug(f"Updated {updated_count} priority scores in batch")
        return updated_count


async def publish_purchase_decision_event(total_records_updated: int) -> None:
    """
    Publish EventBridge event to trigger purchase_decision_sweep task upon completion.
    """
    region = os.getenv("AWS_REGION", "us-east-2")
    events_client = boto3.client("events", region_name=region)

    response = events_client.put_events(
        Entries=[
            {
                "Source": "codex.jobs",
                "DetailType": "PurchaseDecisionSweep",
                "EventBusName": "default",
                "Detail": json.dumps(
                    {
                        "triggeredBy": JOB_NAME,
                        "recordsUpdated": total_records_updated,
                    }
                ),
            }
        ]
    )

    if response.get("FailedEntryCount", 0) > 0:
        logger.error(
            f"Failed to publish PurchaseDecisionSweep event: {response.get('Entries', [])}"
        )
    else:
        logger.info("Published EventBridge event to trigger purchase decision sweep")


async def main():
    total_skus_targeted = 0
    total_records_updated = 0

    # Get target SKU IDs with a separate short-lived session
    with SessionLocal() as session:
        target_sku_ids = get_market_indicator_sku_ids(session)
        total_skus_targeted = len(target_sku_ids)

    if not target_sku_ids:
        logger.info("No SKUs found to process.")
        return

    logger.info(f"Preparing to process {total_skus_targeted} market indicator SKUs")

    # Process in batches using existing worker patterns (each batch handles its own session)
    task_queue = asyncio.Queue()
    for i in range(0, len(target_sku_ids), SCORE_BATCH_SIZE):
        batch = target_sku_ids[i : i + SCORE_BATCH_SIZE]
        await task_queue.put(process_scoring_batch(batch))

    successes = await process_task_queue(task_queue)
    total_records_updated = sum(successes)

    logger.info(
        f"{JOB_NAME}: completed. {total_skus_targeted} SKUs targeted, "
        f"{total_records_updated} priority records updated"
    )

    # Trigger the purchase decision sweep if we updated any records
    if total_records_updated > 0:
        await publish_purchase_decision_event(total_records_updated)


if __name__ == "__main__":
    asyncio.run(main())
