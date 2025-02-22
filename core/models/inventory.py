import uuid
from datetime import datetime
from enum import StrEnum
from typing import Optional

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship, composite
from uuid_extensions import uuid7

from core.models import Base, sku_tablename, SKU
from core.models.types import Money, MoneyAmount

transaction_tablename = "transaction"
line_item_tablename = "line_item"
line_item_consumption_tablename = "line_item_consumption"


class LineItemConsumption(Base):
    __tablename__ = line_item_consumption_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)

    # The sale line item that consumes some quantity
    sale_line_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(f"{line_item_tablename}.id"))
    sale_line_item: Mapped["LineItem"] = relationship(foreign_keys=[sale_line_item_id])

    # The purchase line item from which the quantity is taken
    purchase_line_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(f"{line_item_tablename}.id"))
    purchase_line_item: Mapped["LineItem"] = relationship(foreign_keys=[purchase_line_item_id])

    # How many units were taken from that purchase line item
    quantity: Mapped[int]


class LineItem(Base):
    __tablename__ = line_item_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    sku_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(f"{sku_tablename}.id"))
    sku: Mapped[SKU] = relationship()
    quantity: Mapped[int]

    # For purchases. Sales will subtract from this number
    remaining_quantity: Mapped[Optional[int]]

    price_per_item_amount: Mapped[MoneyAmount]

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
    comment: Mapped[str | None]  # Add comment column for transactions
    line_items: Mapped[list[LineItem]] = relationship(back_populates="transaction")
    currency_code: Mapped[str]
