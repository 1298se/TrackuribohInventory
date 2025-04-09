import uuid
from typing import List, Dict
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.dao.transaction import (
    create_transaction_with_line_items,
    TransactionDataDict,
    LineItemDataDict,
    InsufficientInventoryError
)
from app.routes.transactions.schemas import (
    TransactionCreateRequestSchema,
    TransactionResponseSchema
)
from core.dao.skus import get_skus_by_id
from core.models.transaction import Transaction, TransactionType
from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService

async def create_transaction_service(
    request: TransactionCreateRequestSchema,
    catalog_service: TCGPlayerCatalogService,
    session: Session,
) -> Transaction:
    """
    Service function to create a transaction and its line items.
    
    Args:
        request: The transaction creation request
        catalog_service: The TCGPlayer catalog service for price information
        session: The database session
        
    Returns:
        The created transaction with line items
        
    Raises:
        InsufficientInventoryError: If there is not enough inventory for a sale
    """
    # Prepare transaction data - keep this in the API
    transaction_data: TransactionDataDict = {
        "date": request.date,
        "type": request.type,
        "counterparty_name": request.counterparty_name,
        "comment": request.comment,
        "currency": request.currency,
        "shipping_cost_amount": request.shipping_cost_amount,
        "tax_amount": request.tax_amount,
        "platform_id": request.platform_id,
    }

    # Get SKU information for price calculation
    sku_id_to_tcgplayer_id = {
        sku.id: sku.tcgplayer_id
        for sku in get_skus_by_id(session, ids=[line_item.sku_id for line_item in request.line_items])
    }

    line_items_by_tcgplayer_id = {
        sku_id_to_tcgplayer_id[line_item.sku_id]: line_item
        for line_item in request.line_items
    }

    # Get prices from TCGPlayer API
    sku_prices = await catalog_service.get_sku_prices(
        [tcgplayer_id for tcgplayer_id in sku_id_to_tcgplayer_id.values()])

    # Separate items with and without market prices
    items_with_prices = []
    items_without_prices = []
    
    for sku_price in sku_prices.results:
        line_item = line_items_by_tcgplayer_id[sku_price.sku_id]
        if sku_price.lowest_listing_price_total is not None:
            items_with_prices.append((line_item, sku_price))
        else:
            items_without_prices.append(line_item)
    
    # Calculate market price for items that have prices
    priced_items_total = sum(
        [sku_price.lowest_listing_price_total * line_item.quantity 
         for line_item, sku_price in items_with_prices]
    )
    
    # Prepare line items data with calculated prices
    line_items_data: list[LineItemDataDict] = []
    
    # Calculate quantities
    total_priced_items_units = sum(line_item.quantity for line_item, _ in items_with_prices) if items_with_prices else 0
    total_unpriced_items_units = sum(line_item.quantity for line_item in items_without_prices) if items_without_prices else 0
    total_units = total_priced_items_units + total_unpriced_items_units
    
    # Create a mapping for priced items
    tcgplayer_id_to_lowest_price = {
        sku_price.sku_id: sku_price.lowest_listing_price_total
        for _, sku_price in items_with_prices
    }
    
    # Calculate pricing parameters - unified approach for all scenarios
    # Determine allocation based on proportion of items with market prices
    priced_allocation = total_priced_items_units / total_units
    
    # Calculate amounts for priced and unpriced items
    amount_for_priced_items = request.total_amount * Decimal(priced_allocation)
    amount_for_unpriced_items = request.total_amount - amount_for_priced_items
    
    # Calculate pricing parameters
    ratio_for_priced_items = amount_for_priced_items / priced_items_total if priced_items_total > 0 else 0
    unpriced_unit_price = amount_for_unpriced_items / total_unpriced_items_units if total_unpriced_items_units > 0 else 0

    # Create line items using a single approach
    for line_item, sku_price in items_with_prices:
        line_items_data.append({
            "sku_id": line_item.sku_id,
            "quantity": line_item.quantity,
            "unit_price_amount": tcgplayer_id_to_lowest_price[sku_id_to_tcgplayer_id[line_item.sku_id]] * ratio_for_priced_items,
        })
    
    for line_item in items_without_prices:
        line_items_data.append({
            "sku_id": line_item.sku_id,
            "quantity": line_item.quantity,
            "unit_price_amount": unpriced_unit_price,
        })

    try:
        # Use the DAO function to create the transaction and line items
        transaction = create_transaction_with_line_items(session, transaction_data, line_items_data)
    
        # Return the created transaction
        return transaction
    except InsufficientInventoryError as e:
        # Re-raise the exception to be handled by the caller
        raise e 