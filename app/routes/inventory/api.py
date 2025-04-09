from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.routes.catalog.schemas import SKUWithProductResponseSchema
from core.dao.inventory import query_inventory_items, InventoryQueryResultRow
from app.routes.inventory.schemas import InventoryResponseSchema, InventoryItemResponseSchema
from app.routes.utils import MoneySchema
from core.dao.prices import update_latest_sku_prices
from core.database import get_db_session
from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService, get_tcgplayer_catalog_service

router = APIRouter(
    prefix="/inventory",
)
@router.get("/", response_model=InventoryResponseSchema)
def get_inventory(
    background_tasks: BackgroundTasks,
    catalog_service: TCGPlayerCatalogService = Depends(get_tcgplayer_catalog_service),
    session: Session = Depends(get_db_session),
    query: str | None = None,
):
    query = query_inventory_items(query=query).options(*SKUWithProductResponseSchema.get_load_options())
    skus_with_quantity: List[InventoryQueryResultRow] = session.execute(query).all()

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

    background_tasks.add_task(
        update_latest_sku_prices,
        session=session,
        catalog_service=catalog_service,
        sku_ids=[item.sku.id for item in inventory_items],
    )




    return InventoryResponseSchema(
        inventory_items=inventory_items
    )
