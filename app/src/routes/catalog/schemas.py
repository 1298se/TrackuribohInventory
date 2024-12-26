import uuid

from pydantic import BaseModel

from core.services.schemas.schema import ProductType

class PrintingResponseSchema(BaseModel):
    name: str

class LanguageResponseSchema(BaseModel):
    name: str
    abbreviation: str

class ConditionResponseSchema(BaseModel):
    name: str
    abbreviation: str

class ProductBaseResponseSchema(BaseModel):
    id: uuid.UUID
    name: str
    tcgplayer_url: str
    image_url: str
    product_type: ProductType
    data: list[dict[str, str]]

class SKUBaseResponseSchema(BaseModel):
    condition: ConditionResponseSchema
    printing: PrintingResponseSchema
    language: LanguageResponseSchema

class ProductWithSKUsResponseSchema(ProductBaseResponseSchema):
    skus: list[SKUBaseResponseSchema]

class SKUWithProductResponseSchema(BaseModel):
    product: ProductWithSKUsResponseSchema
