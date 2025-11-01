from __future__ import annotations

import asyncio
import uuid

from app.routes.catalog.schemas import SKUWithProductResponseSchema
from app.routes.market.schemas import (
    TCGPlayerProductListingResponseSchema,
    EbayProductListingResponseSchema,
)
from core.models.catalog import Product, SKU, ProductVariant
from core.models.price import Marketplace
from core.services.ebay_listing_service import (
    EbayListingService,
    EbayListingRequestData,
)
from core.services.schemas.marketplace import ListingLanguage, Printing
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload, joinedload
from core.services.sku_lookup import (
    build_sku_tcg_id_lookup_from_skus,
    build_sku_variant_condition_lookup,
)
from core.services.tcgplayer_listing_service import (
    CardListingRequestData,
    TCGPlayerListingService,
)


async def get_tcgplayer_product_listings(
    product_id: uuid.UUID,
    session: Session,
    tcgplayer_listing_service: TCGPlayerListingService,
) -> list[TCGPlayerProductListingResponseSchema]:
    """Fetch and map TCGPlayer listings to API response DTOs."""

    product = session.get(Product, product_id)
    if product is None or product.tcgplayer_id is None:
        return []

    product_skus = session.scalars(
        select(SKU)
        .where(SKU.product_id == product_id)
        .options(*SKUWithProductResponseSchema.get_load_options())
    ).all()

    if not product_skus:
        return []

    request = CardListingRequestData(product_id=int(product.tcgplayer_id))
    listings = await tcgplayer_listing_service.get_product_active_listings(request)

    sku_by_tcg_id = build_sku_tcg_id_lookup_from_skus(product_skus)

    results: list[TCGPlayerProductListingResponseSchema] = []
    for listing in listings:
        product_condition_id = listing.product_condition_id
        if product_condition_id is None:
            continue

        sku = sku_by_tcg_id.get(product_condition_id)
        if sku is None:
            continue

        # Generate TCGPlayer listing URL
        tcgplayer_url = sku.product.tcgplayer_url
        if not tcgplayer_url.startswith("http://") and not tcgplayer_url.startswith(
            "https://"
        ):
            tcgplayer_url = f"https://{tcgplayer_url}"

        seller_id = listing.seller_id or str(listing.listing_id)
        listing_url = f"{tcgplayer_url}?seller={seller_id}&page=1&Language=English"

        results.append(
            TCGPlayerProductListingResponseSchema(
                listing_id=str(listing.listing_id),
                marketplace=Marketplace.TCGPLAYER,
                sku=SKUWithProductResponseSchema.model_validate(sku),
                price=listing.price,
                quantity=listing.quantity,
                shipping_price=listing.shipping_price,
                condition=sku.condition.name,
                seller_name=listing.seller_name,
                seller_id=listing.seller_id,
                seller_rating=listing.seller_rating,
                listing_url=listing_url,
            )
        )

    return results


async def get_ebay_product_listings(
    product_id: uuid.UUID,
    session: Session,
    ebay_listing_service: EbayListingService,
) -> list[EbayProductListingResponseSchema]:
    """Fetch eBay listings for the product and map them to API response DTOs."""

    product = session.get(Product, product_id)
    if product is None:
        return []

    product_skus = session.scalars(
        select(SKU)
        .where(SKU.product_id == product_id)
        .options(
            *SKUWithProductResponseSchema.get_load_options(),
            joinedload(SKU.language),
            selectinload(SKU.variant).options(
                joinedload(ProductVariant.printing),
            ),
        )
    ).all()

    if not product_skus:
        return []

    variant_epids: dict[tuple[uuid.UUID, uuid.UUID], dict[str, str | None]] = {}
    condition_name_to_id: dict[str, uuid.UUID] = {}

    for sku in product_skus:
        condition_name_to_id.setdefault(sku.condition.name, sku.condition_id)
        variant = sku.variant
        if variant and variant.ebay_product_id:
            variant_epids.setdefault(
                (variant.printing_id, sku.language_id),
                {
                    "epid": variant.ebay_product_id,
                    "printing": variant.printing.name,
                    "language": sku.language.name,
                },
            )

    if not variant_epids:
        return []

    fetch_tasks = {}
    for key, metadata in variant_epids.items():
        epid = metadata["epid"]
        printing_name = metadata.get("printing")
        language_name = metadata.get("language")

        language_enum = ListingLanguage(language_name or ListingLanguage.ENGLISH.value)
        printing_enum: Printing | None = (
            Printing(printing_name) if printing_name else None
        )

        request_data = EbayListingRequestData(
            epid=epid,
            language=language_enum,
            printing=printing_enum,
            card_number=product.number,
        )

        fetch_tasks[key] = asyncio.create_task(
            ebay_listing_service.get_product_active_listings(request_data)
        )

    variant_items = list(fetch_tasks.items())
    fetch_results = await asyncio.gather(*[task for _, task in variant_items])

    sku_lookup = build_sku_variant_condition_lookup(product_skus)
    results: list[EbayProductListingResponseSchema] = []

    for (variant_key, _), marketplace_listings in zip(variant_items, fetch_results):
        printing_id, language_id = variant_key

        for listing in marketplace_listings:
            condition_name = (
                listing.condition.value if listing.condition else "Not Specified"
            )

            if condition_name == "Not Specified":
                # TODO: record metric for ambiguous listings
                continue

            condition_id = condition_name_to_id.get(condition_name)
            if not condition_id:
                # Unknown condition for this product; skip but log in metrics
                continue

            sku = sku_lookup.get((printing_id, language_id, condition_id))
            if sku is None:
                continue

            # Ensure listing_url is available, fallback to empty string if not
            ebay_listing_url = listing.listing_url or ""

            results.append(
                EbayProductListingResponseSchema(
                    listing_id=listing.listing_id,
                    marketplace=Marketplace.EBAY,
                    sku=SKUWithProductResponseSchema.model_validate(sku),
                    price=listing.price,
                    quantity=listing.quantity or 1,
                    shipping_price=listing.shipping_price,
                    condition=condition_name,
                    seller_name=listing.seller_name,
                    seller_rating=listing.seller_rating,
                    image_url=listing.image_url,
                    listing_url=ebay_listing_url,
                )
            )

    return results
