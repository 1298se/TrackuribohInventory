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
    calculate_lambda_hat,
    compute_final_priority_score,
    LOOKBACK_BASELINE_DAYS,
    LOOKBACK_SLOPE_DAYS,
    SnapshotScoreResult,
)
from core.dao.listing_data_refresh_priority import (
    ListingDataRefreshPriorityRow,
    upsert_listing_data_refresh_priorities,
)
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


# NOTE: This helper is prepared for the future sales-refresh integration.
# For now, we do not store last_sales_refresh_at on listing priorities, nor do we
# fetch sales listings yet. As a stopgap, treat items as maximally stale.
# When sales listing refresh metadata is available, compute per-SKU staleness
# using real last refresh timestamps and observed sales activity.


def compute_staleness_scores_for_skus(
    sku_ids: List[uuid.UUID],
    now: datetime,
) -> dict[str, StalenessForSku]:
    """
    Temporary staleness computation.

    Since we are not yet persisting sales listing refresh timestamps, treat every
    SKU as maximally stale (1.0). Use a minimal lambda_hat derived from a 0 sales
    rate over a 30-day window for completeness.
    """
    result: dict[str, StalenessForSku] = {}
    for sku_id in sku_ids:
        lambda_hat = calculate_lambda_hat(0, 30)
        result[str(sku_id)] = StalenessForSku(
            staleness_score=1.0,
            lambda_hat=lambda_hat,
            delta_t_days=0.0,
            last_sales_refresh_at=None,
            sales_events_count=0,
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

    # 4. Compute staleness (temporary: all 1.0 until sales listing refresh metadata is available)
    now = datetime.now(UTC)
    staleness_by_sku = compute_staleness_scores_for_skus(sku_ids=sku_ids, now=now)

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
