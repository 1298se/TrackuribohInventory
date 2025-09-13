"""
Snapshot scoring service for SKU refresh prioritization.

Orchestrates the computation and persistence of snapshot-based priority scores
for SKUs, leveraging existing bulk price history infrastructure.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import List

from sqlalchemy.orm import Session

from core.alpha.snapshot_scoring import (
    _compute_snapshot_score_raw,
    compute_final_priority_score,
    LOOKBACK_BASELINE_DAYS,
    LOOKBACK_SLOPE_DAYS,
    SnapshotScoreResult,
)
from core.dao.listing_data_refresh_priority import (
    ListingDataRefreshPriorityRow,
    upsert_listing_data_refresh_priorities,
)
from core.dao.sales_listing import get_sales_event_counts_for_skus
from core.dao.sync_state import get_sales_refresh_timestamps
from core.services.price_service import build_daily_price_series_for_skus
from core.models.price import Marketplace


RECOMMENDED_FETCH_LOOKBACK_DAYS = max(LOOKBACK_BASELINE_DAYS, LOOKBACK_SLOPE_DAYS)


@dataclass(frozen=True)
class SnapshotScoresForSku:
    uptrend_score: float
    breakout_score: float
    value_score: float
    activity_score: float
    snapshot_score_raw: float
    snapshot_score: float  # normalized [0,1]


@dataclass(frozen=True)
class StalenessForSku:
    staleness_score: float
    lambda_hat: float
    delta_t_days: float
    last_sales_refresh_at: datetime | None
    sales_events_count: int


def compute_staleness_scores_for_skus(
    session: Session,
    sku_ids: List[uuid.UUID],
    marketplace: Marketplace,
    now: datetime,
) -> dict[str, StalenessForSku]:
    """
    Compute staleness scores using real sales refresh metadata and sales event rates.

    Args:
        session: Database session
        sku_ids: List of SKU IDs to compute staleness for
        marketplace: Marketplace to query
        now: Current datetime for staleness calculation

    Returns:
        Dict mapping sku_id (str) to StalenessForSku
    """
    # Get sales refresh metadata for all SKUs
    refresh_metadata = get_sales_refresh_timestamps(session, sku_ids, marketplace)

    sales_counts = get_sales_event_counts_for_skus(
        session=session,
        sku_ids=sku_ids,
        marketplace=marketplace,
        days_back=30,
    )

    result: dict[str, StalenessForSku] = {}

    for sku_id in sku_ids:
        last_refresh_at = refresh_metadata.get(sku_id)

        # Calculate delta_t_days since last refresh
        if last_refresh_at:
            delta_t_days = (now - last_refresh_at).total_seconds() / 86400
        else:
            # Never refreshed - use a large delta to indicate staleness
            delta_t_days = 365.0  # 1 year default for never-refreshed items

        # Use bulk total units sold for lambda_hat
        total_units = sales_counts.get(sku_id, 0)
        lambda_hat = total_units / 30.0

        # Calculate staleness score using the alpha formula
        # Higher lambda_hat and larger delta_t both increase staleness
        staleness_score = min(
            1.0, lambda_hat * delta_t_days / 10.0
        )  # Scale factor to get reasonable range

        # Fallback for items with no sales history - treat as moderately stale
        if lambda_hat == 0.0:
            staleness_score = 0.5 if last_refresh_at else 1.0

        # Store total units in the count field
        sales_events_count = int(total_units)

        result[str(sku_id)] = StalenessForSku(
            staleness_score=staleness_score,
            lambda_hat=lambda_hat,
            delta_t_days=delta_t_days,
            last_sales_refresh_at=last_refresh_at,
            sales_events_count=sales_events_count,
        )

    return result


def compute_snapshot_scores_for_skus(
    session: Session,
    sku_ids: List[uuid.UUID],
) -> dict[str, SnapshotScoresForSku]:
    """
    Fetch daily price series and compute raw + normalized snapshot scores for a batch of SKUs.

    Returns a mapping of sku_id (str) -> SnapshotScoresForSku.
    """
    if not sku_ids:
        return {}

    end_date = datetime.now(UTC)
    start_date = end_date - timedelta(days=RECOMMENDED_FETCH_LOOKBACK_DAYS)

    series_by_sku = build_daily_price_series_for_skus(
        session, sku_ids, start_date, end_date
    )

    raw_results: dict[str, SnapshotScoreResult] = {}

    for sku_id in sku_ids:
        points = series_by_sku.get(sku_id, [])
        prices = [float(p.price) for p in points]
        result = _compute_snapshot_score_raw(prices)

        if result is None:
            continue

        raw_results[str(sku_id)] = result

    combined: dict[str, SnapshotScoresForSku] = {}
    for sku_id_str, r in raw_results.items():
        combined[sku_id_str] = SnapshotScoresForSku(
            uptrend_score=r.uptrend_score,
            breakout_score=r.breakout_score,
            value_score=r.value_score,
            activity_score=r.activity_score,
            snapshot_score_raw=r.snapshot_score_raw,
            snapshot_score=r.snapshot_score_raw,
        )
    return combined


async def compute_and_store_scores(
    session: Session,
    sku_ids: List[uuid.UUID],
    marketplace: Marketplace = Marketplace.TCGPLAYER,
) -> int:
    """
    Compute priority scores for SKUs and persist to database.

    Args:
        session: Active SQLAlchemy session
        sku_ids: List of SKU IDs to score
        marketplace: Marketplace to score for

    Returns:
        Number of records updated
    """
    if not sku_ids:
        return 0

    # 1-3. Fetch series and compute per-SKU snapshot scores (raw + normalized)
    snapshot_scores_by_sku = compute_snapshot_scores_for_skus(
        session=session,
        sku_ids=sku_ids,
    )

    if not snapshot_scores_by_sku:
        return 0

    # 4. Compute staleness using real sales refresh metadata
    now = datetime.now(UTC)
    staleness_by_sku = compute_staleness_scores_for_skus(
        session=session, sku_ids=sku_ids, marketplace=marketplace, now=now
    )

    # 5. Merge snapshot + staleness into final records
    records: List[ListingDataRefreshPriorityRow] = []
    for sku_id_str, score in snapshot_scores_by_sku.items():
        sku_id = uuid.UUID(sku_id_str)
        staleness = staleness_by_sku.get(sku_id_str)
        staleness_score = staleness.staleness_score if staleness else 1.0
        sales_events = staleness.sales_events_count if staleness else 0

        # Compute final priority score
        final_priority = compute_final_priority_score(
            score.snapshot_score, staleness_score
        )

        record: ListingDataRefreshPriorityRow = {
            "sku_id": sku_id,
            "marketplace": marketplace,
            "uptrend_score": score.uptrend_score,
            "breakout_score": score.breakout_score,
            "value_score": score.value_score,
            "activity_score": score.activity_score,
            "snapshot_score_raw": score.snapshot_score_raw,
            "snapshot_score": score.snapshot_score,
            "sales_events_count": sales_events,
            "staleness_score": staleness_score,
            "priority_score": final_priority,
        }
        records.append(record)

    # 6. Persist to database
    return upsert_listing_data_refresh_priorities(session, records)
