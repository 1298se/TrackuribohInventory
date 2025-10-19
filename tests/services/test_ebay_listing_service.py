"""Manual script to test eBay Browse API getItem endpoint with PRODUCT fieldgroup."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid

from core.database import SessionLocal
from core.models.catalog import ProductVariant
from core.services.ebay_api_client import get_ebay_api_client
from core.services.ebay_listing_service import EbayListingService
from core.services.redis_service import create_redis_client
from sqlalchemy.orm import joinedload

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


ARTICUNO_FOSSIL_EPID = "2314420268"

# Test item IDs for product feature verification
TEST_ITEMS = {
    "ARTICUNO_2_62_HOLO_1ST_EDITION": {
        "item_id": "v1|406018874232|0",
        "variant_id": "068eae0e-a2d7-744f-8000-dc110ecdcd92",
    },
    "MEGA_GARDEVOIR_EX_178_132": {
        "item_id": "v1|336227071121|0",
        "variant_id": "068eb387-5fd8-7969-8000-bb69c7d577c2",
    },
    "GLIMMET_114_191_REVERSE_HOLO": {
        "item_id": "v1|146612298662|0",
        "variant_id": "068ead47-cab4-7c5d-8000-8ef696f8099a",
    },
}


async def test_get_item_product_features() -> None:
    """Test getItem endpoint to understand product features for different variants."""

    api_client = get_ebay_api_client()
    session = SessionLocal()

    try:
        results = {}

        for name, data in TEST_ITEMS.items():
            item_id = data["item_id"]
            variant_id = data["variant_id"]

            logger.info(f"\n{'=' * 80}")
            logger.info(f"Testing {name}")
            logger.info(f"Item ID: {item_id}")
            logger.info(f"Variant ID: {variant_id}")
            logger.info(f"{'=' * 80}")

            # Query the ProductVariant from database
            try:
                variant = (
                    session.query(ProductVariant)
                    .options(
                        joinedload(ProductVariant.product),
                        joinedload(ProductVariant.printing),
                        joinedload(ProductVariant.language),
                    )
                    .filter(ProductVariant.id == uuid.UUID(variant_id))
                    .one_or_none()
                )

                if variant:
                    logger.info("\n--- Database ProductVariant Info ---")
                    logger.info(f"Product: {variant.product.name}")
                    logger.info(f"Product Number: {variant.product.number}")
                    logger.info(f"Printing: {variant.printing.name}")
                    logger.info(f"Language: {variant.language.name}")
                    logger.info("------------------------------------\n")
                else:
                    logger.warning(f"ProductVariant {variant_id} not found in database")

            except Exception as e:
                logger.error(f"Failed to query ProductVariant: {e}", exc_info=True)
                variant = None

            # Fetch eBay item data
            try:
                item_data = await api_client.get_item(item_id, fieldgroups="PRODUCT")
                results[name] = {
                    "variant_id": variant_id,
                    "item_id": item_id,
                    "item_data": item_data.model_dump(),
                    "db_variant": {
                        "product_name": variant.product.name if variant else None,
                        "product_number": variant.product.number if variant else None,
                        "printing_name": variant.printing.name if variant else None,
                        "language_name": variant.language.name if variant else None,
                    }
                    if variant
                    else None,
                }

                # Extract key product features
                if item_data.product:
                    product = item_data.product
                    logger.info(f"eBay Product title: {product.title or 'N/A'}")

                    if product.aspectGroups:
                        for group in product.aspectGroups:
                            group_name = group.localizedGroupName or "Unknown"
                            logger.info(f"\n{group_name}:")
                            for aspect in group.aspects or []:
                                aspect_name = aspect.localizedName or "Unknown"
                                aspect_values = aspect.localizedValues or []
                                logger.info(
                                    f"  {aspect_name}: {', '.join(aspect_values)}"
                                )

                                # Highlight the Finish, Features, and Card Number fields for comparison
                                if aspect_name == "Finish" and variant:
                                    logger.info(
                                        f"  >>> COMPARISON: DB Printing='{variant.printing.name}' vs eBay Finish='{', '.join(aspect_values)}'"
                                    )
                                elif aspect_name == "Features" and variant:
                                    logger.info(
                                        f"  >>> COMPARISON: DB Printing='{variant.printing.name}' vs eBay Features='{', '.join(aspect_values)}'"
                                    )
                                elif aspect_name == "Card Number" and variant:
                                    logger.info(
                                        f"  >>> COMPARISON: DB Product Number='{variant.product.number}' vs eBay Card Number='{', '.join(aspect_values)}'"
                                    )

            except Exception as e:
                logger.error(f"Failed to fetch item {item_id}: {e}", exc_info=True)
                results[name] = {
                    "variant_id": variant_id,
                    "item_id": item_id,
                    "error": str(e),
                    "db_variant": {
                        "product_name": variant.product.name if variant else None,
                        "product_number": variant.product.number if variant else None,
                        "printing_name": variant.printing.name if variant else None,
                        "language_name": variant.language.name if variant else None,
                    }
                    if variant
                    else None,
                }

        return results

    finally:
        await api_client.close()
        session.close()


async def test_browse_get_item(epid: str) -> None:
    """Test fetching item details with PRODUCT fieldgroup to get aspects like rarity and edition."""

    redis_client = await create_redis_client()
    api_client = get_ebay_api_client()
    service = EbayListingService(redis_client, api_client)

    try:
        logger.info("Testing Browse API getItem for EPID: %s", epid)

        # First, get listings to find an item_id
        logger.info("Fetching listings to get an item_id...")
        listings = await service.get_product_active_listings(
            {"epid": epid}, bypass_cache=True
        )

        if not listings:
            logger.error("No listings found for EPID: %s", epid)
            return

        first_listing = listings[0]
        item_id = first_listing.listing_id
        logger.info("Found item_id: %s", item_id)
        logger.info("Listing title: %s", first_listing.title)

        # Now call getItem with PRODUCT fieldgroup
        logger.info("\nCalling getItem with PRODUCT fieldgroup...")
        item_data = await api_client.get_item(item_id, fieldgroups="PRODUCT")

        # Print the raw JSON response
        print("\n" + "=" * 80)
        print("=== Full getItem Response with PRODUCT fieldgroup ===")
        print("=" * 80)
        print(json.dumps(item_data.model_dump(), indent=2))

        # Extract and display product aspects if available
        if item_data.product and item_data.product.aspectGroups:
            print("\n" + "=" * 80)
            print("=== Product Aspects ===")
            print("=" * 80)
            for group in item_data.product.aspectGroups:
                group_name = group.localizedGroupName or "Unknown Group"
                print(f"\n{group_name}:")
                for aspect in group.aspects or []:
                    aspect_name = aspect.localizedName or "Unknown"
                    aspect_values = aspect.localizedValues or []
                    print(f"  {aspect_name}: {', '.join(aspect_values)}")
        else:
            logger.info("\nNo product.aspectGroups found in response")

    except Exception as e:
        logger.error("Failed to fetch item: %s", e, exc_info=True)
        raise

    finally:
        await api_client.close()
        await redis_client.close()


if __name__ == "__main__":
    # Run the product features test
    results = asyncio.run(test_get_item_product_features())

    # Write results to file
    with open(".tmp/product_features_test_results.json", "w") as f:
        json.dump(results, f, indent=2)

    logger.info("\nResults written to .tmp/product_features_test_results.json")
