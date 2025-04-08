import asyncio
import uuid
from typing import List

from sqlalchemy import select, func

from app.routes.inventory.dao import query_inventory_items, InventoryQueryResultRow
from core.dao.prices import update_latest_sku_prices
from core.database import SessionLocal
from core.models import SKU, LineItem
from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService


async def update_inventory_price_data():
    """Main task function to update latest prices for SKUs currently in inventory."""
    print(f"Starting inventory SKU price update job...")
    async with TCGPlayerCatalogService() as service:
        with SessionLocal() as session:
            # 1. Use query_inventory_items to get SKUs in inventory
            # This function returns a Select object, we need to execute it.
            # The result rows are Tuple[SKU, int, Decimal, Optional[SKULatestPriceData]]
            inventory_query = query_inventory_items()
            # Execute the query and get all results
            inventory_results: List[InventoryQueryResultRow] = session.execute(inventory_query).all()

            # Extract SKU IDs from the results
            inventory_sku_ids: List[uuid.UUID] = [result[0].id for result in inventory_results]

            if not inventory_sku_ids:
                print("No SKUs currently in inventory. Exiting job.")
                return

            print(f"Found {len(inventory_sku_ids)} distinct SKUs in inventory. Updating latest prices...")

            # 2. Call the function to update latest prices
            await update_latest_sku_prices(
                session=session,
                catalog_service=service,
                sku_ids=inventory_sku_ids
            )

            print(f"Finished updating latest prices for {len(inventory_sku_ids)} SKUs.")


if __name__ == '__main__':
    print("Starting manual inventory price update...")
    asyncio.run(
        update_inventory_price_data(),
    )
    print("Manual inventory price update finished.") 