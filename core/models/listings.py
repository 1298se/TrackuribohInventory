import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, DateTime, Numeric, Index, func, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from uuid_extensions import uuid7

from core.models.base import Base
from core.models.catalog import sku_tablename
from core.models.types import TextEnum
from core.models.price import Marketplace

sales_listing_tablename = "sales_listing"


class SalesListing(Base):
    __tablename__ = sales_listing_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    sku_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{sku_tablename}.id"), nullable=False
    )
    marketplace: Mapped[Marketplace] = mapped_column(
        TextEnum(Marketplace), nullable=False
    )
    sale_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sale_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    shipping_price: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    quantity: Mapped[int] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        # Primary index for lambda_hat computation
        Index(
            "ix_sales_listing_sku_marketplace_date",
            "sku_id",
            "marketplace",
            sale_date.desc(),
        ),
        # Index for time-based queries
        Index("ix_sales_listing_date", sale_date.desc()),
        CheckConstraint("sale_price > 0", name="ck_sales_listing_price_gt_zero"),
        # Deduplication unique index
        Index(
            "ux_sales_listing_sku_mkt_date_price_ship_qty",
            "sku_id",
            "marketplace",
            "sale_date",
            "sale_price",
            func.coalesce(shipping_price, -1),
            "quantity",
            unique=True,
        ),
    )
