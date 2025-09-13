import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import List, Optional, TypedDict

from sqlalchemy import select, desc, func
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

from core.models.listings import SalesListing
from core.models.price import Marketplace


class SalesDataRow(TypedDict):
    """Type definition for sales data used in upsert_sales_listings."""

    sku_id: uuid.UUID
    marketplace: Marketplace
    sale_date: datetime
    sale_price: Decimal
    shipping_price: Optional[Decimal]
    quantity: int


def upsert_sales_listings(
    session: Session,
    sales_data: List[SalesDataRow],
) -> List[SalesListing]:
    """
    Upsert sales listings for any SKUs and marketplaces.

    Args:
        session: Database session
        sales_data: List of SalesDataRow dictionaries containing sku_id, marketplace, and sale data

    Note: condition, language, and printing info is available via the SKU relationships

    Returns:
        List of SalesListing records that were inserted (duplicates are ignored and not returned)
    """
    if not sales_data:
        return []

    # Use PostgreSQL upsert to handle duplicates and return inserted rows
    stmt = (
        insert(SalesListing)
        .values(sales_data)
        .on_conflict_do_nothing()
        .returning(SalesListing)
    )

    return session.scalars(stmt).all()


def get_sales_event_rate(
    session: Session,
    sku_id: uuid.UUID,
    marketplace: Marketplace,
    days_back: int = 30,
) -> float:
    """
    Calculate the lambda_hat (sales event rate) for a SKU over the last N days.

    Args:
        session: Database session
        sku_id: UUID of the SKU
        marketplace: Marketplace enum
        days_back: Number of days to look back for rate calculation

    Returns:
        Sales events per day (lambda_hat)
    """
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_back)

    query = (
        select(func.count())
        .select_from(SalesListing)
        .where(
            SalesListing.sku_id == sku_id,
            SalesListing.marketplace == marketplace,
            SalesListing.sale_date >= cutoff_date,
        )
    )

    result = session.execute(query)
    sales_count = result.scalar()

    # Return events per day
    return sales_count / days_back


def get_recent_sales_for_skus(
    session: Session,
    sku_ids: List[uuid.UUID],
    marketplace: Marketplace,
    since_date: datetime,
    limit_per_sku: int = 100,
) -> dict[uuid.UUID, List[SalesListing]]:
    """
    Bulk load recent sales listings for multiple SKUs.

    Args:
        session: Database session
        sku_ids: List of SKU UUIDs to fetch sales for
        marketplace: Marketplace enum
        since_date: datetime to filter sales after this date
        limit_per_sku: Maximum number of records per SKU

    Returns:
        Dictionary mapping sku_id to list of SalesListing objects
    """
    if not sku_ids:
        return {}

    # Query all sales for the given SKUs and marketplace
    query = (
        select(SalesListing)
        .where(
            SalesListing.sku_id.in_(sku_ids),
            SalesListing.marketplace == marketplace,
            SalesListing.sale_date >= since_date,
        )
        .order_by(SalesListing.sku_id, desc(SalesListing.sale_date))
    )

    result = session.execute(query)
    all_sales = result.scalars().all()

    # Group by sku_id and limit per SKU
    sales_by_sku = {}
    for sale in all_sales:
        if sale.sku_id not in sales_by_sku:
            sales_by_sku[sale.sku_id] = []

        if len(sales_by_sku[sale.sku_id]) < limit_per_sku:
            sales_by_sku[sale.sku_id].append(sale)

    return sales_by_sku


def get_sales_event_counts_for_skus(
    session: Session,
    sku_ids: List[uuid.UUID],
    marketplace: Marketplace,
    days_back: int = 30,
) -> dict[uuid.UUID, int]:
    """
    Return a mapping of sku_id -> total units sold (quantity) over the last ``days_back`` days.

    Args:
        session: Database session
        sku_ids: List of SKU UUIDs
        marketplace: Marketplace enum
        days_back: Lookback window in days (default: 30)

    Returns:
        Dict[uuid.UUID, int] of total quantity per SKU (0 if none)
    """
    if not sku_ids:
        return {}

    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_back)

    rows = session.execute(
        select(SalesListing.sku_id, func.sum(SalesListing.quantity))
        .where(
            SalesListing.sku_id.in_(sku_ids),
            SalesListing.marketplace == marketplace,
            SalesListing.sale_date >= cutoff_date,
        )
        .group_by(SalesListing.sku_id)
    ).all()

    quantities_by_sku: dict[uuid.UUID, int] = {
        sku_id: int(total_qty) if total_qty is not None else 0
        for sku_id, total_qty in rows
    }

    # Ensure all requested SKUs are present with default 0
    for sku_id in sku_ids:
        if sku_id not in quantities_by_sku:
            quantities_by_sku[sku_id] = 0

    return quantities_by_sku
