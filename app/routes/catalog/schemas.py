from typing import Optional, Any
import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator
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
    data: list[dict[str, str]]
    rarity: str | None


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


class CatalogResponseSchema(ORMModel):
    id: uuid.UUID
    display_name: str


class CatalogsResponseSchema(BaseModel):
    catalogs: list[CatalogResponseSchema]


class ProductTypesResponseSchema(BaseModel):
    product_types: list[ProductType]


class ProductSearchRequestParams(BaseModel):
    query: str
    catalog_id: Optional[uuid.UUID] = None
    product_type: Optional[ProductType] = None

    class Config:
        extra = "forbid"


# Schemas for Market Data endpoint
class MarketDataSummary(BaseModel):
    """High-level summary metrics for product market data, currently stubbed."""

    current_lowest_listing_price: Optional[float] = None
    median_sale_price_30_days: Optional[float] = None
    avg_sale_price_last_7_days: Optional[float] = None
    sale_count_last_7_days: Optional[int] = None
    liquidity_ratio: Optional[float] = None
    price_volatility_30_days: Optional[float] = None
    price_spread_percent: Optional[float] = None
    time_to_sell_estimate_days: Optional[float] = None


class DepthLevel(BaseModel):
    """Amount of listings available at a given price level."""

    price: float
    listing_count: int


class SKUMarketDataSchema(BaseModel):
    """Full market data response for a product, optionally scoped to a SKU variant."""

    summary: MarketDataSummary
    depth_levels: list[DepthLevel]
    listings: list[Any]  # historical listings data (stub)
    sales: list[Any]  # historical sales data (stub)
