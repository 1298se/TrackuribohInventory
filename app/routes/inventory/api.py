from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, distinct, func
from typing import List, Optional
import uuid

from app.routes.catalog.schemas import SKUWithProductResponseSchema, CatalogResponseSchema, CatalogsResponseSchema
from core.dao.inventory import query_inventory_items, InventoryQueryResultRow
from app.routes.inventory.schemas import InventoryResponseSchema, InventoryItemResponseSchema
from app.routes.utils import MoneySchema
from core.dao.prices import update_latest_sku_prices
from core.database import get_db_session
from core.models import SKU, Product, Set, Catalog, Condition, Printing
from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService, get_tcgplayer_catalog_service
from core.utils.search import create_product_set_fts_vector, create_ts_query

router = APIRouter(
    prefix="/inventory",
)

@router.get("/catalogs", response_model=CatalogsResponseSchema)
def get_inventory_catalogs(
    session: Session = Depends(get_db_session),
):
    """
    Get all catalogs that have items in the inventory.
    """
    # First get SKUs in inventory
    inventory_query = query_inventory_items()
    sku_ids_with_inventory = [sku.id for sku, _, _, _ in session.execute(inventory_query).all()]
    
    # Now find which catalogs these SKUs belong to
    catalogs_query = (
        select(Catalog).distinct()
        .join(Set, Catalog.id == Set.catalog_id)
        .join(Product, Set.id == Product.set_id)
        .join(SKU, Product.id == SKU.product_id)
        .where(SKU.id.in_(sku_ids_with_inventory))
        .order_by(Catalog.display_name)
    )
    
    catalogs = session.scalars(catalogs_query).all()
    
    return CatalogsResponseSchema(
        catalogs=catalogs
    )

@router.get("/", response_model=InventoryResponseSchema)
def get_inventory(
    session: Session = Depends(get_db_session),
    query: str | None = None,
    catalog_id: uuid.UUID | None = None,
):
    inventory_query = query_inventory_items()
    required_joins = {} # Use dict keys for deduplication and insertion order preservation (Python 3.7+)
                        # Values store the (target, onclause) tuple for the join.
    
    # Define join conditions once
    product_join = (Product, SKU.product_id == Product.id)
    set_join = (Set, Product.set_id == Set.id)
    condition_join = (Condition, SKU.condition_id == Condition.id)
    printing_join = (Printing, SKU.printing_id == Printing.id)

    # Determine required joins based on parameters
    if catalog_id:
        required_joins[Product] = product_join
        required_joins[Set] = set_join
        # Apply catalog filter immediately as it doesn't depend on other joins yet
        inventory_query = inventory_query.where(Set.catalog_id == catalog_id)
        
    if query:
        required_joins[Product] = product_join
        required_joins[Set] = set_join
        required_joins[Condition] = condition_join
        required_joins[Printing] = printing_join
        
    # Apply all required joins uniquely based on insertion order
    for target, onclause in required_joins.values():
        inventory_query = inventory_query.join(target, onclause)
            
    # Apply full-text search if query parameter is present
    if query:
        # FTS logic relies on the previously applied joins
        combined_ts_vector = create_product_set_fts_vector()
        condition_name_ts = func.setweight(func.to_tsvector('english', func.coalesce(Condition.name, '')), 'D')
        combined_ts_vector = combined_ts_vector.op('||')(condition_name_ts)
        printing_name_ts = func.setweight(func.to_tsvector('english', func.coalesce(Printing.name, '')), 'D')
        combined_ts_vector = combined_ts_vector.op('||')(printing_name_ts)
        ts_query_func = create_ts_query(query)
        inventory_query = inventory_query.where(combined_ts_vector.op('@@')(ts_query_func))
        
    inventory_query = inventory_query.options(*SKUWithProductResponseSchema.get_load_options())
    skus_with_quantity: List[InventoryQueryResultRow] = session.execute(inventory_query).all()

    inventory_items = [
        InventoryItemResponseSchema(
            sku=sku,
            quantity=total_quantity,
            average_cost_per_item=MoneySchema(
                amount=total_cost / total_quantity,
                currency="USD"
            ),
            lowest_listing_price=MoneySchema(
                amount=price_data.lowest_listing_price_amount,
                currency="USD"
            ) if price_data and price_data.lowest_listing_price_amount else None,
        )
        for (sku, total_quantity, total_cost, price_data) in skus_with_quantity
    ]

    return InventoryResponseSchema(
        inventory_items=inventory_items
    )
