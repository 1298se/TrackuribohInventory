from typing import Optional, List, Annotated
from pydantic import BaseModel, Field, AfterValidator

# Import SKUBaseResponseSchema from catalog since market data depends on SKU structure
from app.routes.catalog.schemas import SKUBaseResponseSchema
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
