from datetime import UTC, datetime, date, timedelta
from typing import Union
import uuid
from uuid import UUID
from typing import Sequence, Dict
from dataclasses import dataclass

from sqlalchemy import select, insert
from sqlalchemy.orm import Session

from core.models.price import SKUPriceDataSnapshot, Marketplace


def latest_price_subquery():
    """
    Returns a subquery with the most recent price snapshot per SKU.
    Uses PostgreSQL DISTINCT ON to efficiently retrieve the latest price.

    This query is optimized by the covering index 'ix_sku_price_snapshot_covering'
    which includes (sku_id, snapshot_datetime DESC, lowest_listing_price_total),
    allowing PostgreSQL to satisfy the entire query from the index without
    accessing the table data.

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
        .where(SKUPriceDataSnapshot.marketplace == Marketplace.TCGPLAYER)
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
            .where(SKUPriceDataSnapshot.marketplace == Marketplace.TCGPLAYER)
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
                    "marketplace": Marketplace.TCGPLAYER,
                    "snapshot_datetime": snapshot_datetime,
                    "lowest_listing_price_total": rec.lowest_listing_price_total,
                }
            )

    if rows:
        session.execute(insert(SKUPriceDataSnapshot), rows)
        session.commit()

    return len(rows)


def price_24h_ago_subquery():
    """
    Returns a subquery with the most recent price snapshot per SKU from 24 hours ago.
    Gets the closest snapshot on or before exactly 24 hours from now.

    Returns:
        A SQLAlchemy subquery that can be used in joins, containing:
        - sku_id: The SKU identifier
        - lowest_listing_price_total: The price from the most recent snapshot 24 hours ago
    """
    twenty_four_hours_ago = datetime.now(UTC) - timedelta(hours=24)

    return (
        select(
            SKUPriceDataSnapshot.sku_id,
            SKUPriceDataSnapshot.lowest_listing_price_total,
        )
        .where(SKUPriceDataSnapshot.marketplace == Marketplace.TCGPLAYER)
        .where(SKUPriceDataSnapshot.snapshot_datetime <= twenty_four_hours_ago)
        .distinct(SKUPriceDataSnapshot.sku_id)
        .order_by(
            SKUPriceDataSnapshot.sku_id,
            SKUPriceDataSnapshot.snapshot_datetime.desc(),
        )
        .subquery()
    )


def date_to_datetime_utc(d: Union[date, datetime]) -> datetime:
    """Convert a date to a UTC datetime at midnight."""
    if isinstance(d, datetime):
        return d.replace(tzinfo=UTC) if d.tzinfo is None else d
    return datetime.combine(d, datetime.min.time()).replace(tzinfo=UTC)


@dataclass
class PriceSnapshot:
    """Raw price snapshot data from the database."""

    snapshot_datetime: datetime
    lowest_listing_price_total: float | None


def fetch_sku_price_snapshots(
    session: Session,
    sku_id: uuid.UUID,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    days: int | None = None,
) -> tuple[list[PriceSnapshot], PriceSnapshot | None]:
    """
    Fetch raw price snapshots for a specific SKU over a date range.

    Parameters
    ----------
    session : Session
        Active SQLAlchemy session.
    sku_id : uuid.UUID
        The SKU to get price history for.
    start_date : datetime | None
        Start of the date range (defaults to 30 days ago if not provided).
    end_date : datetime | None
        End of the date range (defaults to now).
    days : int | None
        Number of days back from now (overrides start_date if provided).

    Returns
    -------
    tuple[list[PriceSnapshot], PriceSnapshot | None]
        A tuple containing:
        - List of price snapshots within the date range, ordered by datetime ascending
        - Initial price snapshot before the start date (for forward-filling), or None
    """
    # Handle date range
    if days is not None:
        start_date = datetime.now(UTC) - timedelta(days=days)
        end_date = datetime.now(UTC)
    elif start_date is None and end_date is None:
        # Default to 30 days
        start_date = datetime.now(UTC) - timedelta(days=30)
        end_date = datetime.now(UTC)

    # Get the most recent price before or at the start date
    initial_price_query = (
        select(SKUPriceDataSnapshot)
        .where(SKUPriceDataSnapshot.sku_id == sku_id)
        .where(SKUPriceDataSnapshot.marketplace == Marketplace.TCGPLAYER)
        .where(SKUPriceDataSnapshot.snapshot_datetime <= start_date)
        .order_by(SKUPriceDataSnapshot.snapshot_datetime.desc())
        .limit(1)
    )
    initial_price_result = session.execute(initial_price_query).scalar_one_or_none()
    initial_price = (
        PriceSnapshot(
            snapshot_datetime=initial_price_result.snapshot_datetime,
            lowest_listing_price_total=initial_price_result.lowest_listing_price_total,
        )
        if initial_price_result
        else None
    )

    # Get all price changes within the date range
    changes_query = (
        select(SKUPriceDataSnapshot)
        .where(SKUPriceDataSnapshot.sku_id == sku_id)
        .where(SKUPriceDataSnapshot.marketplace == Marketplace.TCGPLAYER)
        .where(SKUPriceDataSnapshot.snapshot_datetime > start_date)
        .where(SKUPriceDataSnapshot.snapshot_datetime <= end_date)
        .order_by(SKUPriceDataSnapshot.snapshot_datetime.asc())
    )
    price_changes_raw = list(session.execute(changes_query).scalars().all())

    # Convert to PriceSnapshot objects
    price_changes = [
        PriceSnapshot(
            snapshot_datetime=snapshot.snapshot_datetime,
            lowest_listing_price_total=snapshot.lowest_listing_price_total,
        )
        for snapshot in price_changes_raw
    ]

    return price_changes, initial_price


def normalize_price_history(
    price_changes: list[PriceSnapshot],
    initial_price: PriceSnapshot | None,
    start_date: datetime,
    end_date: datetime,
) -> list[dict]:
    """
    Normalize price history data into daily price points with forward-filling.

    Forward-fills prices (carries forward the last known price) and returns
    at most one price per day.

    Parameters
    ----------
    price_changes : list[PriceSnapshot]
        List of price snapshots within the date range, ordered by datetime ascending.
    initial_price : PriceSnapshot | None
        Initial price snapshot before the start date (for forward-filling), or None.
    start_date : datetime
        Start of the date range.
    end_date : datetime
        End of the date range.

    Returns
    -------
    list[dict]
        List of price data points with 'datetime' and 'price' keys,
        ordered by datetime ascending, with at most one entry per day.
    """
    result = []
    current_date = start_date.date()
    end_date = end_date.date()

    # Track the current price
    current_price = initial_price.lowest_listing_price_total if initial_price else None

    # Helper to add a price point
    def add_price_point(date_obj: date, price: float):
        result.append(
            {
                "datetime": date_to_datetime_utc(date_obj).isoformat(),
                "price": float(price),
            }
        )

    # Add initial price if available
    if current_price is not None:
        add_price_point(current_date, current_price)

    # Process each day
    change_index = 0
    current_date += timedelta(days=1)

    while current_date <= end_date:
        day_start_dt = date_to_datetime_utc(current_date)
        day_end_dt = day_start_dt + timedelta(days=1) - timedelta(microseconds=1)

        # Find the last price change of the day
        last_price_of_day = None
        while (
            change_index < len(price_changes)
            and price_changes[change_index].snapshot_datetime <= day_end_dt
        ):
            if price_changes[change_index].snapshot_datetime >= day_start_dt:
                last_price_of_day = price_changes[
                    change_index
                ].lowest_listing_price_total
            current_price = price_changes[change_index].lowest_listing_price_total
            change_index += 1

        # Add a data point using the most recent price
        price_to_use = (
            last_price_of_day if last_price_of_day is not None else current_price
        )
        if price_to_use is not None:
            add_price_point(current_date, price_to_use)

        current_date += timedelta(days=1)

    return result


def fetch_bulk_sku_price_histories(
    session: Session, sku_ids: list[UUID], start_date: datetime, end_date: datetime
) -> dict[UUID, list[dict]]:
    """
    Fetch price histories for multiple SKUs in bulk to avoid N+1 queries.

    Returns a dict mapping sku_id -> list of price history data points.
    """
    if not sku_ids:
        return {}

    # Bulk fetch all price changes for all SKUs in the date range
    price_changes_query = (
        select(SKUPriceDataSnapshot)
        .where(
            SKUPriceDataSnapshot.sku_id.in_(sku_ids),
            SKUPriceDataSnapshot.marketplace == Marketplace.TCGPLAYER,
            SKUPriceDataSnapshot.snapshot_datetime > start_date,
            SKUPriceDataSnapshot.snapshot_datetime <= end_date,
        )
        .order_by(
            SKUPriceDataSnapshot.sku_id, SKUPriceDataSnapshot.snapshot_datetime.asc()
        )
    )

    # Bulk fetch initial prices for all SKUs (prices before start_date for forward-filling)
    # Use a window function to get the latest price per SKU before start_date
    from sqlalchemy import func

    initial_prices_subquery = (
        select(
            SKUPriceDataSnapshot,
            func.row_number()
            .over(
                partition_by=SKUPriceDataSnapshot.sku_id,
                order_by=SKUPriceDataSnapshot.snapshot_datetime.desc(),
            )
            .label("rn"),
        ).where(
            SKUPriceDataSnapshot.sku_id.in_(sku_ids),
            SKUPriceDataSnapshot.marketplace == Marketplace.TCGPLAYER,
            SKUPriceDataSnapshot.snapshot_datetime <= start_date,
        )
    ).subquery()

    initial_prices_query = select(
        initial_prices_subquery.c.sku_id,
        initial_prices_subquery.c.snapshot_datetime,
        initial_prices_subquery.c.lowest_listing_price_total,
    ).where(initial_prices_subquery.c.rn == 1)

    # Execute both queries
    price_changes_result = session.execute(price_changes_query).scalars().all()
    initial_prices_result = session.execute(initial_prices_query).all()

    # Group results by SKU ID
    price_changes_by_sku: dict[UUID, list] = {}
    initial_prices_by_sku: dict[UUID, object] = {}

    for change in price_changes_result:
        if change.sku_id not in price_changes_by_sku:
            price_changes_by_sku[change.sku_id] = []
        price_changes_by_sku[change.sku_id].append(change)

    # Process initial prices - these are now tuples (sku_id, snapshot_datetime, lowest_listing_price_total)
    for sku_id, snapshot_datetime, lowest_listing_price_total in initial_prices_result:
        if sku_id not in initial_prices_by_sku:
            # Create a simple object with the necessary attributes
            class InitialPrice:
                def __init__(
                    self, sku_id, snapshot_datetime, lowest_listing_price_total
                ):
                    self.sku_id = sku_id
                    self.snapshot_datetime = snapshot_datetime
                    self.lowest_listing_price_total = lowest_listing_price_total

            initial_prices_by_sku[sku_id] = InitialPrice(
                sku_id, snapshot_datetime, lowest_listing_price_total
            )

    # Generate normalized price history for each SKU
    result = {}
    for sku_id in sku_ids:
        price_changes = price_changes_by_sku.get(sku_id, [])
        initial_price = initial_prices_by_sku.get(sku_id)

        price_data = normalize_price_history(
            price_changes=price_changes,
            initial_price=initial_price,
            start_date=start_date,
            end_date=end_date,
        )

        result[sku_id] = price_data

    return result
