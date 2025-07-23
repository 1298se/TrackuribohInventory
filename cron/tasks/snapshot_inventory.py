import logging
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import select

from core.dao.inventory import query_inventory_catalogs
from core.services.inventory_service import get_inventory_metrics
from core.database import SessionLocal
from core.models.inventory_snapshot import InventorySnapshot
from core.models.user import User

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def snapshot_inventory():
    """
    Create a daily snapshot of inventory metrics aggregated by catalog per user.

    This runs at 00:05 UTC and captures yesterday's closing metrics.
    We store one row per user per catalog with non-zero inventory.
    """
    logger.info(
        f"Starting inventory snapshot job at {datetime.now(timezone.utc).isoformat()}"
    )

    # Use yesterday's date as the snapshot date (since this runs just after midnight)
    snapshot_date = date.today() - timedelta(days=1)
    logger.info(f"Creating snapshots for date: {snapshot_date}")

    with SessionLocal() as session:
        snapshots_created = 0

        # Get all users
        users = session.scalars(select(User)).all()
        logger.info(f"Found {len(users)} users to create snapshots for")

        for user in users:
            # Find all catalogs with inventory for this user
            inventory_catalogs = session.scalars(
                query_inventory_catalogs(user_id=user.id)
            ).all()

            for catalog in inventory_catalogs:
                # Compute aggregated metrics for this catalog and user
                metrics = get_inventory_metrics(
                    session, user_id=user.id, catalog_id=catalog.id
                )

                # Skip if no inventory for this catalog
                if metrics["number_of_items"] == 0:
                    continue

                total_cost = metrics["total_inventory_cost"]
                # Log summary
                logger.info(
                    f"Snapshot for user_id={user.id}, catalog_id={catalog.id}: "
                    f"{metrics['number_of_items']} units, "
                    f"cost={total_cost:.2f}, "
                    f"market={metrics['total_market_value']:.2f}"
                )

                # Create and save snapshot
                snapshot = InventorySnapshot(
                    user_id=user.id,
                    snapshot_date=snapshot_date,
                    catalog_id=catalog.id,
                    total_cost=total_cost,
                    total_market_value=metrics["total_market_value"],
                    unrealised_profit=metrics["unrealised_profit"],
                )
                session.add(snapshot)
                snapshots_created += 1

        # Commit all snapshots in one transaction
        session.commit()

    logger.info(f"Created {snapshots_created} snapshots for {snapshot_date}")


if __name__ == "__main__":
    snapshot_inventory()
