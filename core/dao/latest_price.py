from datetime import datetime
from typing import Sequence, TypedDict
import uuid

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from core.models.price import SKULatestPrice, Marketplace


class LatestPriceRecord(TypedDict):
    """TypedDict for passing latest price records that matches the database schema."""

    sku_id: uuid.UUID
    marketplace: Marketplace
    lowest_listing_price_total: float


def upsert_latest_prices(
    session: Session,
    price_records: Sequence[LatestPriceRecord],
) -> int:
    """
    Upsert price records into sku_latest_price.

    Parameters
    ----------
    session : Session
        Active SQLAlchemy session.
    price_records : Sequence[LatestPriceRecord]
        Sequence of latest price records to upsert.

    Returns
    -------
    int
        Number of rows affected (inserted or updated).
    """
    if not price_records:
        return 0

    # Use SQLAlchemy's insert with on_conflict_do_update
    stmt = insert(SKULatestPrice).values(price_records)

    # Simple upsert - updated_at will be automatically set by database
    upsert_stmt = stmt.on_conflict_do_update(
        index_elements=["sku_id", "marketplace"],
        set_={
            "lowest_listing_price_total": stmt.excluded.lowest_listing_price_total,
        },
    )

    result = session.execute(upsert_stmt)
    session.commit()

    return result.rowcount


def get_today_updated_sku_ids(
    session: Session, marketplace: Marketplace, cutoff_datetime: datetime
) -> list[uuid.UUID]:
    """
    Get SKU IDs that were updated today or after the given cutoff for a marketplace.

    Parameters
    ----------
    session : Session
        Active SQLAlchemy session.
    marketplace : Marketplace
        The marketplace to filter by.
    cutoff_datetime : datetime
        Only return SKUs updated at or after this time.

    Returns
    -------
    list[uuid.UUID]
        List of SKU IDs that were updated recently.
    """
    query = select(SKULatestPrice.sku_id).where(
        SKULatestPrice.marketplace == marketplace,
        SKULatestPrice.updated_at >= cutoff_datetime,
    )

    return list(session.execute(query).scalars())


def get_latest_prices_subquery():
    """
    Returns a subquery for getting latest prices from sku_latest_price table.

    This replaces the old latest_price_subquery() that used SKUPriceDataSnapshot.

    Returns:
        A SQLAlchemy subquery that can be used in joins, containing:
        - sku_id: The SKU identifier
        - lowest_listing_price_total: The cached latest price
    """
    return (
        select(
            SKULatestPrice.sku_id,
            SKULatestPrice.lowest_listing_price_total,
        )
        .where(SKULatestPrice.marketplace == Marketplace.TCGPLAYER)
        .subquery()
    )


def bulk_fetch_latest_prices(
    session: Session,
    sku_ids: list[uuid.UUID],
    marketplace: Marketplace = Marketplace.TCGPLAYER,
) -> dict[uuid.UUID, float]:
    """
    Bulk fetch latest prices for a list of SKU IDs.

    Parameters
    ----------
    session : Session
        Active SQLAlchemy session.
    sku_ids : list[uuid.UUID]
        List of SKU IDs to fetch prices for.
    marketplace : Marketplace, optional
        Marketplace to filter by, defaults to TCGPLAYER.

    Returns
    -------
    dict[uuid.UUID, float]
        Mapping of sku_id -> latest_price
    """
    if not sku_ids:
        return {}

    query = select(
        SKULatestPrice.sku_id, SKULatestPrice.lowest_listing_price_total
    ).where(
        SKULatestPrice.sku_id.in_(sku_ids), SKULatestPrice.marketplace == marketplace
    )

    result = session.execute(query).all()

    return {row.sku_id: float(row.lowest_listing_price_total) for row in result}
