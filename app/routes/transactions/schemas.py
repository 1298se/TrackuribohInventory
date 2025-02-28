import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.orm.strategy_options import _AbstractLoad

from app.routes.catalog.schemas import SKUWithProductResponseSchema
from app.routes.utils import MoneyAmountSchema, ORMModel, MoneySchema
from core.models import LineItem, Transaction
from core.models.inventory import TransactionType

class LineItemBaseSchema(ORMModel):
    sku_id: uuid.UUID
    quantity: int

class LineItemCreateRequestSchema(LineItemBaseSchema):
    pass

class TransactionCreateRequestSchema(BaseModel):
    date: datetime
    type: TransactionType
    counterparty_name: str
    comment: str | None = None
    line_items: list[LineItemCreateRequestSchema]
    currency: str
    shipping_cost_amount: MoneyAmountSchema
    total_amount: MoneyAmountSchema


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

class TransactionsResponseSchema(BaseModel):
    transactions: list[TransactionResponseSchema]

class BulkTransactionDeleteRequestSchema(BaseModel):
    transaction_ids: list[uuid.UUID]
