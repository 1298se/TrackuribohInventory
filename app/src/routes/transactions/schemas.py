import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from core.models.inventory import TransactionType
from src.routes.catalog.schemas import SKUWithProductResponseSchema


class LineItemCreateRequestSchema(BaseModel):
    sku_id: uuid.UUID
    quantity: int

class TransactionCreateRequestSchema(BaseModel):
    date: datetime
    type: TransactionType
    amount: Decimal
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
