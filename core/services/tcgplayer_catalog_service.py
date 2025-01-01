import logging
from asyncio import Lock
from datetime import datetime
from functools import lru_cache

import aiohttp

from core.environment import get_environment
from core.services.schemas.schema import CatalogDetailResponseSchema, CatalogPrintingResponseSchema, \
    CatalogConditionResponseSchema, CatalogRarityResponseSchema, CatalogLanguageResponseSchema, \
    CatalogSetResponseSchema, ProductType, ProductResponseSchema, SKUPricingResponseSchema, RefreshTokenRequestSchema

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
        self.session = None
        self.lock = Lock()
        self.access_token = None
        self.access_token_expiry = None

    async def __aenter__(self):
        await self.init()

        return self

    async def __aexit__(self, *args, **kwargs):
        await self.close()

    async def init(self):
        self.session = aiohttp.ClientSession()

    async def close(self) -> None:
        if not self.session.closed:
            await self.session.close()

    async def get_authorization_headers(self) -> dict:
        async with self.lock:
            headers = {}

            await self._check_and_refresh_access_token()

            headers['Authorization'] = f"bearer {self.access_token}"

            return headers


    async def get_catalogs(self, catalog_ids: list[int]) -> CatalogDetailResponseSchema:
        response = await self.session.get(
            f"{TCGPLAYER_CATALOG_URL}/categories/{",".join([str(id) for id in catalog_ids])}",
            headers=await self.get_authorization_headers()
        )

        response_data = await response.json()

        return CatalogDetailResponseSchema.model_validate(response_data)

    async def get_printings(self, catalog_id: int) -> CatalogPrintingResponseSchema:
        response = await self.session.get(
            f"{_get_category_metadata_url(catalog_id)}/printings",
            headers=await self.get_authorization_headers()
        )

        response_data = await response.json()

        return CatalogPrintingResponseSchema.model_validate(response_data)

    async def get_conditions(self, catalog_id: int) -> CatalogConditionResponseSchema:
        response = await self.session.get(
            f"{_get_category_metadata_url(catalog_id)}/conditions",
            headers=await self.get_authorization_headers(),
        )

        return CatalogConditionResponseSchema.model_validate(await response.json())

    async def get_rarities(self, catalog_id: int) -> CatalogRarityResponseSchema:
        response = await self.session.get(
            f"{_get_category_metadata_url(catalog_id)}/rarities",
            headers=await self.get_authorization_headers(),
        )

        return CatalogRarityResponseSchema.model_validate(await response.json())

    async def get_languages(self, catalog_id: int) -> CatalogLanguageResponseSchema:
        response = await self.session.get(
            f"{_get_category_metadata_url(catalog_id)}/languages",
            headers=await self.get_authorization_headers(),
        )

        return CatalogLanguageResponseSchema.model_validate(await response.json())

    async def get_sets(self, catalog_id: int, offset: int, limit: int) -> CatalogSetResponseSchema:
        response = await self.session.get(
            f"{_get_category_metadata_url(catalog_id)}/groups",
            headers=await self.get_authorization_headers(),
            params={
                "offset": offset,
                "limit": limit,
            }
        )

        return CatalogSetResponseSchema.model_validate(await response.json())

    async def get_products(self, tcgplayer_set_id: int, offset, limit, product_type: ProductType) -> ProductResponseSchema:
        query_params = {
            "getExtendedFields": "true",
            "includeSkus": "true",
            "productTypes": product_type.value,
            "offset": offset,
            "limit": limit,
            "groupId": tcgplayer_set_id,
        }

        response = await self.session.get(
            f'{TCGPLAYER_CATALOG_URL}/products',
            headers=await self.get_authorization_headers(),
            params=query_params
        )

        return ProductResponseSchema.model_validate(await response.json())

    async def get_sku_prices(self, tcgplayer_sku_ids: list[int]) -> SKUPricingResponseSchema:
        response = await self.session.get(
            f"{TCGPLAYER_PRICING_URL}/sku/{", ".join([str(id) for id in tcgplayer_sku_ids])}",
            headers=await self.get_authorization_headers(),
        )

        return SKUPricingResponseSchema.model_validate(await response.json())


    async def _check_and_refresh_access_token(self) -> bool:
        if access_token_expired(self.access_token_expiry):
            logging.debug("ACCESS TOKEN EXPIRED: Fetching new one")
            environment = get_environment()

            response = await self.session.post(
                TCGPLAYER_ACCESS_TOKEN_URL,
                data=RefreshTokenRequestSchema(
                    grant_type="client_credentials",
                    client_id=environment.tcgplayer_client_id,
                    client_secret=environment.tcgplayer_client_secret,
                ).model_dump(),
            )

            if not response.ok:
                return False

            data = await response.json()

            self.access_token = data['access_token']
            self.access_token_expiry = data['.expires']

            return True
        else:
            return False

@lru_cache()
def get_tcgplayer_catalog_service() -> TCGPlayerCatalogService:
    return TCGPlayerCatalogService()

def _get_category_metadata_url(catalog_id):
    return f"{TCGPLAYER_CATALOG_URL}/categories/{catalog_id}"

