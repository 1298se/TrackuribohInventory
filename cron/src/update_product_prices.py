import asyncio

from sqlalchemy import select, insert

from core.database import SessionLocal
from core.models import Condition, Language, SKU
from core.models.price import SKUPriceSnapshot
from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService
from core.utils.workers import process_task_queue


async def update_sku_prices(skus: list[SKU]):
    async with TCGPlayerCatalogService() as service:
        with SessionLocal() as session, session.begin():
            print(f"updating skus: {[sku.id for sku in skus]}")
            sku_prices_response = await service.get_sku_prices([sku.tcgplayer_id for sku in skus])

            tcgplayer_id_to_sku: dict[int, SKU] = {
                sku.tcgplayer_id: sku
                for sku in skus
            }

            tcgplayer_id_to_sku_price = {
                sku_price.sku_id: sku_price
                for sku_price in sku_prices_response.results
            }

            sku_price_snapshot_values = [
                {
                    "sku_id": tcgplayer_id_to_sku[tcgplayer_id].id,
                    "_lowest_listing_price_amount": tcgplayer_id_to_sku_price[tcgplayer_id].lowest_listing_price_total,
                    "_lowest_listing_price_currency": "USD",
                    "_market_price_amount": tcgplayer_id_to_sku_price[tcgplayer_id].market_price,
                    "_market_price_currency": "USD",
                }
                for (tcgplayer_id, sku_price) in tcgplayer_id_to_sku.items()
            ]

            session.execute(
                insert(SKUPriceSnapshot).values(sku_price_snapshot_values)
            )


async def update_product_prices():
    with SessionLocal() as session:
        # We do this because we have a maximum number of simultaneous connections we can make to the database.
        # The number 20 was picked arbitrarily, but works quite well.
        task_queue = asyncio.Queue()

        near_mint_condition: Condition = session.scalar(select(Condition).where(Condition.name == "Near Mint"))
        english_language: Language = session.scalar(select(Language).where(Language.name == "English"))

        near_mint_english_skus = session.scalars(
            select(SKU).where(SKU.condition_id == near_mint_condition.id and SKU.language_id == english_language.id)
        )

        for partition in near_mint_english_skus.yield_per(200).partitions():
            await task_queue.put(update_sku_prices(list(partition)))

        await process_task_queue(task_queue, num_workers=20)


if __name__ == '__main__':
    asyncio.run(
        update_product_prices(),
    )
