from pydantic import ConfigDict, BaseModel
from sqlalchemy.orm.strategy_options import _AbstractLoad


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def get_load_options(cls) -> list[_AbstractLoad]:
        return []

