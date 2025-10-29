"""Test script for EbayProductResolver with validation."""

from __future__ import annotations

import asyncio
import logging
import uuid

from core.database import SessionLocal
from core.models.catalog import ProductVariant, Product
from core.services.ebay_api_client import get_ebay_api_client
from core.services.ebay_product_resolver import EbayProductResolver, ProductSearchInput
from sqlalchemy.orm import joinedload

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


# Test cases with expected EPIDs - covers all 7 Pokemon printing types
TEST_VARIANTS = {
    "ARTICUNO_2_62_HOLO_1ST_EDITION": {
        "variant_id": "068eae0e-a2d7-744f-8000-dc110ecdcd92",
        "expected_epid": "2314420268",
    },
    "MEGA_GARDEVOIR_EX_178_132_HOLOFOIL": {
        "variant_id": "068eb387-5fd8-7969-8000-bb69c7d577c2",
        "expected_epid": "2356906219",
    },
    "GLIMMET_114_191_REVERSE_HOLO": {
        "variant_id": "068ead47-cab4-7c5d-8000-8ef696f8099a",
        "expected_epid": "21072472714",
    },
    "SNORLAX_11_64_HOLO_UNLIMITED": {
        "variant_id": "068eb274-032e-7a52-8000-42ffef13212c",
        "expected_epid": "12043364833",
    },
    "FEAROW_45_165_NORMAL": {
        "variant_id": "068ead83-3852-7168-8000-0e6e43f69921",
        "expected_epid": "2314420093",
    },
    "CORSOLA_37_75_1ST_EDITION": {
        "variant_id": "068eac66-7b3a-717f-8000-8b4dcfd13e07",
        "expected_epid": "14043371715",
    },
    "STARYU_56_64_UNLIMITED": {
        "variant_id": "068eadb7-0b74-744e-8000-ce932fbbf284",
        "expected_epid": "13043374744",
    },
}


async def test_epid_resolver() -> None:
    """Test EbayProductResolver with validation for different ProductVariants."""

    session = SessionLocal()
    api_client = get_ebay_api_client()
    resolver = EbayProductResolver(api_client=api_client)

    try:
        results = {}
        passed = 0
        failed = 0

        for name, data in TEST_VARIANTS.items():
            variant_id = data["variant_id"]
            expected_epid = data["expected_epid"]

            logger.info(f"\n{'=' * 80}")
            logger.info(f"Testing {name}")
            logger.info(f"Variant ID: {variant_id}")
            logger.info(f"Expected EPID: {expected_epid}")
            logger.info(f"{'=' * 80}")

            # Query the ProductVariant from database
            variant = (
                session.query(ProductVariant)
                .options(
                    joinedload(ProductVariant.product).joinedload(Product.set),
                    joinedload(ProductVariant.printing),
                )
                .filter(ProductVariant.id == uuid.UUID(variant_id))
                .one_or_none()
            )

            # Create ProductSearchInput
            product_input = ProductSearchInput(
                clean_name=variant.product.clean_name,
                number=variant.product.number,
                set_code=variant.product.set.code,
                printing_name=variant.printing.name,
            )
            logger.info(f"Product Input: {product_input}")

            # Resolve EPID
            logger.info(f"\nResolving EPID for {name}...")
            resolved_epid = await resolver.resolve(product_input)

            if resolved_epid == expected_epid:
                logger.info(
                    f"✅ PASS: Resolved EPID {resolved_epid} matches expected EPID {expected_epid}"
                )
                results[name] = {
                    "variant_id": variant_id,
                    "expected_epid": expected_epid,
                    "resolved_epid": resolved_epid,
                    "passed": True,
                }
                passed += 1
            else:
                logger.error(
                    f"❌ FAIL: Resolved EPID {resolved_epid} does not match expected EPID {expected_epid}"
                )
                results[name] = {
                    "variant_id": variant_id,
                    "expected_epid": expected_epid,
                    "resolved_epid": resolved_epid,
                    "passed": False,
                }
                failed += 1

        logger.info(f"\n{'=' * 80}")
        logger.info("TEST SUMMARY")
        logger.info(f"{'=' * 80}")
        logger.info(f"Total: {len(TEST_VARIANTS)}")
        logger.info(f"Passed: {passed}")
        logger.info(f"Failed: {failed}")
        logger.info(f"{'=' * 80}\n")

        return results

    finally:
        session.close()
        await api_client.close()


if __name__ == "__main__":
    results = asyncio.run(test_epid_resolver())

    # Write results to file
    import json

    with open(".tmp/epid_resolver_test_results.json", "w") as f:
        json.dump(results, f, indent=2)

    logger.info("Results written to .tmp/epid_resolver_test_results.json")
