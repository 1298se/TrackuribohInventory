import uuid
from typing import List

from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Load, joinedload, selectinload
from sqlalchemy.orm.strategy_options import _AbstractLoad

from core.services.schemas.schema import ProductType
from models import Product, SKU
from src.routes.utils import ORMModel


class PrintingResponseSchema(ORMModel):
    name: str

class LanguageResponseSchema(ORMModel):
    name: str
    abbreviation: str

class ConditionResponseSchema(ORMModel):
    name: str
    abbreviation: str

class ProductBaseResponseSchema(ORMModel):
    id: uuid.UUID
    name: str
    tcgplayer_url: str
    image_url: str
    product_type: ProductType
    data: list[dict[str, str]]

class SKUBaseResponseSchema(ORMModel):
    condition: ConditionResponseSchema
    printing: PrintingResponseSchema
    language: LanguageResponseSchema

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return [joinedload(SKU.condition), joinedload(SKU.printing), joinedload(SKU.language)]

class ProductWithSKUsResponseSchema(ProductBaseResponseSchema):
    skus: list[SKUBaseResponseSchema]

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return [selectinload(Product.skus).options(*SKUBaseResponseSchema.get_load_options())]


class SKUWithProductResponseSchema(SKUBaseResponseSchema):
    product: ProductWithSKUsResponseSchema

class ProductSearchResponseSchema(BaseModel):
    results: list[ProductWithSKUsResponseSchema]
