from typing import Optional, List, Annotated, Union
from typing_extensions import Literal
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

    marketplace: Optional[List[Marketplace]] = Field(
        default=None,
        description="Marketplaces to fetch listings from; omit or empty for all",
    )


class ProductListingBaseResponseSchema(BaseModel):
    """Shared fields across all marketplace listing responses."""

    listing_id: str
    marketplace: Marketplace
    sku: SKUWithProductResponseSchema
    price: MoneyAmountSchema
    quantity: int = 1
    shipping_price: Optional[MoneyAmountSchema] = None
    condition: Optional[str] = None
    seller_name: Optional[str] = None
    seller_rating: Optional[float] = None
    listing_url: str


class TCGPlayerProductListingResponseSchema(ProductListingBaseResponseSchema):
    """Listing response for TCGPlayer marketplace."""

    marketplace: Literal[Marketplace.TCGPLAYER]
    seller_id: Optional[str] = None


class EbayProductListingResponseSchema(ProductListingBaseResponseSchema):
    """Listing response for eBay marketplace."""

    marketplace: Literal[Marketplace.EBAY]
    image_url: Optional[str] = None


ProductListingResponseSchema = Annotated[
    Union[
        TCGPlayerProductListingResponseSchema,
        EbayProductListingResponseSchema,
    ],
    Field(discriminator="marketplace"),
]


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


# Schema for Product Market Prices endpoint
class SKUMarketPriceSchema(BaseModel):
    """SKU with its lowest listing price."""

    sku_id: str
    lowest_listing_price_total: Optional[float]


class ProductMarketPricesResponseSchema(BaseModel):
    """Response wrapper for product market prices."""

    prices: List[SKUMarketPriceSchema]
