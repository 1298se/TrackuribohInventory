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
    CardCondition,
    ListingLanguage,
    MarketplaceListing,
    normalize_condition,
    EbayMarketplaceListing,
    Printing,
)

logger = logging.getLogger(__name__)

DEFAULT_CATEGORY_ID = "183454"  # CCG Individual Cards
DEFAULT_DELIVERY_COUNTRY = "US"

# Mapping from our CardCondition enum to eBay's Card Condition aspect values
CONDITION_TO_EBAY_ASPECT_MAPPING = {
    CardCondition.NEAR_MINT: "Near Mint or Better",
    CardCondition.LIGHTLY_PLAYED: "Lightly Played (Excellent)",
    CardCondition.MODERATELY_PLAYED: "Moderately Played (Good)",
    CardCondition.HEAVILY_PLAYED: "Heavily Played (Poor)",
    CardCondition.DAMAGED: "Damaged",
}
DEFAULT_CONDITION_IDS = "{4000}"  # Ungraded only (exclude graded slabs)

# Printing to ebay (Finish, Feature)

PRINTING_TO_EBAY_ASPECT_MAPPING: dict[Printing, tuple[str | None, str | None]] = {
    Printing.FIRST_EDITION_HOLOFOIL: ("Holo", "1st Edition"),
    Printing.HOLOFOIL: ("Holo", None),
    Printing.REVERSE_HOLOFOIL: ("Reverse Holo", None),
    Printing.UNLIMITED_HOLOFOIL: ("Holo", "Unlimited|Unlimited Edition"),
    Printing.NORMAL: ("Regular", None),
    Printing.FIRST_EDITION: ("Regular", "1st Edition"),
    Printing.UNLIMITED: ("Regular", "Unlimited|Unlimited Edition"),
}

HAMPEL_MIN_SAMPLE_SIZE = 6
HAMPEL_LOW_SIGMA = Decimal("3")
HAMPEL_CLUSTER_SIGMA = Decimal("1.5")
HAMPEL_CLUSTER_MIN_RATIO = 0.55
HAMPEL_CLUSTER_MIN_SIZE = 3
HAMPEL_MAD_SCALE = Decimal("1.4826")
HAMPEL_MAX_REMOVAL_RATIO = 0.25
HAMPEL_MIN_REMAINING = 3


def build_card_aspect_filter(
    language: Optional[ListingLanguage],
    card_number: Optional[str],
    printing: Optional[Printing],
    extra_aspects: Optional[List[Tuple[str, str]]] = None,
) -> str:
    """Construct the eBay aspect filter string for a card listing."""

    parts: List[str] = [f"categoryId:{DEFAULT_CATEGORY_ID}"]

    if language:
        parts.append(f"Language:{{{language.value}}}")

    if card_number:
        parts.append(f"Card Number:{{{card_number}}}")

    if printing:
        finish_token: Optional[str] = None
        feature_token: Optional[str] = None

        if printing_info := PRINTING_TO_EBAY_ASPECT_MAPPING.get(printing):
            finish_token, feature_token = printing_info

        if not finish_token:
            finish_token = printing.value

        if finish_token:
            parts.append(f"Finish:{{{finish_token}}}")
        if feature_token:
            parts.append(f"Features:{{{feature_token}}}")

    if extra_aspects:
        for aspect_name, aspect_value in extra_aspects:
            parts.append(f"{aspect_name}:{{{aspect_value}}}")

    return ",".join(parts)


class EbayListingRequestData(TypedDict):
    """Request payload for fetching eBay listings.

    Only high-level filters are exposed to prevent breaking the enrichment logic.
    Low-level eBay API parameters (filter, aspect_filter, etc.) are handled internally.
    """

    epid: str
    condition: NotRequired[CardCondition]  # Filter by specific condition
    language: NotRequired[ListingLanguage]
    card_number: NotRequired[str]
    printing: NotRequired[Printing]


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

    def _filter_price_outliers(
        self, items: List[ItemSummarySchema]
    ) -> List[ItemSummarySchema]:
        """Remove extreme low-price outliers using a guarded Hampel filter."""
        if not items:
            return items

        priced_items: List[Tuple[ItemSummarySchema, Decimal]] = []
        for item in items:
            price_value = (
                item.price.value
                if item.price and item.price.value is not None
                else None
            )
            if price_value is None:
                continue

            shipping_total = Decimal("0")
            if item.shipping_options:
                first_option = item.shipping_options[0]
                if (
                    first_option.shipping_cost
                    and first_option.shipping_cost.value is not None
                ):
                    shipping_total = first_option.shipping_cost.value

            total_price = price_value + shipping_total
            priced_items.append((item, total_price))

        if len(priced_items) < HAMPEL_MIN_SAMPLE_SIZE:
            return items

        total_prices = sorted(total for _, total in priced_items)
        if not total_prices:
            return items

        def _median(sorted_values: List[Decimal]) -> Decimal:
            count = len(sorted_values)
            midpoint = count // 2
            if count % 2 == 1:
                return sorted_values[midpoint]
            return (sorted_values[midpoint - 1] + sorted_values[midpoint]) / Decimal(
                "2"
            )

        median_price = _median(total_prices)
        deviations = sorted(abs(price - median_price) for price in total_prices)
        mad = _median(deviations)

        if mad == 0:
            return items

        sigma_hat = HAMPEL_MAD_SCALE * mad
        if sigma_hat <= 0:
            return items

        cluster_band = HAMPEL_CLUSTER_SIGMA * sigma_hat
        cluster_lower = median_price - cluster_band
        cluster_upper = median_price + cluster_band
        cluster_count = sum(
            1 for price in total_prices if cluster_lower <= price <= cluster_upper
        )

        if cluster_count < HAMPEL_CLUSTER_MIN_SIZE:
            return items

        cluster_ratio = cluster_count / len(total_prices)
        if cluster_ratio < HAMPEL_CLUSTER_MIN_RATIO:
            return items

        cutoff = median_price - HAMPEL_LOW_SIGMA * sigma_hat
        removal_candidates = [item for item, total in priced_items if total < cutoff]
        removal_count = len(removal_candidates)

        if removal_count == 0:
            return items

        removal_ratio = removal_count / len(priced_items)
        if removal_ratio > HAMPEL_MAX_REMOVAL_RATIO:
            return items

        if (len(priced_items) - removal_count) < HAMPEL_MIN_REMAINING:
            return items

        removal_identity = {id(item) for item in removal_candidates}
        filtered_items = [item for item in items if id(item) not in removal_identity]

        if removal_count > 0 and len(filtered_items) < len(items):
            logger.info(
                "Hampel filtered %d low-priced eBay listings "
                "(median=$%s, sigma_hat=$%s, cutoff=$%s, sample=%d)",
                removal_count,
                format(median_price, ".2f"),
                format(sigma_hat, ".2f"),
                format(cutoff, ".2f"),
                len(priced_items),
            )

        return filtered_items

    def _post_filter_results(
        self, items: List[ItemSummarySchema]
    ) -> List[ItemSummarySchema]:
        """Apply post-processing filters to raw API results.

        This method applies various quality filters to ensure only relevant,
        accurate listings are returned:
        - Price outlier filtering (removes multi-card lots, fan art, etc.)

        Args:
            items: Raw item summaries from eBay API

        Returns:
            Filtered and processed items
        """
        # Apply price outlier filter
        items = self._filter_price_outliers(items)

        # Future filters can be added here (e.g., variation filter, title matching, etc.)

        return items

    async def _fetch_and_tag_by_condition(
        self,
        epid: str,
        condition: CardCondition,
        language: Optional[ListingLanguage],
        card_number: Optional[str],
        printing: Optional[Printing],
    ) -> List[Tuple[ItemSummarySchema, str]]:
        """Fetch listings filtered by a specific card condition.

        Args:
            epid: eBay product ID
            condition: CardCondition enum value

        Returns:
            List of tuples (item, condition_value) for items matching the condition
        """
        # Map condition enum to eBay's aspect value for the API request
        ebay_aspect = CONDITION_TO_EBAY_ASPECT_MAPPING[condition]

        aspect_filter = build_card_aspect_filter(
            language,
            card_number,
            printing,
            extra_aspects=[("Card Condition", ebay_aspect)],
        )

        internal_request: EbayBrowseSearchRequest = {
            "epid": epid,
            "aspect_filter": aspect_filter,
        }

        responses = await self._fetch_listings_from_api(internal_request)
        # Enforce ungraded-only results as a defensive measure in case the API
        # returns graded listings even when conditionIds={4000} is supplied.
        items = [
            item
            for response in responses
            for item in response.item_summaries
            if item.condition_id == "4000"
            or (
                item.condition_id is None
                and (item.condition or "").strip().lower() != "graded"
            )
        ]

        # Apply post-processing filters (price outliers, etc.)
        items = self._post_filter_results(items)

        # Tag each item with the condition value
        return [(item, condition.value) for item in items]

    async def _enrich_with_conditions(
        self,
        epid: str,
        condition_filter: Optional[CardCondition],
        language: Optional[str],
        card_number: Optional[str],
        printing: Optional[str],
    ) -> List[Tuple[ItemSummarySchema, str]]:
        """Enrich listings with card condition data via parallel filtered requests.

        Fetches listings for specific condition(s). When no condition_filter is provided,
        discovers available conditions and fetches Near Mint, Lightly Played, and
        Moderately Played in parallel.

        Args:
            epid: eBay product ID
            condition_filter: Optional specific condition to fetch. If None, fetches all desired conditions.
            language: Optional language filter
            card_number: Optional card number filter
            printing: Optional printing filter

        Returns:
            List of tuples (item, condition_str) with items tagged by condition
        """
        # If specific condition provided, skip discovery
        if condition_filter:
            condition_filters = [condition_filter]
        else:
            # Discovery flow: find which conditions have listings
            aspect_filter = build_card_aspect_filter(
                language,
                card_number,
                printing,
            )
            initial_request: EbayBrowseSearchRequest = {"epid": epid}
            if aspect_filter:
                initial_request["aspect_filter"] = aspect_filter

            initial_responses = await self._fetch_listings_from_api(initial_request)
            if not initial_responses:
                return []

            available_ebay_conditions = self._extract_card_conditions(
                initial_responses[0].refinement
            )

            # Desired conditions (excludes Heavily Played and Damaged)
            desired_conditions = [
                CardCondition.NEAR_MINT,
                CardCondition.LIGHTLY_PLAYED,
                CardCondition.MODERATELY_PLAYED,
            ]

            # Build reverse mapping for desired conditions only
            ebay_to_condition = {
                ebay_aspect: condition
                for condition, ebay_aspect in CONDITION_TO_EBAY_ASPECT_MAPPING.items()
                if condition in desired_conditions
            }

            # Filter to conditions that are both available and desired
            condition_filters = [
                ebay_to_condition[ebay_cond]
                for ebay_cond in available_ebay_conditions
                if ebay_cond in ebay_to_condition
            ]

            if not condition_filters:
                return []  # No desired conditions available

        logger.debug(
            "Fetching listings for %d conditions: %s",
            len(condition_filters),
            [c.value for c in condition_filters],
        )

        # Parallel fetch for all conditions
        tasks = [
            self._fetch_and_tag_by_condition(
                epid,
                condition,
                language,
                card_number,
                printing,
            )
            for condition in condition_filters
        ]
        condition_results = await asyncio.gather(*tasks)

        # Flatten and deduplicate results
        tagged_items: List[Tuple[ItemSummarySchema, str]] = []
        seen_item_ids = set()

        for condition_items in condition_results:
            for item, condition in condition_items:
                if item.item_id not in seen_item_ids:
                    tagged_items.append((item, condition))
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

        estimated_quantity: Optional[int] = None
        if ebay_item.estimated_availabilities:
            first_availability = ebay_item.estimated_availabilities[0]
            if first_availability.estimated_quantity:
                estimated_quantity = first_availability.estimated_quantity

        seller_rating = None
        seller_name = None
        if ebay_item.seller:
            seller_name = ebay_item.seller.username
            seller_rating = ebay_item.seller.feedback_percentage_float()

        image_url = None
        if ebay_item.image:
            image_url = ebay_item.image.get("imageUrl") or ebay_item.image.get(
                "imageUrlHttps"
            )

        # Construct eBay listing URL using item ID
        # eBay API returns item_id in format like "v1|167828077361|0"
        # Extract the numeric ID (middle part)
        item_id = ebay_item.item_id
        if "|" in item_id:
            parts = item_id.split("|")
            if len(parts) == 3:
                item_id = parts[1]  # Extract the actual item ID

        listing_url = f"https://www.ebay.com/itm/{item_id}"

        return EbayMarketplaceListing(
            listing_id=ebay_item.item_id,
            marketplace=Marketplace.EBAY,
            price=ebay_item.price.value,
            shipping_price=shipping_price,
            condition=normalize_condition(card_condition),
            seller_name=seller_name,
            seller_rating=seller_rating,
            quantity=estimated_quantity or 1,
            title=ebay_item.title,
            image_url=image_url,
            listing_url=listing_url,
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
        language = request.get("language") or ListingLanguage.ENGLISH
        card_number = request.get("card_number")
        printing = request.get("printing")

        # Determine if request has filters (beyond epid)
        has_filters = any(
            [
                condition_filter is not None,
                language is not None,
                card_number is not None,
                printing is not None,
            ]
        )

        # Try cache if no filters and cache bypass not requested
        if not has_filters and not bypass_cache:
            cache_key = self._get_cache_key("marketplace_listings", epid)
            cached_listings = await self._get_from_cache(
                cache_key, EbayMarketplaceListing
            )
            if cached_listings:
                logger.debug("Cache hit for listings epid=%s", epid)
                return cached_listings

        logger.debug("Cache miss for listings epid=%s, fetching from API", epid)

        tagged_items = await self._enrich_with_conditions(
            epid,
            condition_filter,
            language,
            card_number,
            printing,
        )

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
            filter_dict["conditionIds"] = DEFAULT_CONDITION_IDS

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
