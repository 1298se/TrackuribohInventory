from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.routes.catalog.schemas import SKUWithProductResponseSchema
from app.routes.inventory.dao import query_inventory_items
from app.routes.inventory.schemas import InventoryResponseSchema, InventoryItemResponseSchema
from app.routes.utils import MoneySchema
from core.database import get_db_session

router = APIRouter(
    prefix="/inventory",
)
@router.get("/", response_model=InventoryResponseSchema)
def get_inventory(session: Session = Depends(get_db_session)):
    skus_with_quantity = session.execute(query_inventory_items().options(*SKUWithProductResponseSchema.get_load_options())).all()

    inventory_items = [
        InventoryItemResponseSchema(
            sku=sku,
            quantity=total_quantity,
            cost_per_item=MoneySchema(
                amount=total_cost / total_cost,
                currency="USD"
            ),
            lowest_listing_price=MoneySchema(
                amount=lowest_listing_price,
                currency="USD"
            ) if lowest_listing_price else None,
        )
        for (sku, total_quantity, total_cost, lowest_listing_price, market_price) in skus_with_quantity
    ]

    return InventoryResponseSchema(
        inventory_items=inventory_items
    )


