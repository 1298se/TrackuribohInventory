import uuid
from datetime import datetime

from pydantic import BaseModel
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.orm.strategy_options import _AbstractLoad

from app.routes.utils import ORMModel
from core.models import Product, SKU
from core.services.schemas.schema import ProductType


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
    rarity: str | None

class SetBaseResponseSchema(ORMModel):
    id: uuid.UUID
    name: str
    code: str
    release_date: datetime
    modified_date: datetime

class SKUBaseResponseSchema(ORMModel):
    id: uuid.UUID
    condition: ConditionResponseSchema
    printing: PrintingResponseSchema
    language: LanguageResponseSchema

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return [joinedload(SKU.condition), joinedload(SKU.printing), joinedload(SKU.language)]

from pydantic import field_validator

class ProductWithSetAndSKUsResponseSchema(ProductBaseResponseSchema):
    set: SetBaseResponseSchema
    skus: list[SKUBaseResponseSchema]

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return [
            selectinload(Product.skus)
                .options(
                    *SKUBaseResponseSchema.get_load_options(),
                ),
            joinedload(Product.set)
        ]
class SKUWithProductResponseSchema(SKUBaseResponseSchema):
    product: ProductWithSetAndSKUsResponseSchema

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return [selectinload(SKU.product).options(*ProductWithSetAndSKUsResponseSchema.get_load_options())]

class ProductSearchResponseSchema(BaseModel):
    results: list[ProductWithSetAndSKUsResponseSchema]
