import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship, composite
from uuid_extensions import uuid7

from core.models import Base, sku_tablename, SKU
from core.models.types import Money

transaction_tablename = "transaction"
line_item_tablename = "line_item"

class LineItem(Base):
    __tablename__ = line_item_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    sku_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(f"{sku_tablename}.id"))
    sku: Mapped[SKU] = relationship()
    quantity: Mapped[int]

    price_per_item: Mapped[Money] = composite(
        mapped_column("amount"),
        mapped_column("currency")
    )
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
