"""Shared Pydantic schemas for eBay API responses."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Mapping, Optional

from pydantic import BaseModel, Field, ConfigDict, field_validator
from pydantic.alias_generators import to_camel


class EbayResponseModel(BaseModel):
    """Base model applying consistent alias + population behaviour."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )


class MoneySchema(EbayResponseModel):
    value: Decimal
    currency: str

    @field_validator("value", mode="before")
    @classmethod
    def _coerce_decimal(cls, value: Any) -> Decimal:
        if value is None:
            return Decimal("0")
        if isinstance(value, Decimal):
            return value
        return Decimal(str(value))


class ShippingOptionSchema(EbayResponseModel):
    shipping_cost_type: Optional[str] = None
    shipping_cost: Optional[MoneySchema] = None
    min_estimated_delivery_date: Optional[str] = None
    max_estimated_delivery_date: Optional[str] = None


class SellerSchema(EbayResponseModel):
    username: Optional[str] = None
    feedback_percentage: Optional[str] = None
    feedback_score: Optional[int] = None

    def feedback_percentage_float(self) -> Optional[float]:
        if self.feedback_percentage is None:
            return None
        try:
            return float(self.feedback_percentage)
        except (TypeError, ValueError):
            return None


class EstimatedAvailabilitySchema(EbayResponseModel):
    estimated_quantity: Optional[int] = None


class ItemSummarySchema(EbayResponseModel):
    item_id: str
    title: Optional[str] = None
    price: MoneySchema
    seller: Optional[SellerSchema] = None
    condition: Optional[str] = None
    condition_id: Optional[str] = None
    item_href: Optional[str] = None
    image: Optional[Mapping[str, Any]] = None
    buying_options: list[str] = Field(default_factory=list)
    shipping_options: list[ShippingOptionSchema] = Field(default_factory=list)
    estimated_availabilities: list[EstimatedAvailabilitySchema] = Field(
        default_factory=list
    )
    epid: Optional[str] = None


class BrowseSearchResponseSchema(EbayResponseModel):
    total: Optional[int] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    item_summaries: list[ItemSummarySchema] = Field(default_factory=list)
