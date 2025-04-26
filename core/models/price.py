import uuid
from datetime import datetime, UTC
from typing import Optional, Tuple

from sqlalchemy import ForeignKey, DateTime
from sqlalchemy.orm import Mapped, composite, mapped_column, relationship

from core.models.base import Base
from core.models.catalog import sku_tablename
from core.models.types import Money, MoneyAmount

sku_price_snapshot_job_tablename = "sku_price_snapshot_job"
sku_price_snapshot_tablename = "sku_price_snapshot"
sku_listing_snapshot_tablename = "sku_listing_snapshot"


class SKULatestPriceData(Base):
    __tablename__ = "sku_latest_price_data"

    sku_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{sku_tablename}.id"), primary_key=True
    )

    lowest_listing_price_amount: Mapped[Optional[MoneyAmount]]
    market_price_amount: Mapped[Optional[MoneyAmount]]
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SKUPriceSnapshotJob(Base):
    __tablename__ = sku_price_snapshot_job_tablename

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    snapshots: Mapped[list["SKUPriceSnapshot"]] = relationship(back_populates="job")


class SKUListingSnapshot(Base):
    __tablename__ = sku_listing_snapshot_tablename

    sku_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{sku_tablename}.id"), primary_key=True
    )
    job_id: Mapped[int] = mapped_column(
        ForeignKey(f"{sku_price_snapshot_job_tablename}.id"), primary_key=True
    )
    job: Mapped[SKUPriceSnapshotJob] = relationship()

    id: Mapped[Tuple[uuid.UUID, int]] = composite("sku_id", "job_id")


class SKUPriceSnapshot(Base):
    __tablename__ = sku_price_snapshot_tablename

    sku_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{sku_tablename}.id"), primary_key=True
    )
    job_id: Mapped[int] = mapped_column(
        ForeignKey(f"{sku_price_snapshot_job_tablename}.id"), primary_key=True
    )
    job: Mapped[SKUPriceSnapshotJob] = relationship()

    id: Mapped[Tuple[uuid.UUID, int]] = composite("sku_id", "job_id")

    _lowest_listing_price_amount: Mapped[Optional[MoneyAmount]]
    _lowest_listing_price_currency: Mapped[Optional[str]]

    _market_price_amount: Mapped[Optional[MoneyAmount]]
    _market_price_currency: Mapped[Optional[str]]

    # I don't know a good way to have optional composite key
    @property
    def lowest_listing_price_amount(self) -> Optional[MoneyAmount]:
        return (
            Money(
                amount=self._lowest_listing_price_amount,
                currency=self._lowest_listing_price_currency,
            )
            if self._lowest_listing_price_amount
            else None
        )

    @property
    def market_price_amount(self) -> Optional[MoneyAmount]:
        return (
            Money(
                amount=self._market_price_amount,
                currency=self._market_price_currency,
            )
            if self._market_price_amount
            else None
        )
