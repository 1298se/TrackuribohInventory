from datetime import datetime, timedelta, timezone
from types import MappingProxyType
from typing import List, TypedDict, Any

import aiohttp
from pydantic import BaseModel


class CardListingRequestData(TypedDict):
    """Payload for TCGPlayer listing requests."""

    product_id: int
    printings: List[str]
    conditions: List[str]
    languages: List[str]


class CardSaleRequestData(TypedDict):
    """Payload for TCGPlayer sales requests."""

    product_id: int
    printings: List[int]
    conditions: List[int]
    languages: List[int]


class CardSaleResponse(BaseModel):
    """Individual sale record from TCGPlayer sales API, with parsed orderDate."""

    condition: str
    variant: str
    language: str
    quantity: int
    title: str
    listingType: str
    customListingId: str
    purchasePrice: float
    shippingPrice: float
    orderDate: datetime


class CardSalesResponse(BaseModel):
    """Full response from TCGPlayer sales API."""

    previousPage: str
    nextPage: str
    resultCount: int
    totalResults: int
    data: List[CardSaleResponse]


class SKUListingResponse(BaseModel):
    """Individual listing item from TCGPlayer listings API."""

    directProduct: bool
    goldSeller: bool
    listingId: float
    channelId: float
    conditionId: float
    verifiedSeller: bool
    directInventory: float
    rankedShippingPrice: float
    productId: float
    printing: str
    languageAbbreviation: str
    sellerName: str
    forwardFreight: bool
    sellerShippingPrice: float
    language: str
    shippingPrice: float
    condition: str
    languageId: float
    score: float
    directSeller: bool
    productConditionId: float
    sellerId: str
    listingType: str
    sellerRating: float
    sellerSales: str
    quantity: float
    sellerKey: str
    price: float
    customData: Any


LISTING_PAGINATION_SIZE = 50

BASE_LISTINGS_URL = "https://mp-search-api.tcgplayer.com/v1/product/%d/listings"
BASE_SALES_URL = "https://mpapi.tcgplayer.com/v2/product/%d/latestsales"

DEFAULT_LISTINGS_CONFIG = {
    "filter_custom": False,
}

DEFAULT_SALES_CONFIG = {
    "filter_custom": False,
}

# Use MappingProxyType to make immutable
BASE_HEADERS = MappingProxyType(
    {
        "origin": "https://www.tcgplayer.com",
        "Referer": "https://www.tcgplayer.com",
        "accept": "application/json",
        "content-type": "application/json",
        "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Mobile Safari/537.36",
    }
)


def get_product_active_listings_request_payload(
    offset: int,
    limit: int,
    printings: List[str],
    conditions: List[str],
):
    return {
        "filters": {
            "term": {
                "sellerStatus": "Live",
                "channelId": 0,
                "language": ["English"],
                "printing": printings,
                "condition": conditions,
                "listingType": "standard",
            },
            "range": {"quantity": {"gte": 1}},
            "exclude": {"channelExclusion": 0, "listingType": "custom"},
        },
        "from": offset,
        "size": limit,
        "context": {"shippingCountry": "US", "cart": {}},
        "sort": {"field": "price+shipping", "order": "asc"},
    }


def get_sales_request_payload(
    count: int,
    offset: int,
    printings: List[str],
    conditions: List[str],
    languages: List[str],
):
    return {
        "listingType": "ListingWithoutPhotos",
        "limit": count,
        "offset": offset,
        "variants": printings,
        "time": datetime.now().timestamp() * 1000,
        "conditions": conditions,
        "languages": languages,
    }


# Define Pydantic schemas for TCGPlayer listings API response
class AggregationItemSchema(BaseModel):
    value: Any
    count: float


class AggregationsSchema(BaseModel):
    condition: List[AggregationItemSchema]
    quantity: List[AggregationItemSchema]
    language: List[AggregationItemSchema]
    printing: List[AggregationItemSchema]


class ListingSchema(BaseModel):
    directProduct: bool
    goldSeller: bool
    listingId: float
    channelId: float
    conditionId: float
    verifiedSeller: bool
    directInventory: float
    rankedShippingPrice: float
    productId: float
    printing: str
    languageAbbreviation: str
    sellerName: str
    forwardFreight: bool
    sellerShippingPrice: float
    language: str
    shippingPrice: float
    condition: str
    languageId: float
    score: float
    directSeller: bool
    productConditionId: float
    sellerId: str
    listingType: str
    sellerRating: float
    sellerSales: str
    quantity: float
    sellerKey: str
    price: float
    customData: Any


class PageSchema(BaseModel):
    totalResults: int
    resultId: str
    aggregations: AggregationsSchema
    results: List[ListingSchema]


class TCGPlayerListingsResponseSchema(BaseModel):
    errors: List[str]
    results: List[PageSchema]


async def get_product_active_listings(
    request: CardListingRequestData,
) -> list[SKUListingResponse]:
    """Fetch all active listings for a product using aiohttp asynchronously."""
    product_id = request["product_id"]
    listings: dict[float, SKUListingResponse] = {}
    url = BASE_LISTINGS_URL % product_id
    cur_offset = 0

    async with aiohttp.ClientSession(headers=BASE_HEADERS) as session:
        while True:
            payload = get_product_active_listings_request_payload(
                offset=cur_offset,
                limit=LISTING_PAGINATION_SIZE,
                printings=request["printings"],
                conditions=request["conditions"],
            )

            async with session.post(url, json=payload) as response:
                response.raise_for_status()
                raw = await response.json()
            # Validate and parse raw API response
            parsed = TCGPlayerListingsResponseSchema.parse_obj(raw)
            page = parsed.results[0]
            total_listings = page.totalResults
            results = page.results

            # Convert each ListingSchema into a Pydantic SKUListingResponse
            for listing in results:
                instance = SKUListingResponse.parse_obj(listing.dict())
                listings[listing.listingId] = instance

            cur_offset += len(results)
            if cur_offset >= total_listings:
                break

    return list(listings.values())


async def get_sales(
    request: CardSaleRequestData, time_delta: timedelta
) -> list[CardSaleResponse]:
    """Fetch recent sales for a product within time_delta using aiohttp asynchronously."""
    sales: list[CardSaleResponse] = []
    url = BASE_SALES_URL % request["product_id"]

    async with aiohttp.ClientSession(headers=BASE_HEADERS) as session:
        while True:
            payload = get_sales_request_payload(
                count=25,
                offset=len(sales),
                printings=request["printings"],
                conditions=request["conditions"],
                languages=request["languages"],
            )

            async with session.post(url, json=payload) as response:
                response.raise_for_status()
                raw = await response.json()
            # Parse with Pydantic to convert orderDate to datetime
            parsed = CardSalesResponse.parse_obj(raw)

            has_new_sales = True
            for sale in parsed.data:
                # sale.orderDate is already a datetime
                if sale.orderDate >= datetime.now(timezone.utc) - time_delta:
                    sales.append(sale)
                else:
                    has_new_sales = False

            if not parsed.nextPage or not has_new_sales:
                break

    return sales
