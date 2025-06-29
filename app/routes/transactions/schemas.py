import uuid
from datetime import datetime, date
from typing import Optional, List

from pydantic import BaseModel, field_validator, computed_field, Field
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.orm.strategy_options import _AbstractLoad

from app.routes.catalog.schemas import SKUWithProductResponseSchema
from app.routes.utils import MoneyAmountSchema, ORMModel
from core.models.transaction import LineItem
from core.models.transaction import Transaction
from core.models.transaction import TransactionType


class PlatformResponseSchema(ORMModel):
    id: uuid.UUID
    name: str

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return []


class PlatformCreateRequestSchema(BaseModel):
    name: str


class LineItemBaseSchema(ORMModel):
    id: uuid.UUID
    quantity: int


class LineItemCreateRequestSchema(BaseModel):
    sku_id: uuid.UUID
    quantity: int


class LineItemUpdateRequestSchema(BaseModel):
    id: uuid.UUID | None = None
    sku_id: uuid.UUID | None
    unit_price_amount: MoneyAmountSchema
    quantity: int


class TransactionCreateRequestSchema(BaseModel):
    date: datetime
    type: TransactionType
    counterparty_name: str
    comment: str | None = None
    line_items: list[LineItemCreateRequestSchema]
    currency: str
    platform_id: uuid.UUID | None = None
    platform_order_id: str | None = None
    shipping_cost_amount: (
        MoneyAmountSchema  # The shipping cost YOU incurred (what you paid for shipping)
    )
    tax_amount: MoneyAmountSchema  # The tax amount applied to the transaction
    subtotal_amount: MoneyAmountSchema  # The sum of line items before tax and shipping

    @computed_field
    def total_amount(self) -> MoneyAmountSchema:
        """
        The final transaction amount (what you received for sales or paid for purchases).
        For sales: subtotal + tax - your shipping costs (since you paid that)
        For purchases: subtotal + tax + shipping cost (since that's part of what you paid)
        """
        if self.type == TransactionType.SALE:
            # For sales, subtract your shipping costs from the total
            return self.subtotal_amount + self.tax_amount - self.shipping_cost_amount
        else:
            # For purchases, add shipping to the total (it's part of what you paid)
            return self.subtotal_amount + self.tax_amount + self.shipping_cost_amount


class TransactionUpdateRequestSchema(BaseModel):
    counterparty_name: str
    comment: str | None
    currency: str
    platform_id: uuid.UUID | None = None
    platform_order_id: str | None = None
    shipping_cost_amount: (
        MoneyAmountSchema  # The shipping cost YOU incurred (what you paid for shipping)
    )
    tax_amount: MoneyAmountSchema  # The tax amount applied to the transaction
    date: datetime
    line_items: list[LineItemUpdateRequestSchema]


class LineItemResponseSchema(LineItemBaseSchema):
    sku: SKUWithProductResponseSchema
    unit_price_amount: MoneyAmountSchema
    quantity: int

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return [
            joinedload(LineItem.sku).options(
                *SKUWithProductResponseSchema.get_load_options()
            )
        ]


class TransactionResponseSchema(ORMModel):
    id: uuid.UUID
    date: datetime
    type: TransactionType
    counterparty_name: str
    comment: str | None
    line_items: list[LineItemResponseSchema]
    platform: Optional[PlatformResponseSchema] = None
    platform_order_id: str | None = None
    currency: str
    shipping_cost_amount: (
        MoneyAmountSchema  # The shipping cost YOU incurred (what you paid for shipping)
    )
    tax_amount: MoneyAmountSchema  # The tax amount applied to the transaction

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return [
            selectinload(Transaction.line_items).options(
                *LineItemResponseSchema.get_load_options()
            ),
            joinedload(Transaction.platform),
        ]

    @field_validator("line_items", mode="before")
    def sort_line_items(
        cls, line_items: list[LineItemResponseSchema]
    ) -> list[LineItemResponseSchema]:
        """
        Sort the list of line items first by the sku's condition's name and then by the sku's printing's name.
        Adjust the lambda key as needed if the fields to sort by differ.
        """
        return sorted(line_items, key=lambda line_item: line_item.id)


class TransactionsResponseSchema(BaseModel):
    transactions: list[TransactionResponseSchema]


# Request schema for weighted price calculation endpoint
class WeightedPriceCalculationRequestSchema(BaseModel):
    line_items: list[LineItemCreateRequestSchema]
    total_amount: MoneyAmountSchema


# Response schema for individual calculated weighted line item price
class CalculatedWeightedLineItemSchema(BaseModel):
    sku_id: uuid.UUID
    quantity: int
    unit_price_amount: MoneyAmountSchema


# Response schema for the weighted price calculation endpoint
class WeightedPriceCalculationResponseSchema(BaseModel):
    calculated_line_items: list[CalculatedWeightedLineItemSchema]


class BulkTransactionDeleteRequestSchema(BaseModel):
    transaction_ids: list[uuid.UUID]


class TransactionMetricsResponseSchema(BaseModel):
    total_revenue: MoneyAmountSchema
    total_spent: MoneyAmountSchema
    net_profit: MoneyAmountSchema
    total_transactions: int
    currency: str = "USD"


class TransactionFilterRequestSchema(BaseModel):
    """Request schema for transaction filtering"""

    search_query: Optional[str] = Field(None, description="Search query")
    date_start: Optional[date] = Field(None, description="Start date")
    date_end: Optional[date] = Field(None, description="End date")
    types: Optional[List[TransactionType]] = Field(
        None, description="Transaction types"
    )
    platform_ids: Optional[List[str]] = Field(None, description="Platform IDs")
    include_no_platform: bool = Field(False, description="Include no platform")
    amount_min: Optional[float] = Field(None, description="Minimum amount")
    amount_max: Optional[float] = Field(None, description="Maximum amount")


class PlatformFilterOption(BaseModel):
    id: str
    name: str


class DateRangeOption(BaseModel):
    min: Optional[str] = None
    max: Optional[str] = None


class TransactionFilterOptionsResponseSchema(BaseModel):
    """Schema for available filter options"""

    platforms: list[PlatformFilterOption]
    transaction_types: list[str]
    date_range: DateRangeOption


class TransactionPerformanceRequestSchema(BaseModel):
    """Request schema for transaction performance"""

    days: int = Field(30, ge=1, le=365, description="Number of days to look back")


class TransactionPerformanceDataPointSchema(BaseModel):
    """Schema for a single performance data point"""

    date: str = Field(description="Date in YYYY-MM-DD format")
    revenue: MoneyAmountSchema = Field(description="Total revenue for this period")
    expenses: MoneyAmountSchema = Field(description="Total expenses for this period")
    net_profit: MoneyAmountSchema = Field(description="Net profit for this period")
    transaction_count: int = Field(description="Number of transactions for this period")


class TransactionPerformanceResponseSchema(BaseModel):
    """Response schema for transaction performance"""

    data_points: list[TransactionPerformanceDataPointSchema]
    currency: str = "USD"
