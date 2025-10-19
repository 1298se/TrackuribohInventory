"""Backfill script to populate ebay_product_id (EPID) for ProductVariant records."""

import asyncio
import logging
from datetime import datetime

from core.database import SessionLocal
from core.models.catalog import ProductVariant, Product, Printing, Set, Catalog
from core.services.schemas.schema import ProductType
from core.services.ebay_api_client import get_ebay_api_client
from core.services.ebay_product_resolver import (
    EbayProductResolver,
    ProductSearchInput,
    POKEMON_PRINTING_PRIORITY,
)
from core.utils.request_pacer import ConstantRatePacer
from sqlalchemy import case
from sqlalchemy.orm import joinedload

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def get_pokemon_card_variants_without_epid(session) -> list[ProductVariant]:
    """Query Pokemon card variants that don't have eBay EPIDs yet.

    Ordered by:
    1. Set release date (oldest first)
    2. Printing rarity (rarest first: 1st Ed Holo → Normal)
    3. Product number (for consistency)

    Args:
        session: SQLAlchemy database session

    Returns:
        List of ProductVariant objects without EPIDs, ordered by priority
    """
    logger.info("Fetching Pokemon card variants without eBay EPIDs...")

    # Build printing priority case statement
    printing_priority_case = case(
        *[
            (Printing.name == name, priority)
            for name, priority in POKEMON_PRINTING_PRIORITY.items()
        ],
        else_=999,  # Unknown printings go last
    )

    variants = (
        session.query(ProductVariant)
        .join(ProductVariant.product)
        .join(Product.set)
        .join(Set.catalog)
        .join(ProductVariant.printing)
        .options(
            joinedload(ProductVariant.product).joinedload(Product.set),
            joinedload(ProductVariant.printing),
            joinedload(ProductVariant.language),
        )
        .filter(
            Product.product_type == ProductType.CARDS,
            Catalog.tcgplayer_id == 3,  # Pokemon catalog
            ProductVariant.ebay_product_id.is_(None),  # Only variants without EPIDs
            ~Product.name.like("Code Card%"),  # Exclude code cards
            Set.release_date <= datetime.now(),  # Only released sets
        )
        .order_by(
            Set.release_date.asc(),  # Oldest sets first
            printing_priority_case.asc(),  # Rarest printings first
            Product.number.asc(),  # Card number for consistency
        )
        .all()
    )
    logger.info(f"Found {len(variants)} Pokemon card variants without EPIDs")
    return variants


async def backfill_product_variant_epid():
    """Backfill eBay Product IDs (EPIDs) for Pokemon card ProductVariant records."""
    session = SessionLocal()
    api_client = get_ebay_api_client()
    resolver = EbayProductResolver(api_client=api_client)

    # Rate limiting to avoid eBay API limits
    pacer = ConstantRatePacer(requests_per_second=1.0)

    try:
        # Fetch all variants without EPIDs
        all_variants = get_pokemon_card_variants_without_epid(session)
        total_variants = len(all_variants)

        if total_variants == 0:
            logger.info("No variants need EPID backfill. Exiting.")
            return

        # Track statistics
        stats = {
            "total": total_variants,
            "updated": 0,
            "not_found": 0,  # No EPID found
            "errors": 0,  # API/validation errors
        }

        logger.info(f"Starting backfill for {total_variants} Pokemon card variants...")
        logger.info(f"Rate limit: {pacer.requests_per_second} requests per second")
        logger.info(
            f"Estimated time: {total_variants / pacer.requests_per_second / 3600:.1f} hours"
        )

        # Process variants with rate limiting
        variant_idx = 0
        async for _ in pacer.create_schedule(total_variants):
            if variant_idx >= len(all_variants):
                break

            variant = all_variants[variant_idx]
            variant_idx += 1

            # Build search input
            product_input = ProductSearchInput(
                clean_name=variant.product.clean_name,
                number=variant.product.number,
                set_code=variant.product.set.code,
                printing_name=variant.printing.name,
                language_name=variant.language.name,
            )

            try:
                epid = await resolver.resolve(product_input)

                if epid:
                    variant.ebay_product_id = epid
                    stats["updated"] += 1
                    logger.info(
                        f"✅ [{stats['updated']}/{total_variants}] {variant.product.set.name} - "
                        f"{variant.product.name} {variant.product.number} ({variant.printing.name}): EPID={epid}"
                    )

                    # Commit every 10 successful updates to avoid losing progress
                    if stats["updated"] % 10 == 0:
                        session.commit()
                        logger.info(f"💾 Committed {stats['updated']} updates")
                else:
                    stats["not_found"] += 1
                    logger.warning(
                        f"⚠️  [{variant_idx}/{total_variants}] {variant.product.name} "
                        f"{variant.product.number} ({variant.printing.name}): No EPID found"
                    )

            except Exception as e:
                # Handle rate limiting - terminate immediately on 429
                error_str = str(e).lower()
                if "429" in error_str or "rate limit" in error_str:
                    logger.error("=" * 80)
                    logger.error("🛑 RATE LIMIT HIT (429 error)")
                    logger.error(
                        f"Processed {variant_idx - 1} variants before rate limit"
                    )
                    logger.error(
                        "Terminating script. Run again later when quota resets."
                    )
                    logger.error("=" * 80)
                    break

                stats["errors"] += 1
                logger.error(
                    f"❌ [{variant_idx}/{total_variants}] {variant.product.name} "
                    f"{variant.product.number} ({variant.printing.name}): {e}",
                    exc_info=True,
                )

        # Final commit
        if stats["updated"] % 10 != 0:
            session.commit()
            logger.info(f"💾 Final commit: {stats['updated']} total updates")

        # Print summary
        logger.info("=" * 80)
        logger.info("BACKFILL SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Total variants processed: {stats['total']}")
        logger.info(
            f"✅ Updated with EPIDs: {stats['updated']} ({stats['updated'] / stats['total'] * 100:.1f}%)"
        )
        logger.info(
            f"⚠️  No EPID found: {stats['not_found']} ({stats['not_found'] / stats['total'] * 100:.1f}%)"
        )
        logger.info(
            f"❌ Errors: {stats['errors']} ({stats['errors'] / stats['total'] * 100:.1f}%)"
        )
        logger.info("=" * 80)

    finally:
        await api_client.close()
        session.close()


if __name__ == "__main__":
    asyncio.run(backfill_product_variant_epid())
