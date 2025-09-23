"""Utility for resolving eBay EPIDs for internal products."""

from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable

from core.services.ebay_api_client import EbayAPIClient, EbayBrowseSearchRequest
from core.services.schemas.ebay import BrowseSearchResponseSchema


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ProductSearchInput:
    """Minimal product metadata required to construct eBay search queries."""

    clean_name: str | None = None
    number: str | None = None
    set_code: str | None = None


class EbayProductResolver:
    """Resolver that will map internal products to eBay EPIDs."""

    DEFAULT_CATEGORY_ID = "183454"  # CCG Individual Cards category
    DEFAULT_LIMIT = 25

    def __init__(self, api_client: EbayAPIClient | None = None) -> None:
        self.api_client = api_client or EbayAPIClient()

    async def resolve(self, product: ProductSearchInput) -> str | None:
        """Attempt to find the best-matching EPID for the provided product."""

        epid_counts: dict[str, int] = defaultdict(int)

        for query in self._build_candidate_queries(product):
            response = await self._execute_search(query)
            if response is None:
                continue

            for item in response.item_summaries:
                epid = getattr(item, "epid", None)
                if epid:
                    epid_counts[str(epid)] += 1

        if not epid_counts:
            return None

        best_epid, best_count = max(epid_counts.items(), key=lambda kv: kv[1])
        total_hits = sum(epid_counts.values())

        logger.debug(
            "Resolved search input (%s, %s, %s) to EPID=%s using %d/%d supporting listings",
            product.clean_name,
            product.number,
            product.set_code,
            best_epid,
            best_count,
            total_hits,
        )

        return best_epid

    def _build_candidate_queries(self, product: ProductSearchInput) -> Iterable[str]:
        """Construct initial query strings based on product metadata."""

        parts = [
            (product.clean_name or "").strip(),
            (product.number or "").strip(),
            (product.set_code or "").strip(),
        ]

        query = " ".join(part for part in parts if part)
        if query:
            yield query

    async def _execute_search(self, query: str) -> BrowseSearchResponseSchema | None:
        """Execute a browse search and return the raw response model."""

        request: EbayBrowseSearchRequest = {
            "query": query,
            "limit": self.DEFAULT_LIMIT,
            "category_ids": [self.DEFAULT_CATEGORY_ID],
        }

        try:
            return await self.api_client.browse_item_summary_search(request)
        except Exception as exc:  # pragma: no cover - network/runtime guard
            logger.warning(
                "eBay search failed for query='%s': %s", query, exc, exc_info=True
            )
            return None
