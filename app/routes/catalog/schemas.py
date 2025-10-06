from typing import Optional, List, Dict
import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator, Field
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


class ProductSearchResultSchema(ProductBaseResponseSchema):
    """Lightweight schema for search results - excludes SKUs for better performance"""
    set: SetBaseResponseSchema

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return [
            joinedload(Product.set),
        ]


class ProductSearchResponseSchema(BaseModel):
    results: list[ProductSearchResultSchema]


class CatalogResponseSchema(ORMModel):
    id: uuid.UUID
    display_name: str


class CatalogsResponseSchema(BaseModel):
    catalogs: list[CatalogResponseSchema]


class ProductTypesResponseSchema(BaseModel):
    product_types: list[ProductType]


class SetsResponseSchema(BaseModel):
    sets: list[SetBaseResponseSchema]
    
class TopPricedCardSchema(BaseModel):
    sku_id: uuid.UUID
    product_name: str
    condition: str
    printing: str
    language: str
    price: float

class HistoricalPriceComparisonSchema(BaseModel):
    current_total_market_value: float
    historical_total_market_value: float | None
    growth_percentage: float | None
    current_top_priced_card: TopPricedCardSchema | None
    historical_top_priced_card: TopPricedCardSchema | None
    top_card_growth_percentage: float | None

class HistoricalPriceComparisonSchema(BaseModel):
    current_total_market_value: float
    historical_total_market_value: float | None
    growth_percentage: float | None
    current_top_priced_card: TopPricedCardSchema | None
    historical_top_priced_card: TopPricedCardSchema | None
    top_card_growth_percentage: float | None


class ProductSearchRequestParams(BaseModel):
    query: str
    catalog_id: Optional[uuid.UUID] = None
    product_type: Optional[ProductType] = None
    set_id: Optional[uuid.UUID] = None

    class Config:
        extra = "forbid"
