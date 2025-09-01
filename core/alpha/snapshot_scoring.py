"""
Snapshot scoring algorithms for SKU refresh prioritization.

Implements the four-component scoring system from the sales refresh priority spec:
1. Uptrend strength (momentum)
2. Breakout proximity (technical analysis)
3. Value opportunity (relative pricing)
4. Activity/turnover (market dynamics)

All algorithms operate on daily price arrays from normalized price history.
"""

import math
from typing import List, Tuple, Optional
from dataclasses import dataclass

import numpy as np


# Constants from spec
LOOKBACK_SLOPE_DAYS = 14
BETA_UP_CAP = 0.02  # +2%/day => full score
LOOKBACK_BASELINE_DAYS = 30
BREAKOUT_Q = 0.90
BREAKOUT_CAP = 0.12  # +12% over prior P90 => full score
TRIM_Q = 0.10  # Winsorization quantile
VALUE_CAP = 0.25  # 25% under baseline => full score
EPS_CHANGE = 0.01  # 1% change threshold

# Component weights (sum to 1.0)
W_UP = 0.35
W_BO = 0.30
W_VAL = 0.25
W_ACT = 0.10

# Final priority weights (from spec)
W_SNAP = 0.55  # Snapshot score weight
W_STALE = 0.45  # Staleness score weight

# Staleness parameters
LAMBDA_MIN_FLOOR = 1.0 / 28.0  # Minimum lambda_hat (1/28 days)


def _slope_pct_per_day(
    prices: List[float], lookback: int = LOOKBACK_SLOPE_DAYS
) -> float:
    """
    Calculate robust log-linear regression slope over lookback period.

    Args:
        prices: Daily price array, oldest to newest
        lookback: Number of days to analyze

    Returns:
        Slope in log space (approximately %/day)
    """
    if not prices or len(prices) < 5:
        return 0.0

    arr = np.asarray(prices[-lookback:], dtype=float)
    if arr.size < 5 or np.any(arr <= 0):
        return 0.0

    # Log transform and robust trimming
    x = np.arange(arr.size)
    y = np.log(arr)
    lo, hi = np.quantile(y, [0.1, 0.9])
    y = np.clip(y, lo, hi)

    # Linear regression
    slope, _ = np.polyfit(x, y, 1)
    return float(slope)


def _uptrend_score_from_beta(beta: float, cap: float = BETA_UP_CAP) -> float:
    """
    Convert positive slope to uptrend score [0,1].

    Args:
        beta: Slope from slope_pct_per_day
        cap: Maximum slope for full score

    Returns:
        Uptrend score [0,1]
    """
    return float(np.clip(max(0.0, beta) / cap, 0.0, 1.0))


def _breakout_score_from_history(
    prices: List[float],
    lookback: int = LOOKBACK_BASELINE_DAYS,
    q: float = BREAKOUT_Q,
    cap: float = BREAKOUT_CAP,
) -> float:
    """
    Calculate breakout proximity score based on prior high band.

    Args:
        prices: Daily price array, oldest to newest
        lookback: Days to look back for baseline (excluding today)
        q: Quantile for high band (0.90 = P90)
        cap: Maximum gap over P90 for full score

    Returns:
        Breakout score [0,1]
    """
    if not prices or len(prices) < 3:
        return 0.0

    arr = np.asarray(prices[-(lookback + 1) :], dtype=float)
    if arr.size < 3 or arr[-1] <= 0:
        return 0.0

    # Prior window excludes today
    prev = arr[:-1]
    if len(prev) == 0:
        return 0.0

    Pq = np.quantile(prev, q)
    if Pq <= 0:
        return 0.0

    # Gap above prior high band
    gap = (arr[-1] - Pq) / Pq
    return float(np.clip(gap / cap, 0.0, 1.0))


def _robust_baseline(
    prices: List[float], lookback: int = LOOKBACK_BASELINE_DAYS, trim_q: float = TRIM_Q
) -> float:
    """
    Calculate winsorized baseline price for value comparison.

    Args:
        prices: Daily price array
        lookback: Days to include in baseline
        trim_q: Trimming quantile for winsorization

    Returns:
        Robust baseline price, or NaN if invalid
    """
    if not prices or len(prices) == 0:
        return float("nan")

    arr = np.asarray(prices[-lookback:], dtype=float)
    if arr.size == 0 or np.all(arr <= 0):
        return float("nan")

    # Winsorize and take median
    lo, hi = np.quantile(arr, [trim_q, 1 - trim_q])
    arr_w = np.clip(arr, lo, hi)
    return float(np.median(arr_w))


def _value_score_today(
    prices: List[float], cap: float = VALUE_CAP
) -> Tuple[float, float]:
    """
    Calculate value opportunity score (discount from baseline).

    Args:
        prices: Daily price array, oldest to newest
        cap: Maximum discount for full score

    Returns:
        Tuple of (value_score, baseline_price)
    """
    if not prices or len(prices) == 0:
        return 0.0, float("nan")

    p0 = float(prices[-1])
    base = _robust_baseline(prices)

    if math.isnan(base) or base <= 0:
        return 0.0, base

    # Discount from baseline
    gap = (base - p0) / base
    return float(np.clip(gap / cap, 0.0, 1.0)), base


def _activity_score_from_changes(
    prices: List[float], lookback: int = LOOKBACK_BASELINE_DAYS, eps: float = EPS_CHANGE
) -> float:
    """
    Calculate activity score from price movement patterns.

    Combines change frequency with recent uptick recency.

    Args:
        prices: Daily price array
        lookback: Days to analyze
        eps: Minimum change threshold (1% default)

    Returns:
        Activity score [0,1]
    """
    if not prices or len(prices) < 2:
        return 0.0

    arr = np.asarray(prices[-lookback:], dtype=float)
    if arr.size < 2:
        return 0.0

    # Day-over-day percentage changes
    prev, cur = arr[:-1], arr[1:]
    pct = (cur - prev) / np.clip(prev, 1e-9, None)

    # Change frequency (fraction of days with >eps change)
    change_rate = float(np.mean(np.abs(pct) > eps))

    # Recent uptick bonus
    last_up_idx = np.where(pct > 0)[0]
    if last_up_idx.size == 0:
        recency_bonus = 0.0
    else:
        days_since_last_up = arr.size - 1 - last_up_idx[-1]
        recency_bonus = np.clip(1 - (days_since_last_up / 7.0), 0.0, 1.0)

    # Weighted combination
    return float(0.7 * change_rate + 0.3 * recency_bonus)


@dataclass(frozen=True)
class SnapshotScoreResult:
    """
    Result of computing a snapshot score for a single SKU.

    All fields are present for valid inputs. For insufficient/invalid input, the
    scorer returns None instead of a partially-filled object.
    """

    snapshot_score_raw: float
    uptrend_score: float
    breakout_score: float
    value_score: float
    activity_score: float


def _compute_snapshot_score_raw(prices: List[float]) -> Optional[SnapshotScoreResult]:
    """
    Compute weighted combination of all four component scores.

    Args:
        prices: Daily price array, oldest to newest

    Returns:
        SnapshotScoreResult for valid inputs; None if insufficient/invalid input.
    """
    if len(prices) == 0 or prices[-1] <= 0:
        return None

    # Compute all components
    beta = _slope_pct_per_day(prices)
    up_score = _uptrend_score_from_beta(beta)
    bo_score = _breakout_score_from_history(prices)
    val_score, baseline = _value_score_today(prices)
    act_score = _activity_score_from_changes(prices)

    # Weighted combination
    raw = W_UP * up_score + W_BO * bo_score + W_VAL * val_score + W_ACT * act_score

    return SnapshotScoreResult(
        snapshot_score_raw=float(raw),
        uptrend_score=up_score,
        breakout_score=bo_score,
        value_score=val_score,
        activity_score=act_score,
    )


def calculate_lambda_hat(sales_events_count: int, days_observed: int) -> float:
    """
    Estimate the sales-rate parameter (λ̂, sales/day) used in the staleness decay.

    Current approach is intentionally simple and robust:
    - Compute a naive rate over the provided window: sales_per_day = events / days
    - Apply a floor: λ̂ = max(sales_per_day, 1/28) to ensure very slow items still get refreshed

    Notes for future improvement:
    - Consider an EWMA (exponential moving average) of sales counts over time to reduce noise
      and provide smoother, more responsive estimates than a hard window.
    - Segment- or catalog-specific floors could better reflect heterogeneous turnover.

    Args:
        sales_events_count: Number of sales events observed in the window
        days_observed: Window length in days (must be > 0 to compute a rate)

    Returns:
        Estimated λ̂ (sales/day)
    """
    if days_observed <= 0:
        return LAMBDA_MIN_FLOOR

    # Sales rate per day
    sales_per_day = sales_events_count / days_observed

    # Spec formula: lambda_hat = max(sales_per_day, 1/28)
    lambda_hat = max(sales_per_day, LAMBDA_MIN_FLOOR)

    return float(lambda_hat)


def calculate_staleness_score(delta_t_days: float, lambda_hat: float) -> float:
    """
    Calculate staleness score using exponential decay function per spec.

    Formula: staleness = 1 - e^(-λt)

    Args:
        delta_t_days: Continuous days since last sales data refresh
        lambda_hat: Adaptive decay rate

    Returns:
        Staleness score [0,1], where 1 = most stale
    """
    if delta_t_days <= 0:
        return 0.0

    # Exponential decay: 1 - e^(-λt) with no max-days cap per spec
    staleness = 1.0 - math.exp(-lambda_hat * delta_t_days)

    return float(np.clip(staleness, 0.0, 1.0))


def compute_final_priority_score(
    snapshot_score: float,
    staleness_score: float,
    w_snap: float = W_SNAP,
    w_stale: float = W_STALE,
) -> float:
    """
    Compute final priority score as weighted combination of snapshot and staleness.

    Args:
        snapshot_score: Normalized snapshot score [0,1]
        staleness_score: Staleness score [0,1]
        w_snap: Weight for snapshot component
        w_stale: Weight for staleness component

    Returns:
        Final priority score [0,1]
    """
    return float(w_snap * snapshot_score + w_stale * staleness_score)
