"""Low-level client for interacting with eBay's REST APIs."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from collections.abc import Mapping
from typing import Any, Optional, TypedDict

import aiohttp
from aiohttp import TraceConfig, TraceRequestEndParams

from core.environment import get_environment
from core.services.schemas.ebay import BrowseSearchResponseSchema
from pydantic import BaseModel

logger = logging.getLogger(__name__)


async def _on_request_end(
    session: aiohttp.ClientSession,
    trace_config_ctx: Any,
    params: TraceRequestEndParams,
) -> None:
    """Log HTTP responses captured during execution."""
    trace_metadata = getattr(trace_config_ctx, "trace_request_ctx", None) or {}

    payload = trace_metadata.get("payload")
    operation = trace_metadata.get("operation")

    request_info = getattr(params.response, "request_info", None)
    method = getattr(request_info, "method", None) if request_info else None
    url = str(getattr(request_info, "url", "")) if request_info else None
    status = getattr(params.response, "status", None)

    message_parts = []
    if method and url:
        message_parts.append(f"{method} {url}")
    if status is not None:
        message_parts.append(f"status={status}")
    if operation:
        message_parts.append(f"operation={operation}")

    context = " | ".join(message_parts) if message_parts else None

    if payload is not None:
        logger.info(
            "eBay API response%s: %s",
            f" ({context})" if context else "",
            json.dumps(payload, indent=2),
        )
    elif context:
        logger.info("eBay API response (%s)", context)


EBAY_API_BASE_URL = "https://api.ebay.com"
EBAY_OAUTH_TOKEN_URL = f"{EBAY_API_BASE_URL}/identity/v1/oauth2/token"
EBAY_BROWSE_SEARCH_URL = f"{EBAY_API_BASE_URL}/buy/browse/v1/item_summary/search"
EBAY_BROWSE_ITEM_URL = f"{EBAY_API_BASE_URL}/buy/browse/v1/item"
EBAY_DEFAULT_SCOPE = "https://api.ebay.com/oauth/api_scope"
EBAY_US_MARKETPLACE_ID = "EBAY_US"


class EbayBrowseSearchRequest(TypedDict, total=False):
    """Subset of Browse search parameters used by the application."""

    query: str
    limit: int
    offset: int
    category_ids: list[str]
    filter: Mapping[str, str]
    sort: str
    aspect_filter: str
    epid: str
    fieldgroups: str


class AspectEntry(BaseModel):
    localizedName: str | None = None
    localizedValues: list[str] | None = None


class AspectGroup(BaseModel):
    localizedGroupName: str | None = None
    aspects: list[AspectEntry] | None = None


class ProductInfo(BaseModel):
    title: str | None = None
    aspectGroups: list[AspectGroup] | None = None


class LocalizedAspect(BaseModel):
    type: str | None = None
    name: str | None = None
    value: str | list[str] | None = None


class EbayItemResponse(BaseModel):
    product: ProductInfo | None = None
    localizedAspects: list[LocalizedAspect] | None = None


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
            params["filter"] = self._serialize_filters(request_filter)
        if aspect_filter := request.get("aspect_filter"):
            params["aspect_filter"] = aspect_filter
        if sort := request.get("sort"):
            params["sort"] = sort
        if epid := request.get("epid"):
            params["epid"] = epid
        if fieldgroups := request.get("fieldgroups"):
            params["fieldgroups"] = fieldgroups

        trace_request_ctx: dict[str, Any] = {"operation": "browse_item_summary_search"}

        async with session.get(
            EBAY_BROWSE_SEARCH_URL,
            params=params,
            headers=headers,
            trace_request_ctx=trace_request_ctx,
        ) as resp:
            resp.raise_for_status()
            payload = await resp.json()
            trace_request_ctx["payload"] = payload
            return BrowseSearchResponseSchema.model_validate(payload)

    async def get_item(
        self, item_id: str, fieldgroups: Optional[str] = None
    ) -> EbayItemResponse:
        """Call the Browse API to retrieve item details by item ID.

        Args:
            item_id: eBay item ID (RESTful format: v1|#|#)
            fieldgroups: Optional fieldgroups parameter (e.g., "PRODUCT")

        Returns:
            Raw JSON response as dict

        Raises:
            aiohttp.ClientResponseError: If the API request fails
        """
        session = await self._get_session()
        headers = await self._get_authorization_headers()

        url = f"{EBAY_BROWSE_ITEM_URL}/{item_id}"
        params: dict[str, str] = {}
        if fieldgroups:
            params["fieldgroups"] = fieldgroups

        trace_request_ctx: dict[str, Any] = {"operation": "get_item"}

        async with session.get(
            url,
            params=params,
            headers=headers,
            trace_request_ctx=trace_request_ctx,
        ) as resp:
            resp.raise_for_status()
            raw_payload: dict[str, Any] = await resp.json()
            trace_request_ctx["payload"] = raw_payload
            return EbayItemResponse.model_validate(raw_payload)

    @staticmethod
    def _serialize_filters(filters: Mapping[str, str]) -> str:
        parts: list[str] = []
        for key, raw_value in filters.items():
            if raw_value is None:
                continue

            parts.append(f"{key}:{raw_value}")

        return ",".join(parts)

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            # Set up tracing to log all HTTP requests
            trace_config = TraceConfig()
            trace_config.on_request_end.append(_on_request_end)

            self._session = aiohttp.ClientSession(
                timeout=self._timeout, trace_configs=[trace_config]
            )
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
        return datetime.now(timezone.utc) < self._token_expiry

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


def get_ebay_api_client() -> EbayAPIClient:
    """FastAPI dependency factory for the eBay API client."""

    # The API client manages its own async session and token cache, so a fresh
    # instance per-request is acceptable. Revisit when we optimise connection reuse.
    return EbayAPIClient()
