from datetime import UTC, datetime
import uuid

from sqlalchemy import Select, select, func, and_

from core.dao.skus import get_skus_by_id
from core.database import upsert
from core.models import SKUPriceSnapshot, SKUPriceSnapshotJob, SKULatestPriceData, SKU
from sqlalchemy.orm import Session, load_only

from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService

async def update_latest_sku_prices(session: Session, catalog_service: TCGPlayerCatalogService, sku_ids: list[uuid.UUID]):
    # Directly query only the needed fields (id and tcgplayer_id) to avoid loading full objects
    skus = session.execute(select(SKU.id, SKU.tcgplayer_id).where(SKU.id.in_(sku_ids))).all()

    # Build a map from tcgplayer_id -> sku_id
    sku_map = {tcgplayer_id: id for id, tcgplayer_id in skus}

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
    session.commit() # Re-enabled commit
