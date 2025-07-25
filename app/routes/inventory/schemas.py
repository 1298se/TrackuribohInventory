from pydantic import BaseModel

from app.routes.catalog.schemas import SKUWithProductResponseSchema
from app.routes.utils import MoneyAmountSchema, MoneySchema, ORMModel
from core.models.transaction import TransactionType
from datetime import datetime, date
from uuid import UUID


# Schema for SKU price history
class InventoryPriceHistoryItemSchema(BaseModel):
    datetime: datetime
    price: MoneySchema


class InventoryItemResponseSchema(BaseModel):
    sku: SKUWithProductResponseSchema
    quantity: int
    average_cost_per_item: MoneySchema
    lowest_listing_price: MoneySchema | None
    price_change_7d_amount: MoneySchema | None
    price_change_7d_percentage: float | None
    price_history_7d: list[InventoryPriceHistoryItemSchema] | None


class InventoryResponseSchema(BaseModel):
    inventory_items: list[InventoryItemResponseSchema]


# Schemas for SKU Transaction History
class InventorySKUTransactionLineItemSchema(ORMModel):
    transaction_id: UUID
    counterparty_name: str
    transaction_date: datetime
    transaction_type: TransactionType
    quantity: int
    unit_price: MoneySchema


class InventorySKUTransactionsResponseSchema(BaseModel):
    items: list[InventorySKUTransactionLineItemSchema]
    total: int


class InventoryMetricsResponseSchema(BaseModel):
    number_of_items: int
    total_inventory_cost: MoneyAmountSchema
    total_market_value: MoneyAmountSchema
    unrealised_profit: MoneyAmountSchema
    currency: str = "USD"


# New schema for inventory history items
class InventoryHistoryItemSchema(BaseModel):
    snapshot_date: date
    total_cost: float
    total_market_value: float
    unrealised_profit: float


class InventoryPriceHistoryResponseSchema(BaseModel):
    items: list[InventoryPriceHistoryItemSchema]


# Schema for SKU marketplaces
class InventorySkuMarketplacesResponseSchema(BaseModel):
    marketplaces: list[str]
