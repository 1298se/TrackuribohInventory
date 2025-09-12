"""
SQLAlchemy model for SKU market data sync state tracking.

This table tracks operational sync state (when data was last refreshed)
separately from scoring/priority data for better separation of concerns.
"""

from sqlalchemy import Column, DateTime
from sqlalchemy.dialects.postgresql import UUID

from core.database import Base
from core.models.price import Marketplace
from core.models.types import TextEnum


class SKUMarketDataSyncState(Base):
    """
    Tracks sync state for SKU market data across marketplaces.

    Separated from priority scoring to avoid conflicts between
    sync operations and score recomputation.
    """

    __tablename__ = "sku_market_data_sync_state"

    sku_id = Column(UUID(as_uuid=True), primary_key=True)
    marketplace = Column(TextEnum(Marketplace), primary_key=True)
    last_sales_refresh_at = Column(DateTime(timezone=True), nullable=True)
