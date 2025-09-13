import logging
import math
import random
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, NamedTuple, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.models.price import SKUListingDataRefreshPriority, Marketplace
from core.models.catalog import SKU, Product, Set
from core.models.sync_state import SKUMarketDataSyncState


logger = logging.getLogger(__name__)


class TierConfig(NamedTuple):
    name: str
    min_priority: float
    max_priority: float
    budget_share: float
    temperature: float
    target_interval_days: int


class Candidate(NamedTuple):
    sku_id: uuid.UUID
    product_tcgplayer_id: int
    priority_score: float
    age_norm: float
    service_score: float
    last_refresh_at: Optional[datetime]


class ProcessingSKU(NamedTuple):
    sku_id: uuid.UUID
    product_tcgplayer_id: int
    catalog_id: uuid.UUID
    condition_id: uuid.UUID
    printing_id: uuid.UUID
    language_id: uuid.UUID


# Configuration constants
TIER_CONFIGS = [
    TierConfig(
        name="A",
        min_priority=0.80,
        max_priority=1.00,
        budget_share=0.60,
        temperature=0.04,
        target_interval_days=2,
    ),  # High priority, tight temperature
    TierConfig(
        name="B",
        min_priority=0.70,
        max_priority=0.80,
        budget_share=0.30,
        temperature=0.07,
        target_interval_days=4,
    ),  # Medium priority
    TierConfig(
        name="C",
        min_priority=0.60,
        max_priority=0.70,
        budget_share=0.10,
        temperature=0.11,
        target_interval_days=7,
    ),  # Lower priority, loose temperature
]

SERVICE_SCORE_WEIGHTS = {"age": 0.7, "priority": 0.3}
TOP_L_WINDOW = 20
MIN_WINDOW_SIZE = 5
# Oversample factor for phase 1 candidate fetch per tier to allow softmax sampling
OVERSAMPLE_FACTOR = 3


def calculate_age_norm(
    last_refresh_at: Optional[datetime], target_interval_days: int
) -> float:
    """Calculate normalized age score (0.0 to 1.0) using sigmoid function."""
    if last_refresh_at is None:
        return 1.0  # Never refreshed gets max staleness

    now = datetime.now(timezone.utc)
    days_since_refresh = (now - last_refresh_at).total_seconds() / 86400
    staleness_ratio = days_since_refresh / target_interval_days

    # Sigmoid normalization: steeper curve that reaches ~0.86 at target interval
    return 1.0 - math.exp(-2 * staleness_ratio)


def calculate_service_score(priority_score: float, age_norm: float) -> float:
    """Calculate service score using weighted combination."""
    return SERVICE_SCORE_WEIGHTS["age"] * age_norm + SERVICE_SCORE_WEIGHTS[
        "priority"
    ] * float(priority_score)


class TierCandidates:
    """Manages SKU candidates across tiers with efficient two-phase selection."""

    def __init__(self, session: Session, marketplace: Marketplace):
        self.marketplace = marketplace
        self.session = session
        self.candidates_by_tier = {tier.name: [] for tier in TIER_CONFIGS}
        self.catalog_ids_by_sku: Dict[
            uuid.UUID, Tuple[uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID]
        ] = {}

    def _fetch_candidate_ids_for_tier(
        self, tier: TierConfig, limit: int
    ) -> List[Tuple[uuid.UUID, float]]:
        """Phase 1: Fetch a limited number of high-priority sku_ids for the tier without joins.

        Returns list of (sku_id, priority_score) tuples ordered by priority_score desc.
        """
        if limit <= 0:
            return []

        query = (
            select(
                SKUListingDataRefreshPriority.sku_id,
                SKUListingDataRefreshPriority.priority_score,
            )
            .where(
                SKUListingDataRefreshPriority.marketplace == self.marketplace,
                SKUListingDataRefreshPriority.priority_score >= tier.min_priority,
                SKUListingDataRefreshPriority.priority_score < tier.max_priority,
            )
            .order_by(SKUListingDataRefreshPriority.priority_score.desc())
            .limit(limit)
        )
        rows = self.session.execute(query).all()
        logger.debug(
            f"Fetched {len(rows)} candidate ids for tier {tier.name} (limit={limit})"
        )
        return [(row[0], float(row[1])) for row in rows]

    def _load_metadata_for_skus(
        self, sku_ids: List[uuid.UUID]
    ) -> Dict[
        uuid.UUID,
        Tuple[int, Optional[datetime], uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID],
    ]:
        """Phase 2: Batch-load metadata to compute service scores and build processing SKUs.

        Returns mapping sku_id -> (product_tcgplayer_id, last_sales_refresh_at,
                                   condition_id, printing_id, language_id, catalog_id)
        """
        if not sku_ids:
            return {}

        query = (
            select(
                SKU.id,
                Product.tcgplayer_id.label("product_tcgplayer_id"),
                SKUMarketDataSyncState.last_sales_refresh_at.label(
                    "last_sales_refresh_at"
                ),
                SKU.condition_id,
                SKU.printing_id,
                SKU.language_id,
                Set.catalog_id,
            )
            .join(Product, Product.id == SKU.product_id)
            .join(Set, Set.id == Product.set_id)
            .outerjoin(
                SKUMarketDataSyncState,
                (SKUMarketDataSyncState.sku_id == SKU.id)
                & (SKUMarketDataSyncState.marketplace == self.marketplace),
            )
            .where(SKU.id.in_(sku_ids))
            .where(Product.tcgplayer_id.isnot(None))
        )
        rows = self.session.execute(query).all()
        metadata: Dict[
            uuid.UUID,
            Tuple[int, Optional[datetime], uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID],
        ] = {}
        for row in rows:
            (
                sku_id,
                product_tcgplayer_id,
                last_sales_refresh_at,
                condition_id,
                printing_id,
                language_id,
                catalog_id,
            ) = row
            metadata[sku_id] = (
                int(product_tcgplayer_id),
                last_sales_refresh_at,
                condition_id,
                printing_id,
                language_id,
                catalog_id,
            )
        logger.debug(f"Loaded metadata for {len(metadata)} SKUs")
        return metadata

    def _select_from_tier(
        self, candidates: List[Candidate], tier: TierConfig, count: int
    ) -> List[Candidate]:
        """Select multiple SKUs from a tier using softmax sampling within top-L window."""
        if not candidates or count <= 0:
            return []

        selected = []
        available = candidates.copy()  # Work with a copy to avoid modifying original

        for _ in range(min(count, len(available))):
            # Softmax sampling within top-L window
            window_size = max(MIN_WINDOW_SIZE, min(TOP_L_WINDOW, len(available)))
            window = available[:window_size]

            # Calculate softmax probabilities
            scores = [c.service_score for c in window]
            max_score = max(scores)
            exp_scores = [
                math.exp((score - max_score) / tier.temperature) for score in scores
            ]
            total_exp = sum(exp_scores)
            probabilities = [exp_score / total_exp for exp_score in exp_scores]

            # Weighted random selection
            rand_val = random.random()
            cumulative = 0.0
            chosen = window[-1]  # fallback
            for i, prob in enumerate(probabilities):
                cumulative += prob
                if rand_val <= cumulative:
                    chosen = window[i]
                    break

            selected.append(chosen)
            available.remove(chosen)

        return selected

    def get_ordered_processing_list(
        self, tier_quotas: Dict[str, int]
    ) -> List[ProcessingSKU]:
        """Compute ordered list of SKUs to process using two-phase selection."""
        # Phase 1: fetch candidate ids per tier (oversampled)
        per_tier_candidates: Dict[str, List[Tuple[uuid.UUID, float]]] = {}
        all_sku_ids: List[uuid.UUID] = []
        for tier in TIER_CONFIGS:
            quota = tier_quotas.get(tier.name, 0)
            limit = max(quota * OVERSAMPLE_FACTOR, 0)
            ids_with_scores = self._fetch_candidate_ids_for_tier(tier, limit)
            per_tier_candidates[tier.name] = ids_with_scores
            for sku_id, _ in ids_with_scores:
                all_sku_ids.append(sku_id)

        # Short-circuit if nothing to do
        if not all_sku_ids:
            logger.debug("No candidates found across all tiers")
            return []

        # Phase 2: batch-load metadata for all unique sku_ids
        unique_sku_ids = list(dict.fromkeys(all_sku_ids))
        metadata_by_sku = self._load_metadata_for_skus(unique_sku_ids)

        # Build Candidate objects per tier with computed service_score
        self.candidates_by_tier = {tier.name: [] for tier in TIER_CONFIGS}
        self.catalog_ids_by_sku.clear()

        for tier in TIER_CONFIGS:
            tier_candidates = []
            for sku_id, priority_score in per_tier_candidates.get(tier.name, []):
                meta = metadata_by_sku.get(sku_id)
                if not meta:
                    continue
                (
                    product_tcgplayer_id,
                    last_sales_refresh_at,
                    condition_id,
                    printing_id,
                    language_id,
                    catalog_id,
                ) = meta

                # Store catalog IDs for ProcessingSKU later
                self.catalog_ids_by_sku[sku_id] = (
                    catalog_id,
                    condition_id,
                    printing_id,
                    language_id,
                )

                age_norm = calculate_age_norm(
                    last_sales_refresh_at, tier.target_interval_days
                )
                service_score = calculate_service_score(priority_score, age_norm)

                tier_candidates.append(
                    Candidate(
                        sku_id=sku_id,
                        product_tcgplayer_id=product_tcgplayer_id,
                        priority_score=priority_score,
                        age_norm=age_norm,
                        service_score=service_score,
                        last_refresh_at=last_sales_refresh_at,
                    )
                )

            # Sort candidates by service_score desc to make windowing effective
            tier_candidates.sort(key=lambda c: c.service_score, reverse=True)
            self.candidates_by_tier[tier.name] = tier_candidates
            logger.debug(f"Tier {tier.name}: {len(tier_candidates)} candidates loaded")

        # Select SKUs from each tier according to budget allocation
        processing_list: List[ProcessingSKU] = []
        for tier in TIER_CONFIGS:
            quota = tier_quotas.get(tier.name, 0)
            selected_candidates = self._select_from_tier(
                self.candidates_by_tier[tier.name], tier, quota
            )

            for candidate in selected_candidates:
                catalog_id, condition_id, printing_id, language_id = (
                    self.catalog_ids_by_sku[candidate.sku_id]
                )
                processing_sku = ProcessingSKU(
                    sku_id=candidate.sku_id,
                    product_tcgplayer_id=candidate.product_tcgplayer_id,
                    catalog_id=catalog_id,
                    condition_id=condition_id,
                    printing_id=printing_id,
                    language_id=language_id,
                )
                processing_list.append(processing_sku)

        logger.debug(
            f"Generated processing list with {len(processing_list)} SKUs across all tiers"
        )

        return processing_list
