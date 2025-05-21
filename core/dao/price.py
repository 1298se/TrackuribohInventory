from datetime import UTC, datetime
import uuid
from typing import Sequence, Dict
from dataclasses import dataclass

from sqlalchemy import select, insert
from sqlalchemy.orm import Session

from core.models.price import SKUPriceDataSnapshot


def latest_price_subquery():
    """
    Returns a subquery with the most recent price snapshot per SKU.
    Uses PostgreSQL DISTINCT ON to efficiently retrieve the latest price.

    Returns:
        A SQLAlchemy subquery that can be used in joins, containing:
        - sku_id: The SKU identifier
        - lowest_listing_price_total: The price from the most recent snapshot
    """
    return (
        select(
            SKUPriceDataSnapshot.sku_id,
            SKUPriceDataSnapshot.lowest_listing_price_total,
        )
        .distinct(SKUPriceDataSnapshot.sku_id)
        .order_by(
            SKUPriceDataSnapshot.sku_id,
            SKUPriceDataSnapshot.snapshot_datetime.desc(),
        )
        .subquery()
    )


@dataclass
class SKUPriceRecord:
    """Lightweight DTO for passing (sku_id, price) pairs."""

    sku_id: uuid.UUID
    lowest_listing_price_total: float | None


async def insert_price_snapshots_if_changed(
    session: Session,
    price_records: Sequence[SKUPriceRecord],
    snapshot_dt: datetime | None = None,
) -> int:
    """Insert `SKUPriceDataSnapshot` rows when the price has changed.

    Parameters
    ----------
    session : Session
        Active SQLAlchemy session.
    price_records : Sequence[SKUPriceRecord]
        Iterable of records with the latest price per SKU.
    snapshot_dt : datetime | None
        Timestamp for the snapshots (defaults to now, UTC).
    """

    if not price_records:
        return 0

    snapshot_datetime = snapshot_dt or datetime.now(UTC)

    sku_ids = [rec.sku_id for rec in price_records]

    # Fetch most recent price per SKU in one query
    latest_prices: Dict[uuid.UUID, float | None] = {
        row.sku_id: row.lowest_listing_price_total
        for row in session.execute(
            select(
                SKUPriceDataSnapshot.sku_id,
                SKUPriceDataSnapshot.lowest_listing_price_total,
            )
            .where(SKUPriceDataSnapshot.sku_id.in_(sku_ids))
            .distinct(SKUPriceDataSnapshot.sku_id)
            .order_by(
                SKUPriceDataSnapshot.sku_id,
                SKUPriceDataSnapshot.snapshot_datetime.desc(),
            )
        ).all()
    }

    rows: list[dict] = []
    for rec in price_records:
        if rec.lowest_listing_price_total is None:
            continue
        prev_price = latest_prices.get(rec.sku_id)
        if prev_price is None or prev_price != rec.lowest_listing_price_total:
            rows.append(
                {
                    "sku_id": rec.sku_id,
                    "snapshot_datetime": snapshot_datetime,
                    "lowest_listing_price_total": rec.lowest_listing_price_total,
                }
            )

    if rows:
        session.execute(insert(SKUPriceDataSnapshot), rows)
        session.commit()

    return len(rows)


# What this module exports
__all__ = [
    "latest_price_subquery",
    "SKUPriceRecord",
    "insert_price_snapshots_if_changed",
]
