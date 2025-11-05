from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from functools import cached_property
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
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


class TCGPlayerProductType(StrEnum):
    CARDS = "Cards"
    SEALED_PRODUCTS = "Sealed Products"
    BOX_SETS = "Box Sets"
    FAT_PACK = "Fat Pack"


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
        return (
            self.lowest_listing_price + self.lowest_shipping or 0
            if self.lowest_listing_price is not None
            else None
        )


class SKUPricingResponseSchema(BaseModel):
    success: bool
    errors: List[str]
    results: List[SKUPricingSchema]


class ProductMarketPriceResultSchema(BaseModel):
    """Schema for a single product variant's market price from TCGPlayer."""

    product_id: int = Field(alias="productId")
    low_price: Optional[float] = Field(alias="lowPrice")
    mid_price: Optional[float] = Field(alias="midPrice")
    high_price: Optional[float] = Field(alias="highPrice")
    market_price: Optional[float] = Field(alias="marketPrice")
    direct_low_price: Optional[float] = Field(alias="directLowPrice")
    sub_type_name: str = Field(alias="subTypeName", comment="The product's Printing")

    model_config = ConfigDict(populate_by_name=True)


class ProductMarketPriceResponseSchema(BaseModel):
    """Response schema for TCGPlayer product market prices endpoint."""

    success: bool
    errors: List[str]
    results: List[ProductMarketPriceResultSchema]


class ProductType(StrEnum):
    CARDS = "CARDS"
    SEALED = "SEALED"


def map_tcgplayer_product_type_to_product_type(
    tcgplayer_type: TCGPlayerProductType,
) -> ProductType:
    match tcgplayer_type:
        case TCGPlayerProductType.CARDS:
            return ProductType.CARDS
        case TCGPlayerProductType.SEALED_PRODUCTS:
            return ProductType.SEALED
        case TCGPlayerProductType.BOX_SETS:
            return ProductType.SEALED
        case TCGPlayerProductType.FAT_PACK:
            return ProductType.SEALED
        case _:
            raise ValueError(f"Unknown TCGPlayerProductType: {tcgplayer_type}")


# Listing & Sales Response Schemas for tcgplayer_listing_service
class AggregationBucket(TCGPlayerCatalogResponseModel):
    """Aggregation bucket entry with value and count."""

    value: str | int
    count: float


class SKUListingResponseSchema(TCGPlayerCatalogResponseModel):
    """Single listing item from TCGPlayer API."""

    direct_product: bool
    gold_seller: bool
    listing_id: float
    channel_id: float
    condition_id: float
    verified_seller: bool
    direct_inventory: float
    ranked_shipping_price: float
    product_id: float
    printing: str
    language_abbreviation: str
    seller_name: str
    forward_freight: bool
    seller_shipping_price: float
    language: str
    shipping_price: float
    condition: str
    language_id: float
    score: float
    direct_seller: bool
    product_condition_id: float
    seller_id: str
    listing_type: str
    seller_rating: float
    seller_sales: str
    quantity: float
    seller_key: str
    price: float
    custom_data: dict[str, Any]


class ListingResultSchema(TCGPlayerCatalogResponseModel):
    """Container for a page of listings including aggregations."""

    total_results: int
    result_id: str
    aggregations: dict[str, list[AggregationBucket]]
    results: list[SKUListingResponseSchema]


class ListingResponseSchema(TCGPlayerCatalogResponseModel):
    """Root response from the listings endpoint."""

    errors: list[str]
    results: list[ListingResultSchema]


class SaleRecordSchema(TCGPlayerCatalogResponseModel):
    """Single sale record from TCGPlayer sales API."""

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


class SalesResponseSchema(TCGPlayerCatalogResponseModel):
    """Root response from the sales endpoint."""

    previous_page: str
    next_page: str
    result_count: int
    total_results: int
    data: list[SaleRecordSchema]
