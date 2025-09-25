from typing import Optional, List, Annotated
from datetime import datetime
from pydantic import BaseModel, Field, AfterValidator

# Import SKUBaseResponseSchema from catalog since market data depends on SKU structure
from app.routes.catalog.schemas import (
    SKUBaseResponseSchema,
    SKUWithProductResponseSchema,
)
from app.routes.utils import MoneyAmountSchema
from core.models.price import Marketplace


# Schemas for Market Data endpoint
class CumulativeDepthLevelResponseSchema(BaseModel):
    """Cumulative amount of listings available up to a given price level."""

    price: float
    cumulative_count: int


# Add schema for cumulative sales depth levels
class SaleCumulativeDepthLevelResponseSchema(BaseModel):
    """Cumulative amount of sales up to a given price level."""

    price: float
    cumulative_count: int


class SKUMarketDataResponseSchema(BaseModel):
    """Market data for a single SKU in one marketplace."""

    total_listings: int
    total_quantity: int
    total_sales: int
    sales_velocity: Annotated[float, AfterValidator(lambda x: round(x, 1))]
    days_of_inventory: Optional[float]
    cumulative_depth_levels: list[
        CumulativeDepthLevelResponseSchema
    ]  # Precomputed cumulative depth
    # Add cumulative sales depth levels to the response
    cumulative_sales_depth_levels: list[SaleCumulativeDepthLevelResponseSchema]


class SKUMarketDataItemResponseSchema(BaseModel):
    """Represents market data for a specific SKU from a specific marketplace."""

    marketplace: Marketplace = Field(..., description="Source marketplace")
    sku: SKUBaseResponseSchema  # Details of the specific SKU variant
    market_data: SKUMarketDataResponseSchema  # The actual market data (depth, summary)


class MarketDataResponseSchema(BaseModel):
    """Response wrapper for market data items only."""

    market_data_items: List[SKUMarketDataItemResponseSchema]


# Request/Response schemas for Product Listings endpoint
class ProductListingsRequestParams(BaseModel):
    """Query parameters for product listings endpoint."""

    marketplace: Marketplace = Field(
        default=Marketplace.TCGPLAYER, description="Marketplace to fetch listings from"
    )


class ProductListingResponseSchema(BaseModel):
    """Individual listing response."""

    listing_id: str
    sku: SKUWithProductResponseSchema
    price: MoneyAmountSchema
    quantity: int
    shipping_price: Optional[MoneyAmountSchema]
    seller_name: Optional[str]


class ProductListingsResponseSchema(BaseModel):
    """Response wrapper for product listings."""

    results: List[ProductListingResponseSchema]


# Request/Response schemas for Product Sales endpoint
class ProductSalesRequestParams(BaseModel):
    """Query parameters for product sales endpoint."""

    marketplace: Marketplace = Field(
        default=Marketplace.TCGPLAYER, description="Marketplace to fetch sales from"
    )


class ProductSaleResponseSchema(BaseModel):
    """Individual sale response."""

    sku: SKUWithProductResponseSchema
    quantity: int
    price: MoneyAmountSchema
    shipping_price: Optional[MoneyAmountSchema]
    order_date: datetime


class ProductSalesResponseSchema(BaseModel):
    """Response wrapper for product sales."""

    results: List[ProductSaleResponseSchema]
