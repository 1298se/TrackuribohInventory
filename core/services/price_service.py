import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.models.catalog import SKU
from core.models.price import Marketplace
from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService
from core.dao.price import insert_price_snapshots_if_changed, SKUPriceRecord
from core.dao.latest_price import upsert_latest_prices, LatestPriceRecord


async def update_latest_sku_prices(
    session: Session,
    catalog_service: TCGPlayerCatalogService,
    sku_ids: Sequence[uuid.UUID],
    marketplace: Marketplace,
    write_through: bool = False,
) -> int:
    """
    Fetch latest prices from TCGPlayer for the given internal ``sku_ids``.

    Always updates the price cache. Optionally also writes through to historical snapshots.

    Parameters
    ----------
    session : Session
        Active SQLAlchemy session.
    catalog_service : TCGPlayerCatalogService
        Service for fetching prices from TCGPlayer.
    sku_ids : Sequence[uuid.UUID]
        SKU IDs to fetch prices for.
    marketplace : Marketplace
        Marketplace to fetch prices for.
    write_through : bool
        If True, write through to historical snapshots. If False, only update cache.

    Returns
    -------
    int
        Number of cache entries updated.
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

    # Build cache records and history records
    cache_records: list[LatestPriceRecord] = []
    history_records: list[SKUPriceRecord] = []

    for price_data in sku_prices_response.results:
        internal_id = internal_by_tcg_id.get(price_data.sku_id)
        if internal_id is None or price_data.lowest_listing_price_total is None:
            continue

        # Always build cache record
        cache_records.append(
            LatestPriceRecord(
                sku_id=internal_id,
                marketplace=marketplace,
                lowest_listing_price_total=price_data.lowest_listing_price_total,
            )
        )

        # Build history record if write-through mode
        if write_through:
            history_records.append(
                SKUPriceRecord(
                    sku_id=internal_id,
                    lowest_listing_price_total=price_data.lowest_listing_price_total,
                )
            )

    # Always update cache
    cache_updated = upsert_latest_prices(session, cache_records)

    # Optionally write through to history
    if write_through:
        await insert_price_snapshots_if_changed(
            session, history_records, marketplace=marketplace
        )

    return cache_updated
