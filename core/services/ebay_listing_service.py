"""Service for fetching enriched unified eBay marketplace listings with card condition data."""

from __future__ import annotations

import asyncio
import logging
from decimal import Decimal
from typing import List, Optional, TypedDict, NotRequired, Tuple

import redis.asyncio as redis
from fastapi import Depends

from core.models.price import Marketplace
from core.services.base_marketplace_listing_service import BaseMarketplaceListingService
from core.services.ebay_api_client import (
    EbayAPIClient,
    EbayBrowseSearchRequest,
    get_ebay_api_client,
)
from core.services.redis_service import get_redis_client
from core.services.schemas.ebay import (
    BrowseSearchResponseSchema,
    ItemSummarySchema,
    RefinementSchema,
)
from core.services.schemas.marketplace import (
    CardConditionFilter,
    MarketplaceListing,
    normalize_condition,
)

logger = logging.getLogger(__name__)

DEFAULT_CATEGORY_ID = "183454"  # CCG Individual Cards
DEFAULT_DELIVERY_COUNTRY = "US"


class EbayListingRequestData(TypedDict):
    """Request payload for fetching eBay listings.

    Only high-level filters are exposed to prevent breaking the enrichment logic.
    Low-level eBay API parameters (filter, aspect_filter, etc.) are handled internally.
    """

    epid: str
    condition: NotRequired[CardConditionFilter]  # Filter by specific condition


class EbayListingService(BaseMarketplaceListingService):
    """Call the eBay Browse API and return unified marketplace listings."""

    LISTING_PAGINATION_SIZE = 200

    @property
    def marketplace_name(self) -> str:
        return "ebay"

    def __init__(self, redis_client: redis.Redis, api_client: EbayAPIClient) -> None:
        super().__init__(redis_client)
        self.api_client = api_client

    def _extract_card_conditions(
        self, refinement: Optional[RefinementSchema]
    ) -> List[str]:
        """Extract available card condition values from refinement data.

        Returns eBay's condition values (e.g., "Near Mint or Better") for conditions
        that actually have listings.

        Args:
            refinement: Refinement data from eBay API

        Returns:
            List of eBay card condition strings that have matching listings
        """
        if not refinement or not refinement.aspect_distributions:
            return []

        for aspect in refinement.aspect_distributions:
            if aspect.localized_aspect_name == "Card Condition":
                return [
                    value.localized_aspect_value
                    for value in aspect.aspect_value_distributions
                    if value.localized_aspect_value
                ]

        return []

    def _map_condition_to_ebay_aspect(self, condition: str) -> str:
        """Map our condition filter values to eBay's Card Condition aspect values.

        Args:
            condition: Our standard condition value (e.g., "Near Mint")

        Returns:
            eBay's Card Condition aspect value (e.g., "Near Mint or Better")
        """
        # Map from our enum values to eBay's actual aspect filter values
        condition_mapping = {
            "Near Mint": "Near Mint or Better",
            "Lightly Played": "Lightly Played (Excellent)",
            "Moderately Played": "Moderately Played (Good)",
            "Heavily Played": "Heavily Played (Poor)",
            "Damaged": "Damaged",
        }
        return condition_mapping.get(condition, condition)

    def _map_ebay_aspect_to_condition(self, ebay_condition: str) -> str:
        """Reverse map eBay's Card Condition aspect values to our standard values.

        Args:
            ebay_condition: eBay's condition value (e.g., "Near Mint or Better")

        Returns:
            Our standard condition value (e.g., "Near Mint")
        """
        # Reverse mapping from eBay's aspect values to our enum values
        reverse_mapping = {
            "Near Mint or Better": "Near Mint",
            "Lightly Played (Excellent)": "Lightly Played",
            "Moderately Played (Good)": "Moderately Played",
            "Heavily Played (Poor)": "Heavily Played",
            "Damaged": "Damaged",
        }
        return reverse_mapping.get(ebay_condition, ebay_condition)

    async def _fetch_and_tag_by_condition(
        self, epid: str, ebay_condition: str
    ) -> List[Tuple[ItemSummarySchema, str]]:
        """Fetch listings filtered by a specific eBay card condition.

        Args:
            epid: eBay product ID
            ebay_condition: eBay's Card Condition aspect value (e.g., "Near Mint or Better")

        Returns:
            List of tuples (item, ebay_condition) for items matching the condition
        """
        internal_request: EbayBrowseSearchRequest = {
            "epid": epid,
            "aspect_filter": f"categoryId:{DEFAULT_CATEGORY_ID},Card Condition:{{{ebay_condition}}}",
        }

        responses = await self._fetch_listings_from_api(internal_request)
        items = [item for response in responses for item in response.item_summaries]

        # Tag each item with the eBay condition value
        return [(item, ebay_condition) for item in items]

    async def _enrich_with_conditions(
        self, epid: str
    ) -> List[Tuple[ItemSummarySchema, str]]:
        """Enrich listings with card condition data via parallel filtered requests.

        This method:
        1. Makes initial request to discover which conditions actually have listings
        2. Fetches listings for each available condition in parallel
        3. Handles "Not Specified" items by deduplication

        Args:
            epid: eBay product ID

        Returns:
            List of tuples (item, ebay_condition_str) with all items tagged
        """
        # Step 1: Discover which conditions actually have listings
        initial_request: EbayBrowseSearchRequest = {
            "epid": epid,
        }
        initial_responses = await self._fetch_listings_from_api(initial_request)

        if not initial_responses:
            return []

        available_ebay_conditions = self._extract_card_conditions(
            initial_responses[0].refinement
        )

        if not available_ebay_conditions:
            # No Card Condition aspect available, tag all as Not Specified
            all_items = [
                item
                for response in initial_responses
                for item in response.item_summaries
            ]
            return [(item, "Not Specified") for item in all_items]

        # Step 2: Fetch listings for each available condition in parallel
        logger.debug(
            "Fetching listings for %d conditions: %s",
            len(available_ebay_conditions),
            available_ebay_conditions,
        )

        tasks = [
            self._fetch_and_tag_by_condition(epid, ebay_condition)
            for ebay_condition in available_ebay_conditions
        ]

        condition_results = await asyncio.gather(*tasks)

        # Flatten and deduplicate results
        tagged_items: List[Tuple[ItemSummarySchema, str]] = []
        seen_item_ids = set()

        for condition_items in condition_results:
            for item, ebay_condition in condition_items:
                if item.item_id not in seen_item_ids:
                    tagged_items.append((item, ebay_condition))
                    seen_item_ids.add(item.item_id)

        # Step 3: Handle "Not Specified" items using initial unfiltered results
        all_items = [
            item for response in initial_responses for item in response.item_summaries
        ]

        for item in all_items:
            if item.item_id not in seen_item_ids:
                tagged_items.append((item, "Not Specified"))
                seen_item_ids.add(item.item_id)

        logger.debug(
            "Enriched %d items with conditions for epid=%s", len(tagged_items), epid
        )

        return tagged_items

    def _adapt_to_marketplace_listing(
        self, ebay_item: ItemSummarySchema, card_condition: Optional[str]
    ) -> MarketplaceListing:
        """Convert eBay item to unified MarketplaceListing format.

        Args:
            ebay_item: eBay API item summary
            card_condition: Enriched card condition string (e.g., "Near Mint or Better")

        Returns:
            Unified MarketplaceListing object
        """
        # Extract shipping price from first shipping option
        shipping_price = Decimal("0")
        if ebay_item.shipping_options:
            first_option = ebay_item.shipping_options[0]
            if first_option.shipping_cost:
                shipping_price = first_option.shipping_cost.value

        return MarketplaceListing(
            listing_id=ebay_item.item_id,
            marketplace=Marketplace.EBAY,
            price=ebay_item.price.value,
            shipping_price=shipping_price,
            condition=normalize_condition(card_condition),
            seller_name=ebay_item.seller.username if ebay_item.seller else None,
            quantity=None,  # eBay doesn't expose quantity in search results
            title=ebay_item.title,
        )

    async def get_product_active_listings(
        self, request: EbayListingRequestData, bypass_cache: bool = False
    ) -> List[MarketplaceListing]:
        """Fetch all active listings for an EPID with condition enrichment.

        Returns unified MarketplaceListing objects with normalized card conditions.
        Listings are enriched via parallel API requests to discover conditions.

        Args:
            request: Request data with epid and optional condition filter
            bypass_cache: If True, skip Redis cache and fetch fresh data from API

        Returns:
            List of unified marketplace listings with enriched conditions
        """
        epid = request["epid"]
        condition_filter = request.get("condition")

        # Determine if request has filters (beyond epid)
        has_filters = condition_filter is not None

        # Try cache if no filters and cache bypass not requested
        if not has_filters and not bypass_cache:
            cache_key = self._get_cache_key("marketplace_listings", epid)
            cached_listings = await self._get_from_cache(cache_key)
            if cached_listings:
                logger.debug("Cache hit for listings epid=%s", epid)
                return cached_listings

        logger.debug("Cache miss for listings epid=%s, fetching from API", epid)

        # If condition filter is provided, fetch only that condition
        if condition_filter:
            tagged_items = await self._fetch_and_tag_by_condition(
                epid, condition_filter.value
            )
        else:
            # Fetch and enrich with all conditions
            tagged_items = await self._enrich_with_conditions(epid)

        # Convert to unified marketplace listings
        marketplace_listings = [
            self._adapt_to_marketplace_listing(item, condition)
            for item, condition in tagged_items
        ]

        # Cache if no filters and results exist
        if not has_filters and marketplace_listings:
            cache_key = self._get_cache_key("marketplace_listings", epid)
            await self._set_cache(cache_key, marketplace_listings)

        return marketplace_listings

    async def _fetch_listings_from_api(
        self, request: EbayBrowseSearchRequest
    ) -> List[BrowseSearchResponseSchema]:
        responses: List[BrowseSearchResponseSchema] = []
        offset = 0

        page_size = self.LISTING_PAGINATION_SIZE
        total: Optional[int] = None

        while total is None or offset < total:
            browse_request = self._build_browse_request(request, offset, page_size)
            try:
                response = await self.api_client.browse_item_summary_search(
                    browse_request
                )
            except Exception as exc:  # pragma: no cover - network/runtime guard
                logger.error(
                    "Failed to fetch eBay listings for epid=%s, offset=%d: %s",
                    request.get("epid"),
                    offset,
                    exc,
                    exc_info=True,
                )
                break

            responses.append(response)

            received = len(response.item_summaries)
            reported_total = response.total
            if reported_total is not None:
                total = reported_total

            if received == 0:
                break

            offset += received

            if received < page_size:
                break

        return responses

    def _build_browse_request(
        self, request: EbayBrowseSearchRequest, offset: int, limit: int
    ) -> EbayBrowseSearchRequest:
        epid = request["epid"]

        raw_filter = request.get("filter") or {}
        filter_dict = dict(raw_filter)

        if "deliveryCountry" not in filter_dict:
            filter_dict["deliveryCountry"] = DEFAULT_DELIVERY_COUNTRY

        # Always filter for Ungraded cards only (condition ID 4000)
        if "conditionIds" not in filter_dict:
            filter_dict["conditionIds"] = "{4000}"

        browse_request: EbayBrowseSearchRequest = {
            "limit": limit,
            "offset": offset,
            "epid": epid,
            "fieldgroups": "FULL",
        }

        if filter_dict:
            browse_request["filter"] = filter_dict
        if aspect_filter := request.get("aspect_filter"):
            browse_request["aspect_filter"] = aspect_filter
        if sort := request.get("sort"):
            browse_request["sort"] = sort

        category_ids = request.get("category_ids")
        if category_ids:
            browse_request["category_ids"] = category_ids
        else:
            browse_request["category_ids"] = [DEFAULT_CATEGORY_ID]

        return browse_request


def get_ebay_listing_service(
    redis_client: redis.Redis = Depends(get_redis_client),
    api_client: EbayAPIClient = Depends(get_ebay_api_client),
) -> EbayListingService:
    """FastAPI dependency returning the simplified eBay listing service."""

    return EbayListingService(redis_client, api_client)
