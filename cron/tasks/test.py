import asyncio

from alembic.command import current
from sqlalchemy import select, desc, asc

from core.dao.prices import query_latest_sku_prices
from core.database import SessionLocal
from core.models import SKUPriceSnapshot, SKUPriceSnapshotJob, Product, SKU
from core.services.schemas.schema import ProductType
from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService

async def bruh():
    with SessionLocal() as session:
        most_recent_sku_prices = query_latest_sku_prices().cte()

        # Subquery to get the latest two price snapshots for each SKU
        latest_snapshots = (
            select(
                SKUPriceSnapshot.sku_id,
                SKUPriceSnapshot._market_price_amount,
                SKUPriceSnapshot.job_id,
                SKUPriceSnapshotJob.timestamp
            )
            .join(SKUPriceSnapshotJob)
            .order_by(
                SKUPriceSnapshot.sku_id,
                desc(SKUPriceSnapshotJob.timestamp)
            )
        ).subquery()

        # Self-join to compare current with previous price
        current = select(latest_snapshots).subquery()
        previous = select(latest_snapshots).subquery()

        query = (
            select(
                Product.name,
                current.c._market_price_amount - previous.c._market_price_amount,
                (current.c._market_price_amount - previous.c._market_price_amount) / previous.c._market_price_amount,
                current.c._market_price_amount.label('current_price'),
                previous.c._market_price_amount.label('previous_price'),
            )
            .select_from(current)
            .join(
                previous,
                (current.c.sku_id == previous.c.sku_id) &
                (current.c.timestamp > previous.c.timestamp)
            )
            .join(
                SKU,
                SKU.id == current.c.sku_id,
            )
            .join(
                Product,
                Product.id == SKU.product_id,
            )
            .where(
                current.c._market_price_amount is not None,
                previous.c._market_price_amount is not None,
                (current.c._market_price_amount > previous.c._market_price_amount)
            )
            .order_by(desc((current.c._market_price_amount - previous.c._market_price_amount) / previous.c._market_price_amount))
        )

        result = session.execute(
            query
        ).all()

        for result in result:
            (name, delta, delta_percent, current_price, previous_price) = result

            print(
                f"{name}\n\tdelta: {delta}\n\tpercent: {delta_percent}\n\tcurrent_listing_price: {current_price}\n\tprevious_listing_price: {previous_price}\n")

        print(f"total {len(result)}")

asyncio.run(bruh())

