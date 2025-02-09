from sqlalchemy import func, select, Select

from core.dao.prices import query_latest_sku_prices
from core.models import SKU
from core.models.inventory import Transaction, LineItem


def query_inventory_items() -> Select:
    """
    Query inventory items with their quantities and prices.
    
    Returns:
        Select query that returns rows matching InventoryItem TypedDict structure
        when executed
    """
    total_quantity = func.sum(
        LineItem.remaining_quantity,
    ).label('total_quantity')

    total_cost = func.sum(
        LineItem._price_per_item_amount * LineItem.remaining_quantity,
    ).label('total_cost')

    inventory_sku_quantity_cte = (
        select(
            LineItem.sku_id,
            total_quantity,
            total_cost,
        )
        .join(Transaction)
        .group_by(LineItem.sku_id)
        .having(total_quantity > 0)
    ).cte()

    latest_sku_prices_cte = query_latest_sku_prices().cte()

    query = select(
        SKU,
        inventory_sku_quantity_cte.c.total_quantity,
        inventory_sku_quantity_cte.c.total_cost,
        latest_sku_prices_cte.c._lowest_listing_price_amount,
        latest_sku_prices_cte.c._market_price_amount,
    ).join(
        inventory_sku_quantity_cte, SKU.id == inventory_sku_quantity_cte.c.sku_id
    ).outerjoin(
        latest_sku_prices_cte, SKU.id == latest_sku_prices_cte.c.sku_id
    )

    return query
