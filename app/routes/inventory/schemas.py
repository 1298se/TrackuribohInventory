from pydantic import BaseModel
from typing import TypedDict
from decimal import Decimal

from app.routes.catalog.schemas import SKUWithProductResponseSchema
from app.routes.utils import MoneySchema


class InventoryItemResponseSchema(BaseModel):
    sku: SKUWithProductResponseSchema
    quantity: int
    cost_per_item: MoneySchema
    lowest_listing_price: MoneySchema | None


class InventoryResponseSchema(BaseModel):
    inventory_items: list[InventoryItemResponseSchema]
