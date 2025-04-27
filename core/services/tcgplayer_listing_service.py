from datetime import datetime, timedelta, timezone
from types import MappingProxyType
from typing import List, TypedDict, Any

import aiohttp


# TypedDicts for TCGPlayer listing and sales service
class CardRequestData(TypedDict):
    """Payload for TCGPlayer listing and sales requests."""

    product_id: int
    printings: List[str]
    conditions: List[str]


class CardSaleResponse(TypedDict):
    """Individual sale record from TCGPlayer sales API."""

    condition: str
    variant: str
    language: str
    quantity: int
    title: str
    listingType: str
    customListingId: str
    purchasePrice: float
    shippingPrice: float
    orderDate: str


class CardSalesResponse(TypedDict):
    """Full response from TCGPlayer sales API."""

    previousPage: str
    nextPage: str
    resultCount: int
    totalResults: int
    data: List[CardSaleResponse]


class SKUListingResponse(TypedDict):
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
    count: int, offset: int, printings: List[str], conditions: List[str]
):
    return {
        "listingType": "ListingWithoutPhotos",
        "limit": count,
        "offset": offset,
        "variants": printings,
        "time": datetime.now().timestamp() * 1000,
        "conditions": conditions,
    }


async def get_product_active_listings(
    request: CardRequestData,
) -> list[SKUListingResponse]:
    """Fetch all active listings for a product using aiohttp asynchronously."""
    product_id = request["product_id"]
    listings: dict[float, Any] = {}
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
                data = await response.json()

            listing_data = data["results"][0]
            total_listings = listing_data["totalResults"]
            results = listing_data["results"]

            # Avoid duplicates due to pagination
            for result in results:
                listings[result["listingId"]] = result

            cur_offset += len(results)
            if cur_offset >= total_listings:
                break

    return list(listings.values())


async def get_sales(
    request: CardRequestData, time_delta: timedelta
) -> list[CardSaleResponse]:
    """Fetch recent sales for a product within time_delta using aiohttp asynchronously."""
    sales: list[CardSaleResponse] = []
    product_id = request["product_id"]
    url = BASE_SALES_URL % product_id

    async with aiohttp.ClientSession(headers=BASE_HEADERS) as session:
        while True:
            payload = get_sales_request_payload(
                count=25,
                offset=len(sales),
                conditions=request["conditions"],
                printings=request["printings"],
            )

            async with session.post(url, json=payload) as response:
                response.raise_for_status()
                data: CardSalesResponse = await response.json()

            has_new_sales = True
            for sale_response in data["data"]:
                order_dt = CardSaleResponse.parse_response_order_date(
                    sale_response["orderDate"]
                )
                if order_dt >= datetime.now(timezone.utc) - time_delta:
                    sales.append(sale_response)
                else:
                    has_new_sales = False

            if not data.get("nextPage") or not has_new_sales:
                break

    return sales
