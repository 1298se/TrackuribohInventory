import asyncio
import logging
from datetime import datetime

from core.database import SessionLocal, engine
from core.models.price import Marketplace
from core.services.purchase_decision_service import run_purchase_decision_sweep
from core.services.sales_sync_sweep_service import run_sales_sync_sweep
from core.services.sku_selection import TierCandidates, TIER_CONFIGS
from cron.telemetry import init_sentry
from sqlalchemy import select, func

init_sentry("purchase_decision_sweep")

logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Constants
JOB_NAME = "purchase_decision_sweep"
TARGET_SUCCESSES = 500  # Production volume
LOCK_KEY = 815432123456  # Unique advisory lock key for this job


async def main():
    start_time = datetime.now()

    logger.info(
        f"Starting {JOB_NAME} with target of {TARGET_SUCCESSES} successful requests"
    )
    logger.info("Using default burst pacing")

    try:
        # Acquire a Postgres advisory lock to prevent overlapping runs
        with engine.connect() as root_conn:
            acquired = root_conn.scalar(select(func.pg_try_advisory_lock(LOCK_KEY)))
            if not acquired:
                logger.info("Another instance is already running. Exiting.")
                return
            try:
                with SessionLocal() as session:
                    # Create candidates and processing list once for both passes
                    logger.info(
                        f"Computing processing list for {TARGET_SUCCESSES} SKUs"
                    )
                    tier_candidates = TierCandidates(session, Marketplace.TCGPLAYER)

                    # Calculate tier quotas
                    tier_quotas = {}
                    for tier in TIER_CONFIGS:
                        tier_quotas[tier.name] = int(
                            TARGET_SUCCESSES * tier.budget_share
                        )

                    # Get ordered processing list
                    processing_list = tier_candidates.get_ordered_processing_list(
                        tier_quotas
                    )

                    # Enforce target size at the orchestrator level
                    processing_list = processing_list[:TARGET_SUCCESSES]

                    logger.info(
                        f"Generated processing list with {len(processing_list)} SKUs"
                    )

                    # Extract unique product IDs for sales sync
                    unique_product_ids = list(
                        set(sku.product_tcgplayer_id for sku in processing_list)
                    )
                    logger.info(
                        f"Processing {len(unique_product_ids)} unique products for data sync"
                    )

                # Pass 1: Sales Data Sync
                await run_sales_sync_sweep(
                    marketplace=Marketplace.TCGPLAYER,
                    product_tcgplayer_ids=unique_product_ids,
                )

                # Calculate runtime for sales sync only
                end_time = datetime.now()

                # Pass 2: Purchase Decision Making
                await run_purchase_decision_sweep(
                    marketplace=Marketplace.TCGPLAYER,
                    processing_list=processing_list,
                )
            finally:
                # Always release the advisory lock
                root_conn.scalar(select(func.pg_advisory_unlock(LOCK_KEY)))

        # Log completion
        end_time = datetime.now()
        total_runtime = (end_time - start_time).total_seconds() / 60
        logger.info(f"Purchase decision sweep completed in {total_runtime:.1f} minutes")

    except Exception as e:
        logger.error(f"{JOB_NAME} failed with error: {str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(main())
