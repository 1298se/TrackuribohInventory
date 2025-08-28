import uuid
from datetime import datetime
from enum import StrEnum
from typing import Optional

from sqlalchemy import ForeignKey, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from uuid_extensions import uuid7

from core.models.base import Base
from core.models.catalog import sku_tablename
from core.models.catalog import SKU
from core.models.types import MoneyAmount, TextEnum
from core.models.user import User

transaction_tablename = "transaction"
line_item_tablename = "line_item"
line_item_consumption_tablename = "line_item_consumption"
platform_tablename = "platform"


class Platform(Base):
    __tablename__ = platform_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    name: Mapped[str]
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="platform")
    user: Mapped[User] = relationship()


class LineItemConsumption(Base):
    __tablename__ = line_item_consumption_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )

    # The sale line item that consumes some quantity
    sale_line_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{line_item_tablename}.id")
    )
    sale_line_item: Mapped["LineItem"] = relationship(foreign_keys=[sale_line_item_id])

    # The purchase line item from which the quantity is taken
    purchase_line_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{line_item_tablename}.id")
    )
    purchase_line_item: Mapped["LineItem"] = relationship(
        foreign_keys=[purchase_line_item_id]
    )

    # How many units were taken from that purchase line item
    quantity: Mapped[int]

    user: Mapped[User] = relationship()


class LineItem(Base):
    __tablename__ = line_item_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    sku_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(f"{sku_tablename}.id"))
    sku: Mapped[SKU] = relationship()
    quantity: Mapped[int]

    # None for Sales, non-None for purchases. Sales will subtract from this number
    remaining_quantity: Mapped[Optional[int]]

    unit_price_amount: Mapped[MoneyAmount]

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{transaction_tablename}.id")
    )
    transaction: Mapped["Transaction"] = relationship(back_populates="line_items")

    user: Mapped[User] = relationship()


class TransactionType(StrEnum):
    PURCHASE = "PURCHASE"
    SALE = "SALE"


class Transaction(Base):
    __tablename__ = transaction_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    type: Mapped[TransactionType] = mapped_column(
        TextEnum(TransactionType), nullable=False
    )
    counterparty_name: Mapped[str | None]
    comment: Mapped[str | None]  # Add comment column for transactions
    line_items: Mapped[list[LineItem]] = relationship(back_populates="transaction")
    platform_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(f"{platform_tablename}.id"), nullable=True
    )
    platform: Mapped[Optional[Platform]] = relationship(back_populates="transactions")
    platform_order_id: Mapped[str | None] = mapped_column(String, nullable=True)
    currency: Mapped[str] = mapped_column(server_default="USD")
    shipping_cost_amount: Mapped[MoneyAmount] = mapped_column(server_default="0")
    tax_amount: Mapped[MoneyAmount] = mapped_column(server_default="0")

    user: Mapped[User] = relationship()
