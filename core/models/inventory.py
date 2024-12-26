import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from uuid_extensions import uuid7

from core.models import Base
from core.models.catalog import SKU, sku_tablename

transaction_tablename = "transaction"
line_item_tablename = "line_item"


class LineItem(Base):
    __tablename__ = line_item_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    sku_id: Mapped[int] = mapped_column(ForeignKey(f"{sku_tablename}.id"))
    sku: Mapped[SKU] = relationship()
    quantity: Mapped[int]
    amount: Mapped[Decimal] = mapped_column(Numeric(scale=2))
    transaction_id: Mapped[str] = mapped_column(ForeignKey(f"{transaction_tablename}.id"))
    transaction: Mapped["Transaction"] = relationship(back_populates="line_items")

class TransactionType(StrEnum):
    PURCHASE = "PURCHASE"
    SALE = "SALE"

class Transaction(Base):
    __tablename__ = transaction_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    date: Mapped[datetime]
    type: Mapped[TransactionType]
    counterparty_name: Mapped[str | None]
    line_items: Mapped[list[LineItem]] = relationship(back_populates="transaction")
