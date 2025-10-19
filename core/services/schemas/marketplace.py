"""Unified marketplace listing schema for cross-platform compatibility."""

from __future__ import annotations

from decimal import Decimal
from enum import Enum
from pydantic import BaseModel

from core.models.price import Marketplace


class MarketplaceCondition(str, Enum):
    """Standardized card conditions across marketplaces."""

    NEAR_MINT = "Near Mint"
    LIGHTLY_PLAYED = "Lightly Played"
    MODERATELY_PLAYED = "Moderately Played"
    HEAVILY_PLAYED = "Heavily Played"
    DAMAGED = "Damaged"
    NOT_SPECIFIED = "Not Specified"


class CardConditionFilter(str, Enum):
    """Card condition filter values for API requests.

    Use this enum when filtering listings by condition in service requests.
    """

    NEAR_MINT = "Near Mint"
    LIGHTLY_PLAYED = "Lightly Played"
    MODERATELY_PLAYED = "Moderately Played"
    HEAVILY_PLAYED = "Heavily Played"
    DAMAGED = "Damaged"


class MarketplaceListing(BaseModel):
    """Unified listing schema for all marketplaces.

    This schema provides a consistent interface for working with listings
    from different marketplaces (TCGPlayer, eBay, etc.), normalizing
    key fields like condition while preserving marketplace-specific data.
    """

    # Identity
    listing_id: str  # Unique within marketplace
    marketplace: Marketplace

    # Pricing
    price: Decimal
    shipping_price: Decimal
    condition: MarketplaceCondition | None = None
    seller_name: str | None = None
    quantity: int | None
    title: str | None = None


def normalize_condition(
    marketplace_value: str | None,
) -> MarketplaceCondition:
    """Normalize marketplace-specific condition strings to unified enum.

    Args:
        marketplace_value: Condition string from marketplace API

    Returns:
        Normalized MarketplaceCondition enum value

    Examples:
        >>> normalize_condition("Near Mint")
        MarketplaceCondition.NEAR_MINT

        >>> normalize_condition("Near Mint or Better")  # eBay variant
        MarketplaceCondition.NEAR_MINT

        >>> normalize_condition("Lightly Played (Excellent)")  # eBay variant
        MarketplaceCondition.LIGHTLY_PLAYED

        >>> normalize_condition(None)
        MarketplaceCondition.NOT_SPECIFIED
    """
    if not marketplace_value:
        return MarketplaceCondition.NOT_SPECIFIED

    # Normalize to lowercase for case-insensitive matching
    value_lower = marketplace_value.lower().strip()

    # Near Mint variants
    if "near mint" in value_lower or value_lower == "nm":
        return MarketplaceCondition.NEAR_MINT

    # Lightly Played variants
    if (
        "lightly played" in value_lower
        or "excellent" in value_lower
        or value_lower == "lp"
    ):
        return MarketplaceCondition.LIGHTLY_PLAYED

    # Moderately Played variants
    if (
        "moderately played" in value_lower
        or "good" in value_lower
        or value_lower == "mp"
    ):
        return MarketplaceCondition.MODERATELY_PLAYED

    # Heavily Played variants
    if "heavily played" in value_lower or "poor" in value_lower or value_lower == "hp":
        return MarketplaceCondition.HEAVILY_PLAYED

    # Damaged
    if "damaged" in value_lower or value_lower == "dmg":
        return MarketplaceCondition.DAMAGED

    # Default to NOT_SPECIFIED for unknown values
    return MarketplaceCondition.NOT_SPECIFIED
