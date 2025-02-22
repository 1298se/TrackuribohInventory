from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from pydantic import ConfigDict, BaseModel, Field, field_validator, AfterValidator
from pydantic_core import core_schema
from sqlalchemy.orm.strategy_options import _AbstractLoad

def round_money(amount: Decimal):
    return round(amount, ndigits=2)

class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return []

MoneyAmountSchema = Annotated[Decimal, AfterValidator(round_money)]

class MoneySchema(ORMModel):
    amount: MoneyAmountSchema
    currency: str

