from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import MappingProxyType
from typing import List, TypedDict, Any, Optional

import aiohttp
from pydantic import BaseModel

from core.environment import get_environment
from core.services.tcgplayer_types import TCGPlayerListing, TCGPlayerSale


class CardListingRequestData(TypedDict, total=False):
    """Payload for TCGPlayer listing requests."""

    product_id: int  # Required
    printings: Optional[List[str]]  # Optional, defaults to None
    conditions: Optional[List[str]]  # Optional, defaults to None
    languages: Optional[List[str]]  # Optional, defaults to None


class CardSaleRequestData(TypedDict, total=False):
    """Payload for TCGPlayer sales requests."""

    product_id: int  # Required
    printings: Optional[List[int]]  # Optional, defaults to None
    conditions: Optional[List[int]]  # Optional, defaults to None
    languages: Optional[List[int]]  # Optional, defaults to None


class CardSaleResponse(BaseModel):
    """Individual sale record from TCGPlayer sales API, with parsed orderDate."""

    condition: str
    variant: str
    language: str
    quantity: int
    title: str
    listingType: str
    customListingId: str
    purchasePrice: Decimal
    shippingPrice: Decimal
    orderDate: datetime


class CardSalesResponse(BaseModel):
    """Full response from TCGPlayer sales API."""

    previousPage: str
    nextPage: str
    resultCount: int
    totalResults: int
    data: List[CardSaleResponse]


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
_base_headers = {
    "origin": "https://www.tcgplayer.com",
    "Referer": "https://www.tcgplayer.com",
    "accept": "application/json",
    "content-type": "application/json",
    "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Mobile Safari/537.36",
}

_env = get_environment()
_cookie = _env.get_tcgplayer_cookie()
if _cookie:
    _base_headers["Cookie"] = _cookie

BASE_HEADERS = MappingProxyType(_base_headers)


def get_product_active_listings_request_payload(
    offset: int,
    limit: int,
    printings: Optional[List[str]] = None,
    conditions: Optional[List[str]] = None,
    languages: Optional[List[str]] = None,
):
    # Build term filters conditionally
    term = {
        "sellerStatus": "Live",
        "channelId": 0,
        "listingType": "standard",
    }

    # Only add filters if non-empty values provided
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


def get_sales_request_payload(
    count: int,
    offset: int,
    printings: Optional[List[str]] = None,
    conditions: Optional[List[str]] = None,
    languages: Optional[List[str]] = None,
):
    payload = {
        "listingType": "ListingWithoutPhotos",
        "limit": count,
        "offset": offset,
        "time": datetime.now().timestamp() * 1000,
    }

    # Only add filters if non-empty values provided
    if printings:
        payload["variants"] = printings
    if conditions:
        payload["conditions"] = conditions
    if languages:
        payload["languages"] = languages

    return payload


def _convert_listing_to_dto(listing: "ListingSchema") -> TCGPlayerListing:
    """Convert Pydantic ListingSchema to DTO."""
    return TCGPlayerListing(
        price=listing.price,
        shipping_price=listing.shippingPrice,
        quantity=listing.quantity,
        listing_id=listing.listingId,
        product_id=listing.productId,
        product_condition_id=listing.productConditionId,
        condition=listing.condition,
        printing=listing.printing,
        language=listing.language,
        language_abbreviation=listing.languageAbbreviation,
        language_id=listing.languageId,
        seller_id=listing.sellerId,
        seller_name=listing.sellerName,
        seller_rating=listing.sellerRating,
        seller_sales=listing.sellerSales,
        seller_key=listing.sellerKey,
        channel_id=listing.channelId,
        condition_id=listing.conditionId,
        listing_type=listing.listingType,
        gold_seller=listing.goldSeller,
        verified_seller=listing.verifiedSeller,
        direct_seller=listing.directSeller,
        direct_product=listing.directProduct,
        direct_inventory=listing.directInventory,
        ranked_shipping_price=listing.rankedShippingPrice,
        seller_shipping_price=listing.sellerShippingPrice,
        forward_freight=listing.forwardFreight,
        score=listing.score,
        custom_data=listing.customData,
    )


def _convert_sale_to_dto(sale: CardSaleResponse) -> TCGPlayerSale:
    """Convert Pydantic CardSaleResponse to DTO."""
    return TCGPlayerSale(
        purchase_price=sale.purchasePrice,
        shipping_price=sale.shippingPrice,
        quantity=sale.quantity,
        order_date=sale.orderDate,
        condition=sale.condition,
        variant=sale.variant,
        language=sale.language,
        title=sale.title,
        listing_type=sale.listingType,
        custom_listing_id=sale.customListingId,
    )


# Define Pydantic schemas for TCGPlayer listings API response
class AggregationItemSchema(BaseModel):
    value: Any
    count: int


class AggregationsSchema(BaseModel):
    condition: List[AggregationItemSchema]
    quantity: List[AggregationItemSchema]
    language: List[AggregationItemSchema]
    printing: List[AggregationItemSchema]


class ListingSchema(BaseModel):
    directProduct: bool
    goldSeller: bool
    listingId: int
    channelId: int
    conditionId: int
    verifiedSeller: bool
    directInventory: int
    rankedShippingPrice: Decimal
    productId: int
    printing: str
    languageAbbreviation: str
    sellerName: str
    forwardFreight: bool
    sellerShippingPrice: Decimal
    language: str
    shippingPrice: Decimal
    condition: str
    languageId: int
    score: float
    directSeller: bool
    productConditionId: int
    sellerId: str
    listingType: str
    sellerRating: float
    sellerSales: str
    quantity: int
    sellerKey: str
    price: Decimal
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
) -> list[TCGPlayerListing]:
    """Fetch all active listings for a product using aiohttp asynchronously."""
    product_id = request["product_id"]
    listings: dict[int, TCGPlayerListing] = {}
    url = BASE_LISTINGS_URL % product_id
    cur_offset = 0

    async with aiohttp.ClientSession(headers=BASE_HEADERS) as session:
        while True:
            payload = get_product_active_listings_request_payload(
                offset=cur_offset,
                limit=LISTING_PAGINATION_SIZE,
                printings=request.get("printings"),
                conditions=request.get("conditions"),
                languages=request.get("languages"),
            )

            async with session.post(url, json=payload) as response:
                response.raise_for_status()
                raw = await response.json()
            # Validate and parse raw API response
            parsed = TCGPlayerListingsResponseSchema.model_validate(raw)
            page = parsed.results[0]
            total_listings = page.totalResults
            results = page.results

            # Convert each ListingSchema into a DTO
            for listing in results:
                dto = _convert_listing_to_dto(listing)
                listings[listing.listingId] = dto

            cur_offset += len(results)
            if cur_offset >= total_listings:
                break

    return list(listings.values())


async def get_sales(
    request: CardSaleRequestData, time_delta: timedelta
) -> list[TCGPlayerSale]:
    """Fetch recent sales for a product within time_delta using aiohttp asynchronously."""
    sales: list[TCGPlayerSale] = []
    url = BASE_SALES_URL % request["product_id"]

    async with aiohttp.ClientSession(headers=BASE_HEADERS) as session:
        while True:
            payload = get_sales_request_payload(
                count=25,
                offset=len(sales),
                printings=request.get("printings"),
                conditions=request.get("conditions"),
                languages=request.get("languages"),
            )

            async with session.post(url, json=payload) as response:
                response.raise_for_status()
                raw = await response.json()
            # Parse with Pydantic to convert orderDate to datetime
            parsed = CardSalesResponse.model_validate(raw)

            has_new_sales = True
            for sale in parsed.data:
                # sale.orderDate is already a datetime
                if sale.orderDate >= datetime.now(timezone.utc) - time_delta:
                    dto = _convert_sale_to_dto(sale)
                    sales.append(dto)
                else:
                    has_new_sales = False

            if not parsed.nextPage or not has_new_sales:
                break

    return sales
