from datetime import datetime
from decimal import Decimal
from enum import Enum, StrEnum
from functools import cached_property
from typing import Any, Dict

from pydantic import BaseModel, ConfigDict, Field, Json
from pydantic.alias_generators import to_camel
from sqlalchemy import alias
from typing_extensions import List, Optional


class TCGPlayerCatalogResponseModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )

class RefreshTokenRequestSchema(BaseModel):
    grant_type: str
    client_id: str
    client_secret: str

class CatalogDetailSchema(TCGPlayerCatalogResponseModel):
    tcgplayer_id: int = Field(alias="categoryId")
    name: str
    modified_on: datetime
    display_name: str
    seo_category_name: str
    sealed_label: Optional[str] = None
    non_sealed_label: Optional[str] = None
    condition_guide_url: str
    is_scannable: bool
    popularity: int

class CatalogDetailResponseSchema(TCGPlayerCatalogResponseModel):
    success: bool
    errors: List[str]
    results: List[CatalogDetailSchema]

class CatalogPrintingSchema(TCGPlayerCatalogResponseModel):
    tcgplayer_id: int = Field(alias="printingId")
    name: str
    display_order: int
    modified_on: datetime

class CatalogPrintingResponseSchema(TCGPlayerCatalogResponseModel):
    success: bool
    errors: List[str]
    results: List[CatalogPrintingSchema]

class CatalogConditionSchema(TCGPlayerCatalogResponseModel):
    tcgplayer_id: int = Field(alias="conditionId")
    name: str
    abbreviation: str
    display_order: int


class CatalogConditionResponseSchema(TCGPlayerCatalogResponseModel):
    success: bool
    errors: List[str]
    results: List[CatalogConditionSchema]

class CatalogLanguageSchema(TCGPlayerCatalogResponseModel):
    tcgplayer_id: int = Field(alias="languageId")
    name: str
    abbr: str

class CatalogLanguageResponseSchema(TCGPlayerCatalogResponseModel):
    success: bool
    errors: List[str]
    results: List[CatalogLanguageSchema]


class CatalogRaritySchema(TCGPlayerCatalogResponseModel):
    tcgplayer_id: int = Field(alias="rarityId")
    display_text: str
    db_value: str

class CatalogRarityResponseSchema(TCGPlayerCatalogResponseModel):
    success: bool
    errors: List[str]
    results: List[CatalogRaritySchema]

class CatalogSetSchema(TCGPlayerCatalogResponseModel):
    tcgplayer_id: int = Field(alias="groupId")
    name: str
    abbreviation: str
    is_supplemental: bool
    published_on: datetime
    modified_on: datetime
    catalog_tcgplayer_id: int = Field(alias="categoryId")

class CatalogSetResponseSchema(TCGPlayerCatalogResponseModel):
    total_items: int | None = None
    success: bool
    errors: List[str]
    results: List[CatalogSetSchema]


class SKUSchema(TCGPlayerCatalogResponseModel):
    tcgplayer_id: int = Field(alias="skuId")
    tcgplayer_product_id: int = Field(alias="productId")
    tcgplayer_language_id: int = Field(alias="languageId")
    tcgplayer_printing_id: int = Field(alias="printingId")
    tcgplayer_condition_id: int = Field(alias="conditionId")

class ExtendedDataSchema(TCGPlayerCatalogResponseModel):
    name: str
    displayName: str
    value: str

class ProductSchema(TCGPlayerCatalogResponseModel):
    tcgplayer_id: int = Field(alias="productId")
    name: str
    clean_name: str | None
    image_url: str
    catalog_tcgplayer_id: int = Field(alias="categoryId")
    set_tcgplayer_id: int = Field(alias="groupId")
    url: str
    modified_on: datetime
    skus: List[SKUSchema]
    image_count: int
    extended_data: List[dict[str, Any]]

class ProductResponseSchema(TCGPlayerCatalogResponseModel):
    total_items: int | None = None
    success: bool
    errors: List[str]
    results: List[ProductSchema]

class SKUPricingSchema(TCGPlayerCatalogResponseModel):
    sku_id: int
    low_price: Optional[Decimal]
    lowest_shipping: Optional[Decimal]
    lowest_listing_price: Optional[Decimal]
    market_price: Optional[Decimal]
    direct_low_price: Optional[Decimal]

    @cached_property
    def lowest_listing_price_total(self) -> int | None:
        return self.lowest_listing_price + self.lowest_shipping or 0 if self.lowest_listing_price is not None else None

class SKUPricingResponseSchema(BaseModel):
    success: bool
    errors: List[str]
    results: List[SKUPricingSchema]

class ProductType(StrEnum):
    CARDS = "Cards"
    SEALED = "Sealed Products"





