import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.orm.strategy_options import _AbstractLoad

from app.routes.catalog.schemas import SKUWithProductResponseSchema
from app.routes.utils import MoneySchema, ORMModel
from core.models import LineItem, Transaction
from core.models.inventory import TransactionType

class LineItemBaseSchema(ORMModel):
    sku_id: uuid.UUID
    quantity: int

class LineItemProRataResponseSchema(LineItemBaseSchema):
    price_per_quantity: MoneySchema


class LineItemCreateRequestSchema(LineItemBaseSchema):
    price_per_item: MoneySchema

class TransactionCreateRequestSchema(BaseModel):
    date: datetime
    type: TransactionType
    counterparty_name: str
    comment: str | None = None
    line_items: list[LineItemCreateRequestSchema]


class LineItemResponseSchema(LineItemBaseSchema):
    sku: SKUWithProductResponseSchema
    price_per_item: MoneySchema
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

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return [selectinload(Transaction.line_items).options(*LineItemResponseSchema.get_load_options())]

class TransactionsResponseSchema(BaseModel):
    transactions: list[TransactionResponseSchema]
