"""Low-level client for interacting with eBay's REST APIs."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, TypedDict

import aiohttp

from core.environment import get_environment
from core.services.schemas.ebay import BrowseSearchResponseSchema

logger = logging.getLogger(__name__)


EBAY_API_BASE_URL = "https://api.ebay.com"
EBAY_OAUTH_TOKEN_URL = f"{EBAY_API_BASE_URL}/identity/v1/oauth2/token"
EBAY_BROWSE_SEARCH_URL = f"{EBAY_API_BASE_URL}/buy/browse/v1/item_summary/search"
EBAY_DEFAULT_SCOPE = "https://api.ebay.com/oauth/api_scope"
EBAY_US_MARKETPLACE_ID = "EBAY_US"
TOKEN_SAFETY_SECONDS = 60


class EbayBrowseSearchRequest(TypedDict, total=False):
    """Subset of Browse search parameters used by the application."""

    query: str
    limit: int
    offset: int
    category_ids: list[str]
    filter: str
    sort: str
    aspect_filter: str


class EbayAPIClient:
    """Handles authentication and raw HTTP calls to eBay endpoints."""

    def __init__(
        self,
        *,
        marketplace_id: str = EBAY_US_MARKETPLACE_ID,
        scope: str = EBAY_DEFAULT_SCOPE,
        request_timeout_seconds: int = 30,
    ) -> None:
        self.marketplace_id = marketplace_id
        self.scope = scope
        self._timeout = aiohttp.ClientTimeout(total=request_timeout_seconds)

        env = get_environment()
        self._client_id = getattr(env, "ebay_client_id", None)
        self._client_secret = getattr(env, "ebay_client_secret", None)
        if not self._client_id or not self._client_secret:
            raise RuntimeError(
                "eBay credentials not configured. Ensure ebay_client_id and ebay_client_secret are set."
            )

        self._session: Optional[aiohttp.ClientSession] = None
        self._token_lock = asyncio.Lock()
        self._access_token: Optional[str] = None
        self._token_expiry: Optional[datetime] = None

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None

    async def browse_item_summary_search(
        self, request: EbayBrowseSearchRequest
    ) -> BrowseSearchResponseSchema:
        """Call the Browse item summary search endpoint and return parsed response."""

        session = await self._get_session()
        headers = await self._get_authorization_headers()

        params: dict[str, Any] = {
            "limit": request.get("limit", 50),
            "offset": request.get("offset", 0),
        }
        if query := request.get("query"):
            params["q"] = query
        if category_ids := request.get("category_ids"):
            params["category_ids"] = ",".join(category_ids)
        if request_filter := request.get("filter"):
            params["filter"] = request_filter
        if aspect_filter := request.get("aspect_filter"):
            params["aspect_filter"] = aspect_filter
        if sort := request.get("sort"):
            params["sort"] = sort

        async with session.get(
            EBAY_BROWSE_SEARCH_URL, params=params, headers=headers
        ) as resp:
            resp.raise_for_status()
            payload = await resp.json()
            return BrowseSearchResponseSchema.model_validate(payload)

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=self._timeout)
        return self._session

    async def _get_authorization_headers(self) -> dict[str, str]:
        token = await self._get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-EBAY-C-MARKETPLACE-ID": self.marketplace_id,
        }

    async def _get_access_token(self) -> str:
        if self._token_valid():
            return self._access_token  # type: ignore[return-value]

        async with self._token_lock:
            if self._token_valid():
                return self._access_token  # type: ignore[return-value]

            token, expires_in = await self._request_new_token()
            self._access_token = token
            self._token_expiry = datetime.now(timezone.utc) + timedelta(
                seconds=expires_in
            )
            return token

    def _token_valid(self) -> bool:
        if not self._access_token or not self._token_expiry:
            return False
        return datetime.now(timezone.utc) < self._token_expiry - timedelta(
            seconds=TOKEN_SAFETY_SECONDS
        )

    async def _request_new_token(self) -> tuple[str, int]:
        session = await self._get_session()
        auth = aiohttp.BasicAuth(self._client_id, self._client_secret)
        data = {
            "grant_type": "client_credentials",
            "scope": self.scope,
        }

        async with session.post(EBAY_OAUTH_TOKEN_URL, data=data, auth=auth) as resp:
            resp.raise_for_status()
            payload = await resp.json()

        token = payload.get("access_token")
        expires_in = int(payload.get("expires_in", 0))
        if not token or not expires_in:
            raise RuntimeError("Invalid token response from eBay OAuth endpoint")
        return token, expires_in
