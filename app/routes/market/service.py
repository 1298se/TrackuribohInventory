from __future__ import annotations

import uuid

from app.routes.catalog.schemas import SKUWithProductResponseSchema
from app.routes.market.schemas import (
    TCGPlayerProductListingResponseSchema,
    EbayProductListingResponseSchema,
)
from core.models.catalog import SKU, ProductVariant
from core.models.price import Marketplace
from core.services.ebay_listing_service import (
    EbayListingService,
    EbayListingRequestData,
)
from core.services.schemas.marketplace import ListingLanguage, Printing
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload, joinedload
from core.services.sku_lookup import build_sku_tcg_id_lookup_from_skus
from core.services.tcgplayer_listing_service import (
    CardListingRequestData,
    TCGPlayerListingService,
)


async def get_tcgplayer_product_variant_listings(
    product_variant_id: uuid.UUID,
    session: Session,
    tcgplayer_listing_service: TCGPlayerListingService,
) -> list[TCGPlayerProductListingResponseSchema]:
    """Fetch and map TCGPlayer listings for a specific product variant."""

    product_variant = session.get(ProductVariant, product_variant_id)
    if product_variant is None:
        return []

    product = product_variant.product
    if product is None or product.tcgplayer_id is None:
        return []

    variant_skus = session.scalars(
        select(SKU)
        .where(SKU.variant_id == product_variant_id)
        .options(*SKUWithProductResponseSchema.get_load_options())
    ).all()

    if not variant_skus:
        return []

    request: CardListingRequestData = {
        "product_id": int(product.tcgplayer_id),
    }
    if product_variant.printing and product_variant.printing.name:
        request["printings"] = [product_variant.printing.name]

    listings = await tcgplayer_listing_service.get_product_active_listings(request)

    sku_by_tcg_id = build_sku_tcg_id_lookup_from_skus(variant_skus)

    results: list[TCGPlayerProductListingResponseSchema] = []
    for listing in listings:
        product_condition_id = listing.product_condition_id
        if product_condition_id is None:
            continue

        sku = sku_by_tcg_id.get(product_condition_id)
        if sku is None:
            continue

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


async def get_ebay_product_variant_listings(
    product_variant_id: uuid.UUID,
    session: Session,
    ebay_listing_service: EbayListingService,
) -> list[EbayProductListingResponseSchema]:
    """Fetch eBay listings for the product variant and map them to API response DTOs."""

    product_variant = session.get(ProductVariant, product_variant_id)
    if product_variant is None:
        return []

    product = product_variant.product
    if product is None:
        return []

    product_skus = session.scalars(
        select(SKU)
        .where(SKU.variant_id == product_variant_id)
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

    variant = product_variant
    if not variant.ebay_product_id:
        return []

    english_skus = [
        sku
        for sku in product_skus
        if sku.language and sku.language.name == ListingLanguage.ENGLISH.value
    ]
    if not english_skus:
        return []

    condition_name_to_sku = {sku.condition.name: sku for sku in english_skus}

    printing_enum: Printing | None = None
    if variant.printing and variant.printing.name:
        try:
            printing_enum = Printing(variant.printing.name)
        except ValueError:
            printing_enum = None

    request_data: EbayListingRequestData = {
        "epid": variant.ebay_product_id,
        "language": ListingLanguage.ENGLISH,
        "card_number": product.number,
    }
    if printing_enum:
        request_data["printing"] = printing_enum

    marketplace_listings = await ebay_listing_service.get_product_active_listings(
        request_data
    )

    results: list[EbayProductListingResponseSchema] = []

    for listing in marketplace_listings:
        condition_name = (
            listing.condition.value if listing.condition else "Not Specified"
        )
        if condition_name == "Not Specified":
            continue

        sku = condition_name_to_sku.get(condition_name)
        if sku is None:
            continue

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
