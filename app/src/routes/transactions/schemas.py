import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from src.routes.catalog.schemas import SKUWithProductResponseSchema
from src.routes.utils import MoneySchema
from core.src.models.inventory import TransactionType

class LineItemBaseSchema(BaseModel):
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
    line_items: list[LineItemCreateRequestSchema]


class LineItemResponseSchema(BaseModel):
    id: uuid.UUID
    sku: SKUWithProductResponseSchema
    amount: Decimal
    quantity: int


class TransactionResponseSchema(BaseModel):
    id: uuid.UUID
    date: datetime
    type: TransactionType
    counterparty_name: str
    line_items: list[LineItemResponseSchema]
