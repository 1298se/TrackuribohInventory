"""
DTO types for TCGPlayer service data transfer.

These frozen Pydantic models provide lightweight, immutable data containers for
transferring TCGPlayer API data between services with built-in serialization.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict


class TCGPlayerListing(BaseModel):
    model_config = ConfigDict(frozen=True)
    """DTO for individual TCGPlayer listing data."""

    # Core pricing fields
    price: Decimal
    shipping_price: Decimal

    # Inventory fields
    quantity: int
    listing_id: int

    # Product identification
    product_id: int
    product_condition_id: int

    # Product attributes
    condition: str
    printing: str
    language: str
    language_abbreviation: str
    language_id: int

    # Seller information
    seller_id: str
    seller_name: str
    seller_rating: float
    seller_sales: str
    seller_key: str

    # Marketplace metadata
    channel_id: int
    condition_id: int
    listing_type: str

    # Quality indicators
    gold_seller: bool
    verified_seller: bool
    direct_seller: bool
    direct_product: bool
    direct_inventory: int

    # Shipping/pricing metadata
    ranked_shipping_price: Decimal
    seller_shipping_price: Decimal
    forward_freight: bool

    # Scoring
    score: float

    # Additional data
    custom_data: Any


class TCGPlayerSale(BaseModel):
    model_config = ConfigDict(frozen=True)
    """DTO for individual TCGPlayer sale record."""

    # Core sale data
    purchase_price: Decimal
    shipping_price: Decimal
    quantity: int
    order_date: datetime

    # Product attributes
    condition: str
    variant: str
    language: str
    title: str

    # Listing metadata
    listing_type: str
    custom_listing_id: str
