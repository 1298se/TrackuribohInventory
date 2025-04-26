from sqlalchemy import func, select
from sqlalchemy.orm import Session
from typing import Optional, TypedDict
from uuid import UUID
from datetime import date, timedelta

from core.inventory.query_builder import build_inventory_query
from core.dao.transaction import get_total_sales_profit
from core.models.inventory_snapshot import InventoryDailySnapshot


class InventoryMetrics(TypedDict):
    """TypedDict representing aggregated inventory metrics."""

    number_of_items: int
    total_inventory_cost: float
    total_market_value: float
    unrealised_profit: float
    lifetime_profit: float
    currency: str


# TypedDict for a single historical inventory snapshot row
class InventoryHistoryEntry(TypedDict):
    """TypedDict representing a historical snapshot row."""

    snapshot_date: date
    total_cost: float
    total_market_value: float
    unrealised_profit: float


def get_inventory_metrics(
    session: Session, catalog_id: Optional[UUID] = None
) -> InventoryMetrics:
    """Return aggregate inventory metrics for a given catalogue (or all)."""

    inventory_subq = build_inventory_query(query=None, catalog_id=catalog_id).subquery()

    stmt = select(
        func.coalesce(func.sum(inventory_subq.c.total_quantity), 0).label(
            "number_of_items"
        ),
        func.coalesce(func.sum(inventory_subq.c.total_cost), 0).label(
            "total_inventory_cost"
        ),
        func.coalesce(
            func.sum(
                inventory_subq.c.total_quantity
                * inventory_subq.c.lowest_listing_price_amount
            ),
            0,
        ).label("total_market_value"),
    )

    row = session.execute(stmt).first()

    num_items = int(row.number_of_items)
    total_cost = float(row.total_inventory_cost)
    total_market = float(row.total_market_value)
    unrealised = total_market - total_cost
    # Calculate lifetime realised profit using transaction DAO helper
    _, profit_decimal = get_total_sales_profit(session)
    lifetime_profit = float(profit_decimal)

    return {
        "number_of_items": num_items,
        "total_inventory_cost": total_cost,
        "total_market_value": total_market,
        "unrealised_profit": unrealised,
        "lifetime_profit": lifetime_profit,
        "currency": "USD",
    }


def get_inventory_history(
    session: Session, catalog_id: UUID | None, days: int | None = None
) -> list[InventoryHistoryEntry]:
    """Return historical snapshot rows for the given catalogue.

    If ``catalog_id`` is ``None`` we aggregate across catalogues for each date.
    ``days`` can be ``None`` to indicate *all time*.
    """

    # Determine lower bound date if a time window is requested
    if days is not None:
        since = date.today() - timedelta(days=days)
    else:
        since = None

    if catalog_id is None:
        # Aggregate totals across all catalogues per date
        stmt = (
            select(
                InventoryDailySnapshot.snapshot_date.label("snapshot_date"),
                func.sum(InventoryDailySnapshot.total_cost).label("total_cost"),
                func.sum(InventoryDailySnapshot.total_market_value).label(
                    "total_market_value"
                ),
                func.sum(InventoryDailySnapshot.unrealised_profit).label(
                    "unrealised_profit"
                ),
            )
            .group_by(InventoryDailySnapshot.snapshot_date)
            .order_by(InventoryDailySnapshot.snapshot_date)
        )

        if since:
            stmt = stmt.where(InventoryDailySnapshot.snapshot_date >= since)

        rows = session.execute(stmt).mappings().all()
        return [dict(row) for row in rows]

    # Specific catalogue – return raw rows for that catalogue
    stmt = (
        select(InventoryDailySnapshot)
        .where(InventoryDailySnapshot.catalog_id == catalog_id)
        .order_by(InventoryDailySnapshot.snapshot_date)
    )
    if since:
        stmt = stmt.where(InventoryDailySnapshot.snapshot_date >= since)

    return session.scalars(stmt).all()
