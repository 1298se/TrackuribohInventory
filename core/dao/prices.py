from datetime import UTC, datetime
import uuid

from sqlalchemy import Select, select, func, and_

from core.dao.skus import get_skus_by_id
from core.database import upsert
from core.models import SKUPriceSnapshot, SKUPriceSnapshotJob, SKULatestPriceData
from sqlalchemy.orm import Session

from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService

async def update_latest_sku_prices(session: Session, catalog_service: TCGPlayerCatalogService, sku_ids: list[uuid.UUID]):
    # Build a map from tcgplayer_id -> sku_id
    sku_map = {sku.tcgplayer_id: sku.id for sku in get_skus_by_id(session, ids=sku_ids)}

    sku_prices_response = await catalog_service.get_sku_prices(sku_map.keys())


    # Prepare the data for a bulk update
    updates = []
    for price_data in sku_prices_response.results:
        sku_tcgplayer_id = price_data.sku_id

        updates.append({
            "sku_id": sku_map[sku_tcgplayer_id],
            "lowest_listing_price_amount": price_data.lowest_listing_price_total,
            "market_price_amount": price_data.market_price,
            "updated_at": datetime.now(UTC)
        })

    # Perform bulk update on SKULatestPriceData
    session.execute(upsert(model=SKULatestPriceData, values=updates, index_elements=[SKULatestPriceData.sku_id]))
    session.commit()
