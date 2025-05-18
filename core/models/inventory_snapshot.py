import uuid
from datetime import date

from sqlalchemy.orm import Mapped, mapped_column
from uuid_extensions import uuid7

from core.models.base import Base


class InventorySnapshot(Base):
    """One row per catalogue per calendar date representing inventory valuation."""

    __tablename__ = "inventory_snapshot"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)

    snapshot_date: Mapped[date]
    catalog_id: Mapped[uuid.UUID]

    total_cost: Mapped[float]
    total_market_value: Mapped[float]
    unrealised_profit: Mapped[float]
