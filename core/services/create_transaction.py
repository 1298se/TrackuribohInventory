from dataclasses import dataclass
import uuid
from typing import List
from decimal import Decimal

from sqlalchemy.orm import Session

# Import the API schema for the entry point function for now
# Import core DAO types
from core.dao.transaction import (
    LineItemDataDict
)
from core.dao.skus import get_skus_by_id
from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService
# Import the new core schema type

@dataclass
class LineItemInput:
    sku_id: uuid.UUID
    quantity: int

async def calculate_weighted_unit_prices(
    session: Session,
    catalog_service: TCGPlayerCatalogService,
    line_items: List[LineItemInput],
    total_amount: Decimal,
) -> list[LineItemDataDict]:
    """Calculate unit prices by distributing total_amount based on market price weighting."""
    # Get SKU information for price calculation
    sku_id_to_tcgplayer_id = {
        sku.id: sku.tcgplayer_id
        for sku in get_skus_by_id(session, ids=[item.sku_id for item in line_items])
    }

    line_items_by_tcgplayer_id = {
        sku_id_to_tcgplayer_id[item.sku_id]: item
        for item in line_items
    }

    # Get prices from TCGPlayer API
    sku_prices = await catalog_service.get_sku_prices(
        [tcgplayer_id for tcgplayer_id in sku_id_to_tcgplayer_id.values()])

    # Separate items with and without market prices
    items_with_prices = []
    items_without_prices = []


    for sku_price in sku_prices.results:
        # Find the original LineItemInput object corresponding to this TCGPlayer SKU ID
        input_item = line_items_by_tcgplayer_id.get(sku_price.sku_id) # This uses the mapping we already had

        if sku_price.lowest_listing_price_total is not None:
            items_with_prices.append((input_item, sku_price))
        else:
            items_without_prices.append(input_item)
        # else: handle case where SKU price is returned for an ID not in our input? Log warning?

    # Calculate market price for items that have prices
    priced_items_total = sum(
        [sku_price.lowest_listing_price_total * item.quantity
         for item, sku_price in items_with_prices]
    )

    # Prepare line items data with calculated prices
    line_items_data: list[LineItemDataDict] = []

    # Calculate quantities
    total_priced_items_units = sum(item.quantity for item, _ in items_with_prices) if items_with_prices else 0
    total_unpriced_items_units = sum(item.quantity for item in items_without_prices) if items_without_prices else 0
    total_units = total_priced_items_units + total_unpriced_items_units

    # Create a mapping for priced items TCGPlayer ID to price
    tcgplayer_id_to_lowest_price = {
        sku_price.sku_id: sku_price.lowest_listing_price_total
        for _, sku_price in items_with_prices
    }

    # Calculate pricing parameters - unified approach for all scenarios
    # Determine allocation based on proportion of items with market prices
    # Avoid division by zero if total_units is 0
    priced_allocation = (total_priced_items_units / total_units) if total_units > 0 else Decimal(0)

    # Calculate amounts for priced and unpriced items
    amount_for_priced_items = total_amount * Decimal(priced_allocation)
    amount_for_unpriced_items = total_amount - amount_for_priced_items

    # Calculate pricing parameters
    ratio_for_priced_items = amount_for_priced_items / priced_items_total if priced_items_total > 0 else Decimal(0)
    unpriced_unit_price = amount_for_unpriced_items / total_unpriced_items_units if total_unpriced_items_units > 0 else Decimal(0)

    # Create line items using a single approach
    for item, sku_price in items_with_prices:
        tcgplayer_id = sku_id_to_tcgplayer_id.get(item.sku_id)

        line_items_data.append({
            "sku_id": item.sku_id,
            "quantity": item.quantity,
            "unit_price_amount": tcgplayer_id_to_lowest_price.get(tcgplayer_id, Decimal(0)) * ratio_for_priced_items,
        })

    for item in items_without_prices:
        line_items_data.append({
            "sku_id": item.sku_id,
            "quantity": item.quantity,
            "unit_price_amount": unpriced_unit_price,
        })
        
    return line_items_data