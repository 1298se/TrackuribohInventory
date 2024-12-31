from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.routes.inventory.dao import query_inventory_items
from src.routes.inventory.schemas import InventoryResponseSchema, InventoryItemResponseSchema
from core.database import get_db_session

router = APIRouter(
    prefix="/inventory",
)
@router.get("/", response_model=InventoryResponseSchema)
def get_inventory(session: Session = Depends(get_db_session)):
    skus_with_quantity = session.execute(query_inventory_items(session)).all()

    inventory_items = [
        InventoryItemResponseSchema(
            sku=sku,
            quantity=quantity,
        )
        for (sku, quantity) in skus_with_quantity
    ]

    return InventoryResponseSchema(
        inventory_items=inventory_items
    )


