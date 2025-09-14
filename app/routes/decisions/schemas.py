from datetime import datetime
from typing import List
from uuid import UUID

from pydantic import BaseModel

from app.routes.utils import ORMModel, MoneyAmountSchema
from app.routes.catalog.schemas import SKUWithProductResponseSchema
from core.models.decisions import Decision


class BuyDecisionResponseSchema(ORMModel):
    id: UUID
    sku: SKUWithProductResponseSchema
    decision: Decision
    quantity: int
    buy_vwap: MoneyAmountSchema
    expected_resale_net: MoneyAmountSchema
    asof_listings: datetime
    asof_sales: datetime
    reason_codes: List[str]
    created_at: datetime


class BuyDecisionsResponseSchema(BaseModel):
    decisions: List[BuyDecisionResponseSchema]
    total_count: int
    filters_applied: dict
