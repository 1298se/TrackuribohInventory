import uuid
from datetime import datetime, UTC
from decimal import Decimal
from typing import Optional

from sqlalchemy import ForeignKey, DateTime, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from core.models.base import Base
from core.models.catalog import sku_tablename
# from core.models.types import Money, MoneyAmount # No longer used in this file

sku_price_snapshot_job_tablename = "sku_price_snapshot_job"
# sku_price_snapshot_tablename = "sku_price_snapshot" # Mark for removal
# sku_listing_snapshot_tablename = "sku_listing_snapshot" # Mark for removal
sku_price_data_snapshot_tablename = "sku_price_data_snapshot"


# class SKULatestPriceData(Base): ... # Entire class removed


class SKUPriceSnapshotJob(Base):
    __tablename__ = sku_price_snapshot_job_tablename

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    end_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class SKUPriceDataSnapshot(Base):
    __tablename__ = sku_price_data_snapshot_tablename

    sku_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{sku_tablename}.id"), primary_key=True
    )
    snapshot_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True
    )
    job_id: Mapped[int] = mapped_column(
        ForeignKey(f"{sku_price_snapshot_job_tablename}.id"), nullable=False
    )
    lowest_listing_price_total: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False
    )

    # Composite primary key is defined by setting primary_key=True on the respective columns.
    # For an explicit named constraint (optional, usually not needed if PK definition is sufficient):
    # from sqlalchemy import UniqueConstraint
    # __table_args__ = (UniqueConstraint('sku_id', 'snapshot_date', name='uq_sku_price_data_snapshot_sku_date'),)
