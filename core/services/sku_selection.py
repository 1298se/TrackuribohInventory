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
    """Manages SKU candidates across tiers with single upfront database query and eager computation."""

    def __init__(self, session: Session, marketplace: Marketplace):
        self.marketplace = marketplace
        self.candidates_by_tier = {tier.name: [] for tier in TIER_CONFIGS}
        self.catalog_ids_by_sku: Dict[
            uuid.UUID, Tuple[uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID]
        ] = {}

        # Single query to fetch all SKU priorities
        all_priorities = self._fetch_all_sku_priorities(session)
        self._partition_into_tiers(all_priorities)

        # Log initial candidate counts
        for tier in TIER_CONFIGS:
            count = len(self.candidates_by_tier[tier.name])
            logger.debug(f"Tier {tier.name}: {count} candidates loaded")

    def _fetch_all_sku_priorities(self, session: Session) -> List:
        """Single database query to fetch all SKU priorities for the marketplace, with product ids and sync state."""
        query = (
            select(
                SKUListingDataRefreshPriority,
                Product.tcgplayer_id.label("product_tcgplayer_id"),
                SKUMarketDataSyncState.last_sales_refresh_at.label(
                    "last_sales_refresh_at"
                ),
                SKU.condition_id,
                SKU.printing_id,
                SKU.language_id,
                Set.catalog_id,
            )
            .join(SKU, SKU.id == SKUListingDataRefreshPriority.sku_id)
            .join(Product, Product.id == SKU.product_id)
            .join(Set, Set.id == Product.set_id)
            .outerjoin(
                SKUMarketDataSyncState,
                (SKUMarketDataSyncState.sku_id == SKUListingDataRefreshPriority.sku_id)
                & (SKUMarketDataSyncState.marketplace == self.marketplace),
            )
            .where(
                SKUListingDataRefreshPriority.marketplace == self.marketplace,
                Product.tcgplayer_id.isnot(None),
            )
            .order_by(
                SKUListingDataRefreshPriority.computed_at.asc().nulls_first(),
                SKUListingDataRefreshPriority.priority_score.desc(),
            )
        )

        results = session.execute(query).all()
        logger.debug(f"Fetched {len(results)} total SKU priorities from database")
        return results

    def _partition_into_tiers(self, all_priorities: List):
        """Partition all SKU priorities into tiers based on priority_score."""
        for row in all_priorities:
            priority_record = row[0]
            product_tcgplayer_id = row[1]
            last_sales_refresh_at = row[2]  # From sync state join
            condition_id = row[3]
            printing_id = row[4]
            language_id = row[5]
            catalog_id = row[6]

            # Store catalog IDs for later use when creating ProcessingSKU objects
            self.catalog_ids_by_sku[priority_record.sku_id] = (
                catalog_id,
                condition_id,
                printing_id,
                language_id,
            )

            # Find the appropriate tier for this priority score
            for tier in TIER_CONFIGS:
                if (
                    tier.min_priority
                    <= priority_record.priority_score
                    < tier.max_priority
                ):
                    # Calculate service score for this candidate
                    age_norm = calculate_age_norm(
                        last_sales_refresh_at, tier.target_interval_days
                    )
                    service_score = calculate_service_score(
                        priority_record.priority_score, age_norm
                    )

                    # Create Candidate object
                    candidate = Candidate(
                        sku_id=priority_record.sku_id,
                        product_tcgplayer_id=product_tcgplayer_id,
                        priority_score=priority_record.priority_score,
                        age_norm=age_norm,
                        service_score=service_score,
                        last_refresh_at=last_sales_refresh_at,
                    )

                    self.candidates_by_tier[tier.name].append(candidate)
                    break

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
        """Eagerly compute complete ordered list of SKUs to process across all tiers."""
        processing_list = []

        # Select SKUs from each tier according to budget allocation
        for tier in TIER_CONFIGS:
            quota = tier_quotas[tier.name]
            selected_candidates = self._select_from_tier(
                self.candidates_by_tier[tier.name], tier, quota
            )

            # Extract essential data for processing
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
