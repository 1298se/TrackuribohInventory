import logging
from asyncio import Lock
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional

import aiohttp

from core.environment import get_environment
from core.services.schemas.schema import (
    CatalogDetailResponseSchema,
    CatalogPrintingResponseSchema,
    CatalogConditionResponseSchema,
    CatalogRarityResponseSchema,
    CatalogLanguageResponseSchema,
    CatalogSetResponseSchema,
    ProductResponseSchema,
    SKUPricingResponseSchema,
    RefreshTokenRequestSchema,
    TCGPlayerProductType,
)

logger = logging.getLogger(__name__)

TCGPLAYER_BASE_URL = "https://api.tcgplayer.com"
TCGPLAYER_ACCESS_TOKEN_URL = f"{TCGPLAYER_BASE_URL}/token"
TCGPLAYER_PRICING_URL = f"{TCGPLAYER_BASE_URL}/pricing"
TCGPLAYER_CATALOG_URL = f"{TCGPLAYER_BASE_URL}/catalog"


def access_token_expired(expiry) -> bool:
    if expiry is None:
        return True
    # Sat, 20 Aug 2022 18:39:21 GMT
    expiry_date = datetime.strptime(expiry, "%a, %d %b %Y %H:%M:%S %Z")

    return datetime.now() > expiry_date


class TCGPlayerCatalogService:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.lock = Lock()
        self.access_token = None
        self.access_token_expiry = None
        self._timeout = aiohttp.ClientTimeout(total=30)  # 30 second default timeout

    async def init(self, timeout_seconds: int = 30):
        """Initialize the service with a new client session"""
        self._timeout = aiohttp.ClientTimeout(total=timeout_seconds)
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(timeout=self._timeout)

    async def close(self) -> None:
        """Close the client session if it exists and is not already closed"""
        if self.session and not self.session.closed:
            await self.session.close()
            self.session = None

    async def get_authorization_headers(self) -> dict:
        async with self.lock:
            refreshed = await self._check_and_refresh_access_token()
            if not refreshed:
                raise Exception("Failed to get or refresh TCGPlayer access token")

            headers = {"Authorization": f"bearer {self.access_token}"}
            return headers

    async def get_catalogs(self, catalog_ids: list[int]) -> CatalogDetailResponseSchema:
        if self.session is None or self.session.closed:
            await self.init()

        url = f"{TCGPLAYER_CATALOG_URL}/categories/{','.join([str(id) for id in catalog_ids])}"
        headers = await self.get_authorization_headers()

        async with self.session.get(url, headers=headers) as response:
            response.raise_for_status()
            response_data = await response.json()
            return CatalogDetailResponseSchema.model_validate(response_data)

    async def get_printings(self, catalog_id: int) -> CatalogPrintingResponseSchema:
        if self.session is None or self.session.closed:
            await self.init()

        url = f"{_get_category_metadata_url(catalog_id)}/printings"
        headers = await self.get_authorization_headers()

        async with self.session.get(url, headers=headers) as response:
            response.raise_for_status()
            response_data = await response.json()
            return CatalogPrintingResponseSchema.model_validate(response_data)

    async def get_conditions(self, catalog_id: int) -> CatalogConditionResponseSchema:
        if self.session is None or self.session.closed:
            await self.init()

        url = f"{_get_category_metadata_url(catalog_id)}/conditions"
        headers = await self.get_authorization_headers()

        async with self.session.get(url, headers=headers) as response:
            response.raise_for_status()
            return CatalogConditionResponseSchema.model_validate(await response.json())

    async def get_rarities(self, catalog_id: int) -> CatalogRarityResponseSchema:
        if self.session is None or self.session.closed:
            await self.init()

        url = f"{_get_category_metadata_url(catalog_id)}/rarities"
        headers = await self.get_authorization_headers()

        async with self.session.get(url, headers=headers) as response:
            response.raise_for_status()
            return CatalogRarityResponseSchema.model_validate(await response.json())

    async def get_languages(self, catalog_id: int) -> CatalogLanguageResponseSchema:
        if self.session is None or self.session.closed:
            await self.init()

        url = f"{_get_category_metadata_url(catalog_id)}/languages"
        headers = await self.get_authorization_headers()

        async with self.session.get(url, headers=headers) as response:
            response.raise_for_status()
            return CatalogLanguageResponseSchema.model_validate(await response.json())

    async def get_sets(
        self, catalog_id: int, offset: int, limit: int
    ) -> CatalogSetResponseSchema:
        if self.session is None or self.session.closed:
            await self.init()

        url = f"{_get_category_metadata_url(catalog_id)}/groups"
        headers = await self.get_authorization_headers()
        params = {
            "offset": offset,
            "limit": limit,
        }

        async with self.session.get(url, headers=headers, params=params) as response:
            if response.status == 404:
                return CatalogSetResponseSchema(
                    total_items=0,
                    success=True,
                    errors=[],
                    results=[],
                )

            response.raise_for_status()
            return CatalogSetResponseSchema.model_validate(await response.json())

    async def get_products(
        self, tcgplayer_set_id: int, offset, limit, product_type: TCGPlayerProductType
    ) -> ProductResponseSchema:
        if self.session is None or self.session.closed:
            await self.init()

        query_params = {
            "getExtendedFields": "true",
            "includeSkus": "true",
            "productTypes": product_type.value,
            "offset": offset,
            "limit": limit,
            "groupId": tcgplayer_set_id,
        }

        url = f"{TCGPLAYER_CATALOG_URL}/products"
        headers = await self.get_authorization_headers()

        async with self.session.get(
            url, headers=headers, params=query_params
        ) as response:
            if response.status == 404:
                return ProductResponseSchema(
                    total_items=0,
                    success=True,
                    errors=[],
                    results=[],
                )

            response.raise_for_status()
            return ProductResponseSchema.model_validate(await response.json())

    async def get_sku_prices(
        self, tcgplayer_sku_ids: list[int]
    ) -> SKUPricingResponseSchema:
        if self.session is None or self.session.closed:
            await self.init()

        url = f"{TCGPLAYER_PRICING_URL}/sku/{', '.join([str(id) for id in tcgplayer_sku_ids])}"
        headers = await self.get_authorization_headers()

        async with self.session.get(url, headers=headers) as response:
            response.raise_for_status()
            return SKUPricingResponseSchema.model_validate(await response.json())

    async def _check_and_refresh_access_token(self) -> bool:
        if access_token_expired(self.access_token_expiry):
            logging.debug("ACCESS TOKEN EXPIRED: Fetching new one")
            environment = get_environment()

            data = RefreshTokenRequestSchema(
                grant_type="client_credentials",
                client_id=environment.tcgplayer_client_id,
                client_secret=environment.tcgplayer_client_secret,
            ).model_dump()

            try:
                async with self.session.post(
                    TCGPLAYER_ACCESS_TOKEN_URL, data=data
                ) as response:
                    if not response.ok:
                        logger.error(
                            f"Failed to refresh TCGPlayer token: {response.status}"
                        )
                        return False

                    data = await response.json()
                    self.access_token = data["access_token"]
                    self.access_token_expiry = data[".expires"]
                    return True
            except Exception as e:
                logger.error(f"Exception refreshing TCGPlayer token: {str(e)}")
                return False
        else:
            return True


# Singleton instance for the application
_tcgplayer_catalog_service = TCGPlayerCatalogService()


def get_tcgplayer_catalog_service() -> TCGPlayerCatalogService:
    """Get the singleton instance of the TCGPlayer catalog service"""
    return _tcgplayer_catalog_service


@asynccontextmanager
async def tcgplayer_service_context(timeout_seconds: int = 30):
    """
    Context manager for scripts to use the TCGPlayer catalog service.

    Example:
        async with tcgplayer_service_context() as svc:
            result = await svc.get_catalogs([1, 2, 3])
    """
    # For scripts, create a fresh instance that will be cleaned up
    svc = TCGPlayerCatalogService()
    await svc.init(timeout_seconds=timeout_seconds)
    try:
        yield svc
    finally:
        await svc.close()


def _get_category_metadata_url(catalog_id):
    return f"{TCGPLAYER_CATALOG_URL}/categories/{catalog_id}"
