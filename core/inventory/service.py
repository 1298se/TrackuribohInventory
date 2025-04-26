from sqlalchemy import func, select
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from core.inventory.query_builder import build_inventory_query
from core.dao.transaction import get_total_sales_profit


def get_inventory_metrics(session: Session, catalog_id: Optional[UUID] = None):
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
