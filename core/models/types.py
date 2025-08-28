from dataclasses import dataclass, field
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Type, TypeVar

from sqlalchemy import TypeDecorator, Text

# The argument 2 doesn't actually do anything, just need to be passed in for Annotated construct to be valid
MoneyAmount = Annotated[Decimal, 2]

T = TypeVar("T", bound=StrEnum)


class TextEnum(TypeDecorator):
    """
    A custom SQLAlchemy type that maps StrEnum values to text columns.

    This allows enum values to be stored as text in the database without
    creating database-level enum types, avoiding the need for migrations
    when adding new enum values.

    Usage:
        class MyEnum(StrEnum):
            VALUE1 = "value1"
            VALUE2 = "value2"

        class MyModel(Base):
            my_field: Mapped[MyEnum] = mapped_column(TextEnum(MyEnum))
    """

    impl = Text
    cache_ok = True

    def __init__(self, enum_class: Type[T]):
        self.enum_class = enum_class
        super().__init__()

    def process_bind_param(self, value: T | None, dialect) -> str | None:
        """Convert StrEnum value to string for database storage."""
        if value is None:
            return None
        if not isinstance(value, self.enum_class):
            raise ValueError(
                f"Expected {self.enum_class.__name__}, got {type(value).__name__}"
            )
        return value.value

    def process_result_value(self, value: str | None, dialect) -> T | None:
        """Convert string from database back to StrEnum value."""
        if value is None:
            return None
        # This will raise ValueError if the value is not a valid enum value
        return self.enum_class(value)


@dataclass
class Money:
    amount: MoneyAmount = field(default=Decimal(0))
    currency: str = field(default="USD")
