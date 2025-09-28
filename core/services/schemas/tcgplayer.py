"""Pydantic models describing TCGPlayer internal API payloads."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class TCGPlayerResponseModel(BaseModel):
    """Base model that handles camelCase field aliases and ignores extra data."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )


class AggregationItemSchema(TCGPlayerResponseModel):
    value: Any
    count: int


class AggregationsSchema(TCGPlayerResponseModel):
    condition: List[AggregationItemSchema]
    quantity: List[AggregationItemSchema]
    language: List[AggregationItemSchema]
    printing: List[AggregationItemSchema]


class ListingSchema(TCGPlayerResponseModel):
    direct_product: bool
    gold_seller: bool
    listing_id: int
    channel_id: int
    condition_id: int
    verified_seller: bool
    direct_inventory: int
    ranked_shipping_price: Decimal
    product_id: int
    printing: str
    language_abbreviation: str
    seller_name: str
    forward_freight: bool
    seller_shipping_price: Decimal
    language: str
    shipping_price: Decimal
    condition: str
    language_id: int
    score: float
    direct_seller: bool
    product_condition_id: int
    seller_id: str
    listing_type: str
    seller_rating: float
    seller_sales: str
    quantity: int
    seller_key: str
    price: Decimal
    custom_data: Any


class PageSchema(TCGPlayerResponseModel):
    total_results: int
    result_id: str
    aggregations: AggregationsSchema
    results: List[ListingSchema]


class TCGPlayerListingsResponseSchema(TCGPlayerResponseModel):
    errors: List[str] = Field(default_factory=list)
    results: List[PageSchema] = Field(default_factory=list)


class CardSaleResponse(TCGPlayerResponseModel):
    condition: str
    variant: str
    language: str
    quantity: int
    title: str
    listing_type: str
    custom_listing_id: str
    purchase_price: Decimal
    shipping_price: Decimal
    order_date: datetime


class CardSalesResponse(TCGPlayerResponseModel):
    previous_page: Optional[str] = None
    next_page: Optional[str] = None
    result_count: int
    total_results: int
    data: List[CardSaleResponse] = Field(default_factory=list)
