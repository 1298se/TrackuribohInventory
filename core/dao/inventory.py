from sqlalchemy import func, select, Select, CTE
from typing import Optional, TypedDict
from decimal import Decimal

from core.models import SKU, SKULatestPriceData
from core.models.transaction import Transaction, LineItem


def get_sku_cost_quantity_cte() -> CTE:
    total_quantity = func.sum(
        LineItem.remaining_quantity,
    ).label("total_quantity")

    total_cost = func.sum(
        LineItem.unit_price_amount * LineItem.remaining_quantity,
    ).label("total_cost")

    return (
        select(
            LineItem.sku_id,
            total_quantity,
            total_cost,
        )
        .join(Transaction)
        .group_by(LineItem.sku_id)
        .having(total_quantity > 0)
    ).cte()


# Added type alias definition
class InventoryQueryResultRow(TypedDict):
    sku: SKU
    total_quantity: int
    total_cost: Decimal
    latest_price_data: Optional[SKULatestPriceData]


def query_inventory_items() -> Select:
    """
    Query inventory items with their quantities and prices. Doesn't include FTS.

    Returns:
        Select query that returns rows matching InventoryItem TypedDict structure
        when executed
    """
    inventory_sku_quantity_cte = get_sku_cost_quantity_cte()

    sql_query = (
        select(
            SKU,
            inventory_sku_quantity_cte.c.total_quantity,
            inventory_sku_quantity_cte.c.total_cost,
            SKULatestPriceData,
        )
        .join(inventory_sku_quantity_cte, SKU.id == inventory_sku_quantity_cte.c.sku_id)
        .outerjoin(SKULatestPriceData, SKU.id == SKULatestPriceData.sku_id)
    )

    return sql_query
