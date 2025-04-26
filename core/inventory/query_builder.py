from sqlalchemy import func
from typing import Optional
from uuid import UUID

from core.dao.inventory import query_inventory_items
from core.models.catalog import SKU
from core.models.catalog import Product
from core.models.catalog import Set
from core.models.catalog import Condition
from core.models.catalog import Printing
from core.utils.search import create_product_set_fts_vector, create_ts_query


def build_inventory_query(
    query: Optional[str] = None, catalog_id: Optional[UUID] = None
):
    """Return a SQLAlchemy selectable that replicates the joins and filters used by
    `get_inventory` in app.routes.inventory.api .

    The returned query starts from `query_inventory_items()` which already joins
    SKU / SKULatestPriceData via a CTE.  We then apply optional catalogue or
    full-text search filters, adding the same joins as the original endpoint so
    that downstream callers can rely on identical row sets.
    """
    inventory_query = query_inventory_items()

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
