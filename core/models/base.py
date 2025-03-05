from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Numeric
from sqlalchemy.orm import DeclarativeBase

from core.models.types import MoneyAmount


class Base(DeclarativeBase):
    type_annotation_map = {
        dict[str, Any]: JSON,
        MoneyAmount: Numeric(scale=2),
        datetime: DateTime(timezone=True),
    }
