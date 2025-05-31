from sqlalchemy import func, select, Select, CTE
from typing import Optional, TypedDict
from decimal import Decimal
from uuid import UUID

from core.models.catalog import SKU, Catalog, Set, Product, Condition, Printing
from core.models.transaction import Transaction, LineItem
from core.dao.price import latest_price_subquery, price_24h_ago_subquery
from core.dao.catalog import create_product_set_fts_vector, create_ts_query


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


def query_inventory_catalogs() -> Select:
    # Select only sku ids from the inventory items query as a subquery
    sku_ids_subquery = query_inventory_items().with_only_columns(SKU.id).subquery()

    # Find which catalogs these SKUs belong to using the subquery
    catalogs_query = (
        select(Catalog)
        .distinct()
        .join(Set, Catalog.id == Set.catalog_id)
        .join(Product, Set.id == Product.set_id)
        .join(SKU, Product.id == SKU.product_id)
        .where(SKU.id.in_(sku_ids_subquery))
        .order_by(Catalog.display_name)
    )
    return catalogs_query


def query_inventory_items() -> Select[InventoryQueryResultRow]:
    """
    Query inventory items with their quantities and costs. Doesn't include FTS or price data.

    Returns:
        Select query that returns rows matching InventoryItem TypedDict structure
        when executed
    """
    inventory_sku_quantity_cte = get_sku_cost_quantity_cte()

    sql_query = select(
        SKU,
        inventory_sku_quantity_cte.c.total_quantity,
        inventory_sku_quantity_cte.c.total_cost,
    ).join(inventory_sku_quantity_cte, SKU.id == inventory_sku_quantity_cte.c.sku_id)

    return sql_query


def build_inventory_query(
    query: Optional[str] = None, catalog_id: Optional[UUID] = None
):
    """Return a SQLAlchemy selectable that replicates the joins and filters used by
    `get_inventory` in app.routes.inventory.api .

    The returned query starts from `query_inventory_items()` which returns pure inventory data
    (SKU, quantity, cost), then adds latest price data and applies optional catalogue or
    full-text search filters.
    """
    inventory_query = query_inventory_items()

    # Add latest price data join
    latest_price = latest_price_subquery()
    price_24h_ago = price_24h_ago_subquery()

    inventory_query = (
        inventory_query.add_columns(
            latest_price.c.lowest_listing_price_total,
            price_24h_ago.c.lowest_listing_price_total.label("price_24h_ago"),
        )
        .outerjoin(latest_price, SKU.id == latest_price.c.sku_id)
        .outerjoin(price_24h_ago, SKU.id == price_24h_ago.c.sku_id)
    )

    # Map model -> join condition, mirroring the original logic
    product_join = (Product, SKU.product_id == Product.id)
    set_join = (Set, Product.set_id == Set.id)
    condition_join = (Condition, SKU.condition_id == Condition.id)
    printing_join = (Printing, SKU.printing_id == Printing.id)

    required_joins = {}

    # Apply catalogue filter first (does not require FTS joins)
    if catalog_id:
        required_joins[Product] = product_join
        required_joins[Set] = set_join
        inventory_query = inventory_query.where(Set.catalog_id == catalog_id)

    if query:
        required_joins[Product] = product_join
        required_joins[Set] = set_join
        required_joins[Condition] = condition_join
        required_joins[Printing] = printing_join

    # Apply joins in insertion order (Python 3.7+ preserves dict order)
    for target, onclause in required_joins.values():
        inventory_query = inventory_query.join(target, onclause)

    # Apply full-text search if query present
    if query:
        combined_ts_vector = create_product_set_fts_vector()
        condition_name_ts = func.setweight(
            func.to_tsvector("english", func.coalesce(Condition.name, "")), "D"
        )
        combined_ts_vector = combined_ts_vector.op("||")(condition_name_ts)
        printing_name_ts = func.setweight(
            func.to_tsvector("english", func.coalesce(Printing.name, "")), "D"
        )
        combined_ts_vector = combined_ts_vector.op("||")(printing_name_ts)
        ts_query_func = create_ts_query(query)
        inventory_query = inventory_query.where(
            combined_ts_vector.op("@@")(ts_query_func)
        )

    return inventory_query
