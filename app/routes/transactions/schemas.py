import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.orm.strategy_options import _AbstractLoad

from app.routes.catalog.schemas import SKUWithProductResponseSchema
from app.routes.utils import MoneyAmountSchema, ORMModel, MoneySchema
from core.models import LineItem, Transaction
from core.models.transaction import TransactionType

class LineItemBaseSchema(ORMModel):
    id: uuid.UUID
    quantity: int

class LineItemCreateRequestSchema(BaseModel):
    sku_id: uuid.UUID
    quantity: int

class LineItemUpdateRequestSchema(BaseModel):
    id: uuid.UUID
    price_per_item_amount: MoneyAmountSchema
    quantity: int

class TransactionCreateRequestSchema(BaseModel):
    date: datetime
    type: TransactionType
    counterparty_name: str
    comment: str | None = None
    line_items: list[LineItemCreateRequestSchema]
    currency: str
    shipping_cost_amount: MoneyAmountSchema
    total_amount: MoneyAmountSchema

class TransactionUpdateRequestSchema(BaseModel):
    counterparty_name: str
    comment: str | None
    currency: str
    shipping_cost_amount: MoneyAmountSchema
    date: datetime
    line_items: list[LineItemUpdateRequestSchema]

class LineItemResponseSchema(LineItemBaseSchema):
    sku: SKUWithProductResponseSchema
    price_per_item_amount: MoneyAmountSchema
    quantity: int

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return [joinedload(LineItem.sku).options(*SKUWithProductResponseSchema.get_load_options())]


class TransactionResponseSchema(ORMModel):
    id: uuid.UUID
    date: datetime
    type: TransactionType
    counterparty_name: str
    comment: str | None
    line_items: list[LineItemResponseSchema]
    currency: str
    shipping_cost_amount: MoneyAmountSchema

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return [selectinload(Transaction.line_items).options(*LineItemResponseSchema.get_load_options())]

    @field_validator("line_items", mode="before")
    def sort_line_items(cls, line_items: list[LineItemResponseSchema]) -> list[LineItemResponseSchema]:
        """
        Sort the list of line items first by the sku's condition's name and then by the sku's printing's name.
        Adjust the lambda key as needed if the fields to sort by differ.
        """
        return sorted(line_items, key=lambda line_item: line_item.id)

class TransactionsResponseSchema(BaseModel):
    transactions: list[TransactionResponseSchema]

class BulkTransactionDeleteRequestSchema(BaseModel):
    transaction_ids: list[uuid.UUID]
