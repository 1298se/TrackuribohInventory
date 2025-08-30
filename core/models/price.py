import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, DateTime, Numeric, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from core.models.base import Base
from core.models.catalog import sku_tablename
from core.models.types import TextEnum
# from core.models.types import Money, MoneyAmount # No longer used in this file

sku_price_snapshot_job_tablename = "sku_price_snapshot_job"
# sku_price_snapshot_tablename = "sku_price_snapshot" # Mark for removal
# sku_listing_snapshot_tablename = "sku_listing_snapshot" # Mark for removal
sku_price_data_snapshot_tablename = "sku_price_data_snapshot"
sku_latest_price_tablename = "sku_latest_price"


# class SKULatestPriceData(Base): ... # Entire class removed


class SnapshotSource(enum.Enum):
    DAILY_HISTORY = "daily_history"
    INVENTORY_UPDATE = "inventory_update"


class Marketplace(enum.StrEnum):
    TCGPLAYER = "tcgplayer"


class SKULatestPrice(Base):
    __tablename__ = sku_latest_price_tablename

    sku_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{sku_tablename}.id"), primary_key=True
    )
    marketplace: Mapped[Marketplace] = mapped_column(
        TextEnum(Marketplace), nullable=False, primary_key=True
    )
    lowest_listing_price_total: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        server_onupdate=func.now(),
    )

    __table_args__ = (
        Index(
            "ix_sku_latest_price_marketplace_updated_at",
            "marketplace",
            updated_at.desc(),
        ),
    )


class SKUPriceDataSnapshot(Base):
    __tablename__ = sku_price_data_snapshot_tablename

    sku_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{sku_tablename}.id"), primary_key=True
    )
    marketplace: Mapped[Marketplace] = mapped_column(
        TextEnum(Marketplace), nullable=False, primary_key=True
    )
    snapshot_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True
    )
    lowest_listing_price_total: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False
    )

    # Add composite index for efficient retrieval of latest price per SKU per marketplace
    __table_args__ = (
        # Covering index that includes the price data to avoid table lookups
        Index(
            "ix_sku_price_snapshot_covering",
            "sku_id",
            "marketplace",
            snapshot_datetime.desc(),
            "lowest_listing_price_total",
        ),
    )
