import asyncio

from sqlalchemy import select

from src.models.catalog import SKU, Condition, Language
from core.database import SessionLocal
from src.utils import create_workers


async def update_sku_prices():
    with SessionLocal() as session:
        pass


async def update_prices():
    with SessionLocal() as session:
        # We do this because we have a maximum number of simultaneous connections we can make to the database.
        # The number 20 was picked arbitrarily, but works quite well.
        task_queue = asyncio.Queue(maxsize=20)

        worker_tasks = create_workers(count=20, queue=task_queue)

        near_mint_condition: Condition = session.scalar(select(Condition).where(Condition.name == "Near Mint"))
        english_language: Language = session.scalar(select(Language).where(Language.name == "English"))

        near_mint_english_skus = session.scalars(
            select(SKU).where(SKU.condition_id == near_mint_condition.id and SKU.language_id == english_language.id)
        )

if __name__ == '__main__':
    asyncio.run(
        update_prices(),
    )
