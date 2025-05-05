import asyncio

from sqlalchemy import select, insert, or_, and_

from core.database import SessionLocal
from core.models.catalog import SKU
from core.models.price import SKUPriceSnapshot
from core.models.price import SKUPriceSnapshotJob
from core.models.catalog import Condition
from core.models.catalog import Language
from core.services.tcgplayer_catalog_service import tcgplayer_service_context
from core.utils.workers import process_task_queue


async def download_sku_pricing_data(job_id: int, skus: list[SKU]):
    async with tcgplayer_service_context() as service:
        with SessionLocal() as session, session.begin():
            print(f"updating skus: {[sku.id for sku in skus]}")
            sku_prices_response = await service.get_sku_prices(
                [sku.tcgplayer_id for sku in skus]
            )

            tcgplayer_id_to_sku: dict[int, SKU] = {
                sku.tcgplayer_id: sku for sku in skus
            }

            tcgplayer_id_to_sku_price = {
                sku_price.sku_id: sku_price for sku_price in sku_prices_response.results
            }

            sku_price_snapshot_values = [
                {
                    "sku_id": tcgplayer_id_to_sku[tcgplayer_id].id,
                    "job_id": job_id,
                    "_lowest_listing_price_amount": tcgplayer_id_to_sku_price[
                        tcgplayer_id
                    ].lowest_listing_price_total,
                    "_lowest_listing_price_currency": "USD",
                    "_market_price_amount": tcgplayer_id_to_sku_price[
                        tcgplayer_id
                    ].market_price,
                    "_market_price_currency": "USD",
                }
                for (tcgplayer_id, sku_price) in tcgplayer_id_to_sku.items()
            ]

            session.execute(insert(SKUPriceSnapshot).values(sku_price_snapshot_values))


async def download_product_price_data():
    with SessionLocal() as session:
        job = SKUPriceSnapshotJob()

        session.add(job)
        session.commit()

        # We do this because we have a maximum number of simultaneous connections we can make to the database.
        # The number 20 was picked arbitrarily, but works quite well.
        task_queue = asyncio.Queue()

        conditions = session.scalars(
            select(Condition.id).where(
                or_(Condition.name == "Near Mint", Condition.name == "Unopened")
            )
        ).all()

        english_language: Language = session.scalar(
            select(Language).where(Language.name == "English")
        )

        skus = session.scalars(
            select(SKU).where(
                and_(
                    SKU.condition_id.in_(conditions),
                    SKU.language_id == english_language.id,
                )
            )
        )

        for partition in skus.yield_per(200).partitions():
            await task_queue.put(
                download_sku_pricing_data(job_id=job.id, skus=list(partition))
            )

        await process_task_queue(task_queue, num_workers=20)


if __name__ == "__main__":
    asyncio.run(
        download_product_price_data(),
    )
