from typing import Any

from sqlalchemy import JSON, Numeric
from sqlalchemy.orm import DeclarativeBase

from core.src.models.types import MoneyAmount


class Base(DeclarativeBase):
    type_annotation_map = {
        dict[str, Any]: JSON,
        MoneyAmount: Numeric(scale=2),
    }

    pass