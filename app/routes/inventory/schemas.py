from pydantic import BaseModel

from app.routes.catalog.schemas import SKUWithProductResponseSchema
from app.routes.utils import MoneySchema, ORMModel
from core.models.transaction import TransactionType
from datetime import datetime
from uuid import UUID


class InventoryItemResponseSchema(BaseModel):
    sku: SKUWithProductResponseSchema
    quantity: int
    average_cost_per_item: MoneySchema
    lowest_listing_price: MoneySchema | None


class InventoryResponseSchema(BaseModel):
    inventory_items: list[InventoryItemResponseSchema]


# Schemas for SKU Transaction History
class InventorySKUTransactionLineItemSchema(ORMModel):
    transaction_id: UUID
    transaction_date: datetime
    transaction_type: TransactionType
    quantity: int
    unit_price: MoneySchema
    platform_name: str | None = None  # Mapped in the endpoint logic


class InventorySKUTransactionsResponseSchema(BaseModel):
    items: list[InventorySKUTransactionLineItemSchema]
    total: int
