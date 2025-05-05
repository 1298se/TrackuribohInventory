import asyncio


from core.dao.inventory import query_inventory_items
from core.dao.prices import update_latest_sku_prices
from core.database import SessionLocal
from core.services.tcgplayer_catalog_service import tcgplayer_service_context

PARTITION_SIZE = 200  # Process results in chunks


async def update_inventory_price_data():
    """Main task function to update latest prices for SKUs currently in inventory."""
    print("Starting inventory SKU price update job...")
    async with tcgplayer_service_context() as service:
        with SessionLocal() as session:
            all_sku_ids = [
                sku.id
                for (sku, _, _, _) in session.execute(query_inventory_items()).all()
            ]

            sku_id_batches = [
                all_sku_ids[i : i + PARTITION_SIZE]
                for i in range(0, len(all_sku_ids), PARTITION_SIZE)
            ]

            for batch_sku_ids in sku_id_batches:
                await update_latest_sku_prices(
                    session=session, catalog_service=service, sku_ids=batch_sku_ids
                )


if __name__ == "__main__":
    print("Starting manual inventory price update...")
    asyncio.run(
        update_inventory_price_data(),
    )
    print("Manual inventory price update finished.")
