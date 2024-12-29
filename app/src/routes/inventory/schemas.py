from pydantic import BaseModel

from src.routes.catalog.schemas import SKUWithProductResponseSchema


class InventoryItemResponseSchema(BaseModel):
    sku: SKUWithProductResponseSchema
    quantity: int


class InventoryResponseSchema(BaseModel):
    inventory_items: list[InventoryItemResponseSchema]