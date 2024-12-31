from datetime import datetime

from sqlalchemy import Column, Integer, Numeric, DateTime

from src.models import Base

class SKUPricingHistory(Base):
    __tablename__ = 'sku_pricing_history'

    id = Column(Integer, primary_key=True)
    sku_id = Column(Integer, index=True, nullable=False)
    low_price = Column(Numeric(10, 2), nullable=True)
    lowest_shipping = Column(Numeric(10, 2), nullable=True)
    lowest_listing_price = Column(Numeric(10, 2), nullable=True)
    market_price = Column(Numeric(10, 2), nullable=True)
    direct_low_price = Column(Numeric(10, 2), nullable=True)
    recorded_at = Column(DateTime, default=datetime.now(), nullable=False)
