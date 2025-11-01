"""Utility for resolving eBay EPIDs for internal products."""

from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable, NamedTuple

from core.services.ebay_api_client import (
    EbayAPIClient,
    EbayBrowseSearchRequest,
    EbayItemResponse,
)
from core.services.schemas.ebay import BrowseSearchResponseSchema
from core.services.ebay_listing_service import PRINTING_TO_EBAY_ASPECT_MAPPING


logger = logging.getLogger(__name__)

# Pokemon printing priority for backfill ordering (rarest to most common)
POKEMON_PRINTING_PRIORITY: dict[str, int] = {
    "1st Edition Holofoil": 1,  # Rarest
    "Unlimited Holofoil": 2,
    "Holofoil": 3,
    "Reverse Holofoil": 4,
    "1st Edition": 5,
    "Unlimited": 6,
    "Normal": 7,  # Most common
}

_DEFAULT_FINISH = "Regular"


@dataclass(frozen=True)
class ProductSearchInput:
    """Minimal product metadata required to construct eBay search queries and validate EPIDs."""

    clean_name: str | None = None
    number: str | None = None
    set_code: str | None = None
    printing_name: str | None = None
    language_name: str | None = None


class EbayProductResolver:
    """Resolver that will map internal products to eBay EPIDs using validation."""

    DEFAULT_CATEGORY_ID = "183454"  # CCG Individual Cards category
    DEFAULT_LIMIT = 25

    def __init__(self, api_client: EbayAPIClient | None = None) -> None:
        self.api_client = api_client or EbayAPIClient()

    @staticmethod
    def _normalize_card_number(card_number: str) -> str:
        """Normalize card number by removing leading zeros for comparison.

        Args:
            card_number: Card number like "02/62" or "2/62"

        Returns:
            Normalized card number like "2/62"
        """
        if "/" not in card_number:
            return card_number.lstrip("0") or "0"

        parts = card_number.split("/")
        normalized_parts = [part.lstrip("0") or "0" for part in parts]
        return "/".join(normalized_parts)

    @staticmethod
    def _normalize_finish(printing_name: str) -> str | None:
        """Extract and normalize finish type from printing name.

        Args:
            printing_name: Printing name like "Holofoil", "1st Edition Holofoil", "Reverse Holofoil",
                          "Normal", "1st Edition", "Unlimited"

        Returns:
            Normalized finish: "Holo", "Reverse Holo", or "Regular"
        """
        if not printing_name:
            return None

        finish_feature = PRINTING_TO_EBAY_ASPECT_MAPPING.get(printing_name)
        if finish_feature:
            finish, _ = finish_feature
            return finish

        # Fallback to Regular if we don't recognize the printing explicitly
        return _DEFAULT_FINISH

    @staticmethod
    def _extract_features(printing_name: str) -> str | None:
        """Extract edition/feature info from printing name.

        Args:
            printing_name: Printing name like "1st Edition Holofoil", "Unlimited"

        Returns:
            Edition info like "1st Edition", "Unlimited|Unlimited Edition", or None
        """
        if not printing_name:
            return None

        finish_feature = PRINTING_TO_EBAY_ASPECT_MAPPING.get(printing_name)
        if finish_feature:
            _, feature = finish_feature
            return feature

        return None

    @staticmethod
    def _features_match(expected: str, actual: str) -> bool:
        """Check if eBay feature matches expected feature.

        Args:
            expected: Expected feature from DB (e.g., "1st Edition", "Unlimited|Unlimited Edition")
            actual: Actual feature from eBay (e.g., "1st Edition", "Unlimited", "Unlimited, Unlimited|Unlimited Edition")

        Returns:
            True if any pipe-separated expected value appears in actual (case-insensitive substring match)
        """
        if not expected or not actual:
            return expected == actual

        # Check if any pipe-separated expected value appears in actual (case-insensitive)
        act_lower = actual.lower()
        return any(v.strip().lower() in act_lower for v in expected.split("|"))

    def _extract_validation_data(
        self, item_data: EbayItemResponse
    ) -> ValidationData | None:
        """Extract validation aspects from catalog data or seller-provided localized aspects."""

        product = item_data.product
        aspect_groups = product.aspectGroups if product and product.aspectGroups else []

        ebay_card_number: str | None = None
        ebay_finish: str | None = None
        ebay_features: str | None = None
        ebay_language: str | None = None

        for group in aspect_groups:
            if group.localizedGroupName != "Product Key Features":
                continue

            for aspect in group.aspects or []:
                aspect_name = aspect.localizedName
                aspect_values = aspect.localizedValues or []
                raw_value = aspect_values[0] if aspect_values else None

                if aspect_name == "Card Number" and raw_value:
                    cleaned = str(raw_value).strip()
                    if cleaned:
                        ebay_card_number = cleaned
                elif aspect_name == "Finish" and raw_value:
                    cleaned = str(raw_value).strip()
                    if cleaned:
                        ebay_finish = cleaned
                elif aspect_name == "Features" and raw_value:
                    ebay_features = str(raw_value).strip()
                elif aspect_name == "Language" and raw_value:
                    ebay_language = str(raw_value).strip()

        if any(
            field is not None
            for field in (ebay_card_number, ebay_finish, ebay_features, ebay_language)
        ):
            return ValidationData(
                card_number=ebay_card_number or "",
                finish=ebay_finish or "",
                features=ebay_features or "",
                language=ebay_language or "",
                source="catalog",
            )

        localized_aspects = item_data.localizedAspects or []
        if not localized_aspects:
            return None

        aspect_map: dict[str, str] = {}
        for localized_aspect in localized_aspects:
            name = localized_aspect.name
            if not name:
                continue

            value = localized_aspect.value
            if value is None:
                continue

            if isinstance(value, list):
                candidate = next(
                    (str(v).strip() for v in value if str(v).strip()), None
                )
            else:
                candidate = str(value).strip()

            if not candidate:
                continue

            key = name.lower()
            aspect_map.setdefault(key, candidate)

        card_number_raw = aspect_map.get("card number")
        card_number = (
            card_number_raw.strip()
            if isinstance(card_number_raw, str) and card_number_raw.strip()
            else None
        )

        finish_raw = aspect_map.get("finish")
        finish = (
            finish_raw.strip()
            if isinstance(finish_raw, str) and finish_raw.strip()
            else None
        )
        features = aspect_map.get("features")
        language = aspect_map.get("language")

        if any(
            field is not None for field in (card_number, finish, features, language)
        ):
            return ValidationData(
                card_number=card_number or "",
                finish=finish or "",
                features=features or "",
                language=language or "",
                source="localized",
            )

        return None

    def _build_aspect_filter(self, product: ProductSearchInput) -> str | None:
        """Build aspect_filter parameter from product printing information.

        Args:
            product: Product search input with printing details

        Returns:
            aspect_filter string like "categoryId:183454,Finish:{Holo},Features:{1st Edition}"
            or None if no printing info available
        """
        if not product.printing_name:
            return None

        # Look up printing in canonical map shared with listing service
        finish_feature = PRINTING_TO_EBAY_ASPECT_MAPPING.get(product.printing_name)
        if not finish_feature:
            return None

        finish, features = finish_feature
        filters = [f"categoryId:{self.DEFAULT_CATEGORY_ID}"]

        # Add Finish filter
        if finish:
            filters.append(f"Finish:{{{finish}}}")

        # Add Features filter (use first value before pipe for eBay aspect filter)
        if features:
            feature_value = features.split("|")[0]
            filters.append(f"Features:{{{feature_value}}}")

        # Only return if we have at least one filter beyond categoryId
        return ",".join(filters) if len(filters) > 1 else None

    async def _validate_epid(
        self, epid: str, product_input: ProductSearchInput, sample_item_id: str
    ) -> bool:
        """Validate that an EPID matches the ProductVariant by checking product features.

        Args:
            epid: The EPID to validate
            product_input: Product search input with card details
            sample_item_id: A sample item_id with this EPID to call getItem on

        Returns:
            True if the EPID matches the ProductVariant, False otherwise

        Raises:
            Exception: If the API call fails or data extraction fails
        """
        # Fetch item details with PRODUCT fieldgroup
        item_data = await self.api_client.get_item(
            sample_item_id, fieldgroups="PRODUCT"
        )

        validation_data = self._extract_validation_data(item_data)

        if validation_data is None:
            raise ValueError(
                f"Item {sample_item_id} lacks product catalog or localized aspect data"
            )

        if validation_data.source == "localized":
            logger.debug(
                "Falling back to localizedAspects for EPID %s validation using item %s",
                epid,
                sample_item_id,
            )

        # Validation checks
        validation_passed = True
        reasons = []

        # 1. Validate card number
        if product_input.number and validation_data.card_number:
            db_normalized = self._normalize_card_number(product_input.number)
            ebay_normalized = self._normalize_card_number(validation_data.card_number)
            if db_normalized != ebay_normalized:
                validation_passed = False
                reasons.append(
                    f"Card number mismatch: DB='{db_normalized}' vs eBay='{ebay_normalized}'"
                )
        elif product_input.number and not validation_data.card_number:
            validation_passed = False
            reasons.append("Card number missing from eBay data")

        # 2. Validate finish
        if product_input.printing_name:
            db_finish = self._normalize_finish(product_input.printing_name)
            if db_finish and validation_data.finish:
                if db_finish != validation_data.finish:
                    validation_passed = False
                    reasons.append(
                        f"Finish mismatch: DB='{db_finish}' vs eBay='{validation_data.finish}'"
                    )
            elif db_finish and not validation_data.finish:
                validation_passed = False
                reasons.append("Finish missing from eBay data")

        # 3. Validate features (edition info)
        if product_input.printing_name:
            db_features = self._extract_features(product_input.printing_name)
            if db_features and validation_data.features:
                if not self._features_match(db_features, validation_data.features):
                    validation_passed = False
                    reasons.append(
                        f"Features mismatch: DB='{db_features}' vs eBay='{validation_data.features}'"
                    )
            elif db_features and not validation_data.features:
                validation_passed = False
                reasons.append("Features missing from eBay data")

        # 4. Validate language
        if product_input.language_name and validation_data.language:
            if product_input.language_name.lower() != validation_data.language.lower():
                validation_passed = False
                reasons.append(
                    f"Language mismatch: DB='{product_input.language_name}' vs eBay='{validation_data.language}'"
                )
        elif product_input.language_name and not validation_data.language:
            validation_passed = False
            reasons.append("Language missing from eBay data")

        if validation_passed:
            logger.info(
                "EPID %s validated successfully for product (%s, %s, %s)",
                epid,
                product_input.clean_name,
                product_input.number,
                product_input.printing_name,
            )
            return True
        else:
            logger.debug(
                "EPID %s failed validation: %s",
                epid,
                "; ".join(reasons),
            )
            return False

    async def resolve(self, product: ProductSearchInput) -> str | None:
        """Attempt to find the best-matching EPID for the provided product using validation."""

        # Collect EPIDs with their listing item IDs
        epid_to_item_ids: dict[str, list[str]] = defaultdict(list)

        # Build aspect filter from printing information
        aspect_filter = self._build_aspect_filter(product)

        for query in self._build_candidate_queries(product):
            response = await self._execute_search(query, aspect_filter=aspect_filter)
            if response is None:
                continue

            for item in response.item_summaries:
                epid = getattr(item, "epid", None)
                item_id = getattr(item, "item_id", None)
                if epid and item_id:
                    epid_to_item_ids[str(epid)].append(item_id)

        if not epid_to_item_ids:
            logger.debug(
                "No EPIDs found for product (%s, %s, %s)",
                product.clean_name,
                product.number,
                product.set_code,
            )
            return None

        # Sort EPIDs by frequency (most common first)
        sorted_epids = sorted(
            epid_to_item_ids.items(), key=lambda kv: len(kv[1]), reverse=True
        )

        logger.debug(
            "Found %d candidate EPIDs for product (%s, %s, %s). Validating in order of frequency...",
            len(sorted_epids),
            product.clean_name,
            product.number,
            product.set_code,
        )

        # Validate each EPID in order of frequency
        for epid, item_ids in sorted_epids:
            logger.debug(
                "Validating EPID %s (appears in %d listings)",
                epid,
                len(item_ids),
            )

            # Try multiple sample items until we find one with product data
            # or exhaust all samples (up to 3 attempts)
            for sample_item_id in item_ids[:3]:  # Try up to 3 items
                logger.debug(
                    "Attempting validation with sample item %s",
                    sample_item_id,
                )

                try:
                    if await self._validate_epid(epid, product, sample_item_id):
                        logger.info(
                            "Resolved product (%s, %s, %s) to EPID=%s (validated with %d supporting listings)",
                            product.clean_name,
                            product.number,
                            product.set_code,
                            epid,
                            len(item_ids),
                        )
                        return epid
                except Exception as exc:
                    logger.warning(
                        "Failed to validate EPID %s with item %s: %s. Trying next item...",
                        epid,
                        sample_item_id,
                        exc,
                    )
                    continue

        # No EPID passed validation
        logger.debug(
            "No EPID passed validation for product (%s, %s, %s)",
            product.clean_name,
            product.number,
            product.set_code,
        )
        return None

    def _build_candidate_queries(self, product: ProductSearchInput) -> Iterable[str]:
        """Construct initial query strings based on product metadata.

        Only includes card name and number. Printing details (Finish, Features)
        are handled via aspect_filter in _execute_search.
        """

        parts = [
            (product.clean_name or "").strip(),
            (product.number or "").strip(),
        ]

        query = " ".join(part for part in parts if part)
        if query:
            yield query

    async def _execute_search(
        self, query: str, aspect_filter: str | None = None
    ) -> BrowseSearchResponseSchema | None:
        """Execute a browse search and return the raw response model.

        Args:
            query: Search query string (e.g., "Articuno 02/62")
            aspect_filter: Optional aspect filter (e.g., "categoryId:183454,Finish:{Holo}")
        """

        request: EbayBrowseSearchRequest = {
            "query": query,
            "limit": self.DEFAULT_LIMIT,
            "category_ids": [self.DEFAULT_CATEGORY_ID],
        }

        if aspect_filter:
            request["aspect_filter"] = aspect_filter

        try:
            return await self.api_client.browse_item_summary_search(request)
        except Exception as exc:  # pragma: no cover - network/runtime guard
            logger.warning(
                "eBay search failed for query='%s': %s", query, exc, exc_info=True
            )
            return None


class ValidationData(NamedTuple):
    """Product validation data extracted from eBay item details.

    All fields are required - if data cannot be extracted, return None instead of ValidationData.
    """

    card_number: str
    finish: str
    features: str
    language: str
    source: str  # 'catalog' or 'localized'
