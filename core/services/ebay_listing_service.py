"""Simplified service for fetching raw eBay listing responses."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import List, Optional, TypedDict, NotRequired

import redis.asyncio as redis
from fastapi import Depends

from core.services.base_marketplace_listing_service import BaseMarketplaceListingService
from core.services.ebay_api_client import (
    EbayAPIClient,
    EbayBrowseSearchRequest,
    get_ebay_api_client,
)
from core.services.redis_service import get_redis_client
from core.services.schemas.ebay import BrowseSearchResponseSchema, ItemSummarySchema

logger = logging.getLogger(__name__)

DEFAULT_CATEGORY_ID = "183454"  # CCG Individual Cards
DEFAULT_DELIVERY_COUNTRY = "US"


class EbayListingRequestData(TypedDict):
    """Minimal request payload for fetching eBay listings."""

    epid: str
    filter: NotRequired[Mapping[str, str]]
    sort: NotRequired[str]
    aspect_filter: NotRequired[str]
    category_ids: NotRequired[List[str]]


class EbayListingService(BaseMarketplaceListingService[ItemSummarySchema]):
    """Call the eBay Browse API and return raw response objects."""

    # eBay Browse API caps `limit` at 200 per the public docs.
    LISTING_PAGINATION_SIZE = 200

    @property
    def marketplace_name(self) -> str:
        return "ebay"

    def __init__(self, redis_client: redis.Redis, api_client: EbayAPIClient) -> None:
        super().__init__(redis_client)
        self.api_client = api_client

    async def get_product_active_listings(
        self, request: EbayListingRequestData
    ) -> List[ItemSummarySchema]:
        """Fetch all active listings for an EPID, returning flattened item summaries."""

        epid = request.get("epid")
        if not epid:
            raise ValueError("epid is required to fetch eBay listings")

        # Determine if request has filters (beyond epid)
        has_filters = bool(
            request.get("filter")
            or request.get("sort")
            or request.get("aspect_filter")
            or request.get("category_ids")
        )

        # Try cache if no filters
        if not has_filters:
            cache_key = self._get_cache_key("listings", epid)
            cached_listings = await self._get_from_cache(cache_key, ItemSummarySchema)
            if cached_listings:
                logger.debug("Cache hit for listings epid=%s", epid)
                return cached_listings

        logger.debug("Cache miss for listings epid=%s, fetching from API", epid)

        # Fetch and flatten listings
        responses = await self._fetch_listings_from_api(request)
        listings = [item for response in responses for item in response.item_summaries]

        # Cache if no filters and results exist
        if not has_filters and listings:
            cache_key = self._get_cache_key("listings", epid)
            await self._set_cache(cache_key, listings)

        return listings

    async def _fetch_listings_from_api(
        self, request: EbayListingRequestData
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
        self, request: EbayListingRequestData, offset: int, limit: int
    ) -> EbayBrowseSearchRequest:
        epid = request["epid"]

        raw_filter = request.get("filter") or {}
        filter_dict = dict(raw_filter)

        if "deliveryCountry" not in filter_dict:
            filter_dict["deliveryCountry"] = DEFAULT_DELIVERY_COUNTRY

        browse_request: EbayBrowseSearchRequest = {
            "limit": limit,
            "offset": offset,
            "epid": epid,
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
