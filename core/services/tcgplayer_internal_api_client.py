"""Low-level client for fetching listings and sales from TCGPlayer's internal API."""

from __future__ import annotations

import logging
from datetime import datetime
from types import MappingProxyType
from typing import Any, List, Optional

import aiohttp

from core.environment import get_environment
from core.services.schemas.tcgplayer import (
    TCGPlayerSalesResponseSchema,
    TCGPlayerListingsResponseSchema,
)

logger = logging.getLogger(__name__)


class TCGPlayerInternalAPIClient:
    """Handles headers, payloads, and JSON parsing for TCGPlayer internal API."""

    BASE_LISTINGS_URL = "https://mp-search-api.tcgplayer.com/v1/product/%d/listings"
    BASE_SALES_URL = "https://mpapi.tcgplayer.com/v2/product/%d/latestsales"

    def __init__(self, *, request_timeout_seconds: int = 30) -> None:
        self._timeout = aiohttp.ClientTimeout(total=request_timeout_seconds)

        base_headers = {
            "origin": "https://www.tcgplayer.com",
            "Referer": "https://www.tcgplayer.com",
            "accept": "application/json",
            "content-type": "application/json",
            "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Mobile Safari/537.36",
        }

        env = get_environment()
        cookie = env.get_tcgplayer_cookie()
        if cookie:
            base_headers["Cookie"] = cookie

        self.headers = MappingProxyType(base_headers)
        self._session: Optional[aiohttp.ClientSession] = None

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None

    async def fetch_product_active_listings(
        self,
        product_id: int,
        *,
        offset: int,
        limit: int,
        printings: Optional[List[str]] = None,
        conditions: Optional[List[str]] = None,
        languages: Optional[List[str]] = None,
    ) -> TCGPlayerListingsResponseSchema:
        payload = self._build_product_active_listings_request_payload(
            offset=offset,
            limit=limit,
            printings=printings,
            conditions=conditions,
            languages=languages,
        )

        session = await self._get_session()
        url = self.BASE_LISTINGS_URL % product_id
        async with session.post(url, json=payload) as response:
            response.raise_for_status()
            raw = await response.json()
        return TCGPlayerListingsResponseSchema.model_validate(raw)

    async def fetch_sales(
        self,
        product_id: int,
        *,
        count: int,
        offset: int,
        printings: Optional[List[str]] = None,
        conditions: Optional[List[str]] = None,
        languages: Optional[List[str]] = None,
    ) -> TCGPlayerSalesResponseSchema:
        payload = self._build_sales_request_payload(
            count=count,
            offset=offset,
            printings=printings,
            conditions=conditions,
            languages=languages,
        )

        session = await self._get_session()
        url = self.BASE_SALES_URL % product_id
        async with session.post(url, json=payload) as response:
            response.raise_for_status()
            raw = await response.json()
        return TCGPlayerSalesResponseSchema.model_validate(raw)

    def _build_product_active_listings_request_payload(
        self,
        *,
        offset: int,
        limit: int,
        printings: Optional[List[str]] = None,
        conditions: Optional[List[str]] = None,
        languages: Optional[List[str]] = None,
    ) -> dict[str, Any]:
        term = {
            "sellerStatus": "Live",
            "channelId": 0,
            "listingType": "standard",
        }
        if languages:
            term["language"] = languages
        if printings:
            term["printing"] = printings
        if conditions:
            term["condition"] = conditions

        return {
            "filters": {
                "term": term,
                "range": {"quantity": {"gte": 1}},
                "exclude": {"channelExclusion": 0, "listingType": "custom"},
            },
            "from": offset,
            "size": limit,
            "context": {"shippingCountry": "US", "cart": {}},
            "sort": {"field": "price+shipping", "order": "asc"},
        }

    def _build_sales_request_payload(
        self,
        *,
        count: int,
        offset: int,
        printings: Optional[List[str]] = None,
        conditions: Optional[List[str]] = None,
        languages: Optional[List[str]] = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "listingType": "ListingWithoutPhotos",
            "limit": count,
            "offset": offset,
            "time": datetime.now().timestamp() * 1000,
        }
        if printings:
            payload["variants"] = printings
        if conditions:
            payload["conditions"] = conditions
        if languages:
            payload["languages"] = languages
        return payload

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                headers=self.headers,
                timeout=self._timeout,
            )
        return self._session


def get_tcgplayer_internal_api_client() -> TCGPlayerInternalAPIClient:
    """FastAPI dependency hook for the internal API client."""
    return TCGPlayerInternalAPIClient()
