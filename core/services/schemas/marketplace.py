"""Unified marketplace listing schema for cross-platform compatibility."""

from __future__ import annotations

from decimal import Decimal
from enum import Enum
from typing import Union

from pydantic import BaseModel, ConfigDict
from typing_extensions import Literal

from core.models.price import Marketplace


class MarketplaceCondition(str, Enum):
    """Standardized card conditions across marketplaces."""

    NEAR_MINT = "Near Mint"
    LIGHTLY_PLAYED = "Lightly Played"
    MODERATELY_PLAYED = "Moderately Played"
    HEAVILY_PLAYED = "Heavily Played"
    DAMAGED = "Damaged"
    NOT_SPECIFIED = "Not Specified"


class CardCondition(str, Enum):
    """Card condition values for marketplace API filters."""

    NEAR_MINT = "Near Mint"
    LIGHTLY_PLAYED = "Lightly Played"
    MODERATELY_PLAYED = "Moderately Played"
    HEAVILY_PLAYED = "Heavily Played"
    DAMAGED = "Damaged"


class ListingLanguage(str, Enum):
    """Supported listing languages for marketplace filters."""

    ENGLISH = "English"


class Printing(str, Enum):
    """Printing/finish options for marketplace listings."""

    FIRST_EDITION = "1st Edition"
    FIRST_EDITION_HOLOFOIL = "1st Edition Holofoil"
    HOLOFOIL = "Holofoil"
    REVERSE_HOLOFOIL = "Reverse Holofoil"
    UNLIMITED = "Unlimited"
    UNLIMITED_HOLOFOIL = "Unlimited Holofoil"
    NORMAL = "Normal"
    LIMITED = "Limited"


class MarketplaceListing(BaseModel):
    """Discriminated base model for marketplace listings."""

    model_config = ConfigDict(discriminator="marketplace")

    listing_id: str
    marketplace: Marketplace
    price: Decimal
    shipping_price: Decimal
    condition: MarketplaceCondition | None = None
    seller_name: str | None = None
    seller_rating: float | None = None
    quantity: int | None = None
    title: str | None = None


class TCGPlayerMarketplaceListing(MarketplaceListing):
    marketplace: Literal[Marketplace.TCGPLAYER]
    seller_id: str | None = None
    sku_identifier: str | None = None


class EbayMarketplaceListing(MarketplaceListing):
    marketplace: Literal[Marketplace.EBAY]
    image_url: str | None = None
    listing_url: str | None = None


MarketplaceListingUnion = Union[
    TCGPlayerMarketplaceListing,
    EbayMarketplaceListing,
]


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
