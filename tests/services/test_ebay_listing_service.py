"""Manual script to inspect eBay listing responses for a known EPID."""

from __future__ import annotations

import asyncio
from pprint import pprint

from core.services.ebay_api_client import get_ebay_api_client
from core.services.ebay_listing_service import EbayListingService
from core.services.redis_service import create_redis_client

DEFAULT_EPID = "8058598338"


async def fetch_active_listings(epid: str) -> None:
    """Fetch and print raw listing pages for the provided EPID."""

    redis_client = await create_redis_client()
    api_client = get_ebay_api_client()
    service = EbayListingService(redis_client, api_client)

    try:
        listings = await service.get_product_active_listings({"epid": epid})
        print(f"Fetched {len(listings)} listings for epid={epid}")
        for item_index, item in enumerate(listings, start=1):
            print(f"Listing {item_index}:")
            pprint(item.model_dump())
    finally:
        await api_client.close()
        await redis_client.close()


if __name__ == "__main__":
    asyncio.run(fetch_active_listings(DEFAULT_EPID))
