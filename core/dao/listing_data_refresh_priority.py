"""
Data access layer for SKU listing data refresh priorities.

Provides efficient batch operations for storing and retrieving priority scores.
"""

import uuid
from typing import List, TypedDict

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from core.models.price import Marketplace, SKUListingDataRefreshPriority


class ListingDataRefreshPriorityRow(TypedDict):
    sku_id: uuid.UUID
    marketplace: Marketplace
    uptrend_score: float
    breakout_score: float
    value_score: float
    activity_score: float
    snapshot_score_raw: float
    snapshot_score: float
    sales_events_count: int
    staleness_score: float
    priority_score: float


def upsert_listing_data_refresh_priorities(
    session: Session,
    records: List[ListingDataRefreshPriorityRow],
) -> int:
    """
    Efficiently upsert listing data refresh priority records.

    Uses PostgreSQL ON CONFLICT DO UPDATE for optimal performance.

    Args:
        session: Active SQLAlchemy session
        records: List of priority records to upsert

    Returns:
        Number of records affected
    """
    if not records:
        return 0

    stmt = insert(SKUListingDataRefreshPriority).values(records)
    stmt = stmt.on_conflict_do_update(
        index_elements=["sku_id", "marketplace"],
        set_={
            "uptrend_score": stmt.excluded.uptrend_score,
            "breakout_score": stmt.excluded.breakout_score,
            "value_score": stmt.excluded.value_score,
            "activity_score": stmt.excluded.activity_score,
            "snapshot_score_raw": stmt.excluded.snapshot_score_raw,
            "snapshot_score": stmt.excluded.snapshot_score,
            "sales_events_count": stmt.excluded.sales_events_count,
            "staleness_score": stmt.excluded.staleness_score,
            "priority_score": stmt.excluded.priority_score,
        },
    )

    result = session.execute(stmt)
    session.commit()
    return result.rowcount
