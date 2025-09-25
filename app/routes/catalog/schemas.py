from typing import Optional, List, Dict, Annotated
import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator, Field, AfterValidator
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.orm.strategy_options import _AbstractLoad

from app.routes.utils import ORMModel
from core.models.catalog import Product
from core.models.catalog import SKU
from core.services.schemas.schema import ProductType


class PrintingResponseSchema(ORMModel):
    id: uuid.UUID
    name: str


class LanguageResponseSchema(ORMModel):
    id: uuid.UUID
    name: str
    abbreviation: str


class ConditionResponseSchema(ORMModel):
    id: uuid.UUID
    name: str
    abbreviation: str


class ProductBaseResponseSchema(ORMModel):
    id: uuid.UUID
    name: str
    tcgplayer_url: str
    image_url: str
    product_type: ProductType
    data: List[Dict[str, str]]
    rarity: Optional[str] = None
    number: Optional[str] = None


class SetBaseResponseSchema(ORMModel):
    id: uuid.UUID
    name: str
    code: str
    release_date: datetime


class SKUBaseResponseSchema(ORMModel):
    id: uuid.UUID
    condition: ConditionResponseSchema
    printing: PrintingResponseSchema
    language: LanguageResponseSchema
    lowest_listing_price_total: Optional[float] = None

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return [
            joinedload(SKU.condition),
            joinedload(SKU.printing),
            joinedload(SKU.language),
        ]


class ProductWithSetAndSKUsResponseSchema(ProductBaseResponseSchema):
    set: SetBaseResponseSchema
    skus: list[SKUBaseResponseSchema]

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return [
            selectinload(Product.skus).options(
                *SKUBaseResponseSchema.get_load_options(),
            ),
            joinedload(Product.set),
        ]

    @field_validator("skus", mode="before")
    def sort_skus(
        cls, skus: list[SKUBaseResponseSchema]
    ) -> list[SKUBaseResponseSchema]:
        """
        Sort the list of SKUs first by the condition's name and then by the printing's name.
        Adjust the lambda key as needed if the fields to sort by differ.
        """
        return sorted(skus, key=lambda sku: (sku.condition.id, sku.printing.name))


class SKUWithProductResponseSchema(SKUBaseResponseSchema):
    product: ProductWithSetAndSKUsResponseSchema

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return [
            selectinload(SKU.product).options(
                *ProductWithSetAndSKUsResponseSchema.get_load_options()
            )
        ]


class ProductSearchResponseSchema(BaseModel):
    results: list[ProductWithSetAndSKUsResponseSchema]
    total: int = Field(description="Total number of results")
    page: int = Field(description="Current page number (1-based)")
    limit: int = Field(description="Number of items per page")
    has_next: bool = Field(description="Whether there are more pages")
    has_prev: bool = Field(description="Whether there are previous pages")


class CatalogResponseSchema(ORMModel):
    id: uuid.UUID
    display_name: str


class CatalogsResponseSchema(BaseModel):
    catalogs: list[CatalogResponseSchema]


class ProductTypesResponseSchema(BaseModel):
    product_types: list[ProductType]


class SetsResponseSchema(BaseModel):
    sets: list[SetBaseResponseSchema]


class ProductSearchRequestParams(BaseModel):
    query: str
    catalog_id: Optional[uuid.UUID] = None
    product_type: Optional[ProductType] = None
    set_id: Optional[uuid.UUID] = None
    page: int = Field(default=1, ge=1, description="Page number (1-based)")
    limit: int = Field(default=20, ge=1, le=100, description="Number of items per page")

    class Config:
        extra = "forbid"


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

    marketplace: str = Field(
        ..., description="Source marketplace (e.g., 'TCGPlayer', 'eBay')"
    )
    sku: SKUBaseResponseSchema  # Details of the specific SKU variant
    market_data: SKUMarketDataResponseSchema  # The actual market data (depth, summary)


class MarketDataResponseSchema(BaseModel):
    """Response wrapper for market data items only."""

    market_data_items: List[SKUMarketDataItemResponseSchema]
