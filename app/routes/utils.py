from decimal import Decimal
from typing import Annotated

from pydantic import ConfigDict, BaseModel, Field, field_validator, AfterValidator
from sqlalchemy.orm.strategy_options import _AbstractLoad

def round_money(amount: Decimal):
    return round(amount, ndigits=2)

class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return []

class MoneySchema(ORMModel):
    amount: Annotated[Decimal, AfterValidator(round_money)]
    currency: str

