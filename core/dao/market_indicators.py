"""
Data access layer for market indicator SKUs.

Provides functions to query SKUs that serve as market indicators based on
condition, language, and product type criteria.
"""

import uuid
from typing import List

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.models.catalog import Catalog, Condition, Language, Product, SKU, Set
from core.services.schemas.schema import ProductType


def get_market_indicator_sku_ids(session: Session) -> List[uuid.UUID]:
    """
    Get internal SKU IDs for market indicator SKUs.

    Market indicators include:
    - Cards: NM/LP condition, English language
    - Sealed products: Unopened condition

    Args:
        session: Active SQLAlchemy session

    Returns:
        List of internal SKU IDs
    """
    # Get condition and language UUIDs
    nm_condition_uuid = session.execute(
        select(Condition.id).where(Condition.abbreviation == "NM")
    ).scalar_one()

    lp_condition_uuid = session.execute(
        select(Condition.id).where(Condition.abbreviation == "LP")
    ).scalar_one()

    unopened_condition_uuid = session.execute(
        select(Condition.id).where(Condition.abbreviation == "U")
    ).scalar_one()

    english_language_uuid = session.execute(
        select(Language.id).where(Language.abbreviation == "EN")
    ).scalar_one()

    catalog_ids = session.execute(select(Catalog.id).distinct()).scalars().all()

    # Query card SKUs (NM/LP English)
    card_skus_stmt = (
        select(SKU.id, SKU.product_id)
        .join(Product, SKU.product_id == Product.id)
        .join(Set, Product.set_id == Set.id)
        .where(
            Product.product_type == ProductType.CARDS,
            Set.catalog_id.in_(catalog_ids),
            SKU.condition_id.in_([nm_condition_uuid, lp_condition_uuid]),
            SKU.language_id == english_language_uuid,
        )
    )

    # Query sealed product SKUs (Unopened)
    sealed_skus_stmt = (
        select(SKU.id, SKU.product_id)
        .join(Product, SKU.product_id == Product.id)
        .join(Set, Product.set_id == Set.id)
        .where(
            Product.product_type == ProductType.SEALED,
            Set.catalog_id.in_(catalog_ids),
            SKU.condition_id == unopened_condition_uuid,
        )
    )

    card_results = session.execute(card_skus_stmt).all()
    sealed_results = session.execute(sealed_skus_stmt).all()

    # Extract SKU IDs
    card_sku_ids = [row.id for row in card_results]
    sealed_sku_ids = [row.id for row in sealed_results]

    # Combine and deduplicate
    combined_sku_ids = list(set(card_sku_ids + sealed_sku_ids))

    return combined_sku_ids


def get_market_indicator_sku_tcgplayer_ids(session: Session) -> List[int]:
    """
    Get TCGPlayer external IDs for market indicator SKUs.

    This is a convenience wrapper for price snapshot tasks that need TCGPlayer IDs.

    Args:
        session: Active SQLAlchemy session

    Returns:
        List of TCGPlayer IDs
    """
    internal_sku_ids = get_market_indicator_sku_ids(session)

    if not internal_sku_ids:
        return []

    # Map internal IDs to TCGPlayer IDs
    tcgplayer_ids = (
        session.execute(
            select(SKU.tcgplayer_id).where(
                SKU.id.in_(internal_sku_ids), SKU.tcgplayer_id.isnot(None)
            )
        )
        .scalars()
        .all()
    )

    return list(tcgplayer_ids)
