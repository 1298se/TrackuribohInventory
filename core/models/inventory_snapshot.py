import uuid
from datetime import date

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from uuid_extensions import uuid7

from core.models.base import Base
from core.models.user import User


class InventorySnapshot(Base):
    """One row per catalogue per calendar date representing inventory valuation."""

    __tablename__ = "inventory_snapshot"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )

    snapshot_date: Mapped[date]
    catalog_id: Mapped[uuid.UUID]

    total_cost: Mapped[float]
    total_market_value: Mapped[float]
    unrealised_profit: Mapped[float]

    user: Mapped[User] = relationship()
