"""
Data access layer for SKU market data sync state.

Provides operations for tracking when sales data was last refreshed
for each SKU/marketplace combination.
"""

import uuid
from datetime import datetime
from typing import List, Dict, Optional, TypedDict

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from core.models.sync_state import SKUMarketDataSyncState
from core.models.price import Marketplace


class SyncStateRow(TypedDict):
    sku_id: uuid.UUID
    marketplace: Marketplace
    last_sales_refresh_at: datetime


def upsert_sync_timestamps(
    session: Session,
    records: List[SyncStateRow],
) -> List[SKUMarketDataSyncState]:
    """
    Upsert sales refresh timestamps for SKU/marketplace combinations.

    Args:
        session: Active SQLAlchemy session
        records: List of sync state records to upsert

    Returns:
        List of SKUMarketDataSyncState rows that were inserted or updated
    """
    if not records:
        return []

    stmt = (
        insert(SKUMarketDataSyncState)
        .values(records)
        .on_conflict_do_update(
            index_elements=["sku_id", "marketplace"],
            set_={
                "last_sales_refresh_at": insert(
                    SKUMarketDataSyncState
                ).excluded.last_sales_refresh_at,
            },
        )
        .returning(SKUMarketDataSyncState)
    )

    result = session.execute(stmt)
    rows: List[SKUMarketDataSyncState] = result.scalars().all()
    session.flush()
    return rows


def get_sales_refresh_timestamps(
    session: Session, sku_ids: List[uuid.UUID], marketplace: Marketplace
) -> Dict[uuid.UUID, Optional[datetime]]:
    """
    Get sales refresh timestamps for a list of SKUs.

    Args:
        session: Active SQLAlchemy session
        sku_ids: List of SKU IDs to query
        marketplace: Marketplace to query

    Returns:
        Dict mapping sku_id to last_sales_refresh_at timestamp (or None if never refreshed)
    """
    if not sku_ids:
        return {}

    query = select(
        SKUMarketDataSyncState.sku_id, SKUMarketDataSyncState.last_sales_refresh_at
    ).where(
        SKUMarketDataSyncState.sku_id.in_(sku_ids),
        SKUMarketDataSyncState.marketplace == marketplace,
    )

    result = session.execute(query)

    # Create dict with default None values for all requested SKUs
    timestamps = {sku_id: None for sku_id in sku_ids}

    # Update with actual values from database
    for sku_id, last_refresh_at in result:
        timestamps[sku_id] = last_refresh_at

    return timestamps
