from sqlalchemy import func, select, Select, CTE, and_, String
from typing import Tuple, Optional
from decimal import Decimal

from core.models import SKU, SKULatestPriceData, Product, Set, Condition, Printing
from core.models.transaction import Transaction, LineItem
from core.utils.search import create_product_set_fts_vector, create_ts_query

def get_sku_cost_quantity_cte() -> CTE:
    total_quantity = func.sum(
        LineItem.remaining_quantity,
    ).label('total_quantity')

    total_cost = func.sum(
        LineItem.unit_price_amount * LineItem.remaining_quantity,
    ).label('total_cost')

    return  (
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
InventoryQueryResultRow = Tuple[SKU, int, Decimal, Optional[SKULatestPriceData]]

def query_inventory_items(query: Optional[str] = None) -> Select:
    """
    Query inventory items with their quantities and prices.
    
    Returns:
        Select query that returns rows matching InventoryItem TypedDict structure
        when executed
    """
    inventory_sku_quantity_cte = get_sku_cost_quantity_cte()

    sql_query = select(
        SKU,
        inventory_sku_quantity_cte.c.total_quantity,
        inventory_sku_quantity_cte.c.total_cost,
        SKULatestPriceData,
    ).join(
        inventory_sku_quantity_cte, SKU.id == inventory_sku_quantity_cte.c.sku_id
    ).outerjoin(
        SKULatestPriceData, SKU.id == SKULatestPriceData.sku_id
    )

    if query:
        # Join necessary tables for searching
        sql_query = sql_query.join( 
            Product, SKU.product_id == Product.id
        ).join(
            Set, Product.set_id == Set.id
        ).join(
            Condition, SKU.condition_id == Condition.id
        ).join(
            Printing, SKU.printing_id == Printing.id
        )

        # Use utility function to create base combined TS vector (Product, Set)
        combined_ts_vector = create_product_set_fts_vector()

        # Condition Name (Weight D)
        condition_name_ts = func.setweight(func.to_tsvector('english', func.coalesce(Condition.name, '')), 'D')
        combined_ts_vector = combined_ts_vector.op('||')(condition_name_ts)

        # Printing Name (Weight D)
        printing_name_ts = func.setweight(func.to_tsvector('english', func.coalesce(Printing.name, '')), 'D')
        combined_ts_vector = combined_ts_vector.op('||')(printing_name_ts)
        
        # Use utility function to create TS query
        ts_query_func = create_ts_query(query)
        # Apply FTS filter
        sql_query = sql_query.where(combined_ts_vector.op('@@')(ts_query_func))

    return sql_query
