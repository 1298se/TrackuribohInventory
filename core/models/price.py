import uuid
from datetime import datetime, UTC
from typing import Optional, Tuple

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, composite, mapped_column

from core.models import Base, sku_tablename
from core.models.types import Money, MoneyAmount


class SKUPriceSnapshot(Base):
    __tablename__ = "sku_price_snapshot"

    sku_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(f"{sku_tablename}.id"), primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(primary_key=True, default=lambda : datetime.now(UTC))

    id: Mapped[Tuple[uuid.UUID, datetime]] = composite("sku_id", "timestamp")

    _lowest_listing_price_amount: Mapped[Optional[MoneyAmount]]
    _lowest_listing_price_currency: Mapped[Optional[str]]

    _market_price_amount: Mapped[Optional[MoneyAmount]]
    _market_price_currency: Mapped[Optional[str]]

    # I don't know a good way to have optional composite key
    @property
    def lowest_listing_price_amount(self) -> Optional[MoneyAmount]:
        return Money(
            amount=self._lowest_listing_price_amount,
            currency=self._lowest_listing_price_currency,
        ) if self._lowest_listing_price_amount else None

    @property
    def market_price_amount(self) -> Optional[MoneyAmount]:
        return Money(
            amount=self._market_price_amount,
            currency=self._market_price_currency,
        ) if self._market_price_amount else None
