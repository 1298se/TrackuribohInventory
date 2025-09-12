import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import List

from sqlalchemy import ForeignKey, DateTime, Numeric, Index, func, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from uuid_extensions import uuid7

from core.models.base import Base
from core.models.catalog import sku_tablename
from core.models.types import TextEnum
from core.models.price import Marketplace

buy_decision_tablename = "buy_decision"


class Decision(StrEnum):
    BUY = "BUY"
    PASS = "PASS"


class BuyDecision(Base):
    __tablename__ = buy_decision_tablename

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    sku_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{sku_tablename}.id"), nullable=False
    )
    marketplace: Mapped[Marketplace] = mapped_column(
        TextEnum(Marketplace), nullable=False
    )
    decision: Mapped[Decision] = mapped_column(TextEnum(Decision), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    buy_vwap: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    expected_resale_net: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=0
    )
    asof_listings: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    asof_sales: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    reason_codes: Mapped[List[str]] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        # Primary index for querying recent decisions by SKU/marketplace
        Index(
            "ix_buy_decision_sku_marketplace_created",
            "sku_id",
            "marketplace",
            created_at.desc(),
        ),
        # Index for analyzing decision patterns
        Index("ix_buy_decision_decision_created", "decision", created_at.desc()),
        # Index for finding BUY decisions
        Index(
            "ix_buy_decision_buy_only",
            "sku_id",
            "marketplace",
            postgresql_where=(decision == Decision.BUY),
        ),
    )
