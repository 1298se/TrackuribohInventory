import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.models.catalog import SKU
from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService
from core.dao.price import insert_price_snapshots_if_changed, SKUPriceRecord

__all__ = ["update_latest_sku_prices"]


async def update_latest_sku_prices(
    session: Session,
    catalog_service: TCGPlayerCatalogService,
    sku_ids: Sequence[uuid.UUID],
) -> int:
    """
    Fetch latest prices from TCGPlayer for the given internal ``sku_ids`` and inserts new price snapshots.

    Returns the number of snapshots inserted.
    """

    if not sku_ids:
        return 0

    # Map tcgplayer_id -> sku_id for fast lookup.
    skus_result = session.execute(
        select(SKU.id, SKU.tcgplayer_id).where(SKU.id.in_(sku_ids))
    ).all()

    if not skus_result:
        return 0

    internal_by_tcg_id: dict[int, uuid.UUID] = {
        tcgplayer_id: internal_id for internal_id, tcgplayer_id in skus_result
    }

    # Pull pricing from TCGPlayer
    sku_prices_response = await catalog_service.get_sku_prices(
        list(internal_by_tcg_id.keys())
    )

    # Build the list of (internal_sku_id, price) pairs
    price_records: list[SKUPriceRecord] = []
    for price_data in sku_prices_response.results:
        internal_id = internal_by_tcg_id.get(price_data.sku_id)
        if internal_id is None:
            continue
        price_records.append(
            SKUPriceRecord(
                sku_id=internal_id,
                lowest_listing_price_total=price_data.lowest_listing_price_total,
            )
        )

    inserted = await insert_price_snapshots_if_changed(session, price_records)
    return inserted
