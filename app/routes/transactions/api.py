import uuid
from typing import List, Tuple, Dict, Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import desc, select, func
from sqlalchemy.orm import Session
from decimal import Decimal

from app.routes.transactions.dao import (
    InsufficientInventoryError,
    create_transaction_line_items,
    delete_transaction_line_items,
    delete_transactions, TransactionNotFoundError,
    create_transaction_with_line_items,
    TransactionDataDict,
    LineItemDataDict
)
from app.routes.transactions.schemas import (
    TransactionResponseSchema,
    TransactionCreateRequestSchema,
    TransactionsResponseSchema,
    BulkTransactionDeleteRequestSchema,
    TransactionUpdateRequestSchema
)
from core.dao.skus import get_skus_by_id
from core.database import get_db_session
from core.models import TransactionType
from core.models.transaction import Transaction, LineItem, LineItemConsumption
from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService, get_tcgplayer_catalog_service

router = APIRouter(
    prefix="/transactions",
)

@router.get("/", response_model=TransactionsResponseSchema)
async def get_transactions(session: Session = Depends(get_db_session)):
    transactions = session.scalars(select(Transaction).order_by(desc(Transaction.date)).options(
        *TransactionResponseSchema.get_load_options()
    )).all()
    return TransactionsResponseSchema(transactions=transactions)


@router.get("/{transaction_id}", response_model=TransactionResponseSchema)
async def get_transaction(transaction_id: uuid.UUID, session: Session = Depends(get_db_session)):
    transaction = session.scalar(
        select(Transaction)
        .options(*TransactionResponseSchema.get_load_options())
        .where(Transaction.id == transaction_id)
    )

    return transaction


@router.post("/", response_model=TransactionResponseSchema)
async def create_transaction(
        request: TransactionCreateRequestSchema,
        catalog_service: TCGPlayerCatalogService = Depends(get_tcgplayer_catalog_service),
        session: Session = Depends(get_db_session),
):
    # Prepare transaction data - keep this in the API
    transaction_data: TransactionDataDict = {
        "date": request.date,
        "type": request.type,
        "counterparty_name": request.counterparty_name,
        "comment": request.comment,
        "currency": request.currency,
        "shipping_cost_amount": request.shipping_cost_amount,
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
        session.commit()
        
        # Reload transaction with the appropriate load options
        transaction = session.scalar(
            select(Transaction)
            .options(*TransactionResponseSchema.get_load_options())
            .where(Transaction.id == transaction.id)
        )
        
        return transaction
    except InsufficientInventoryError:
        raise HTTPException(status_code=400, detail="Not enough inventory to complete sale")


@router.post("/bulk", status_code=204)
async def bulk_delete_transactions(
    request: BulkTransactionDeleteRequestSchema,
    session: Session = Depends(get_db_session),
):
    try:
        delete_transactions(session, request.transaction_ids)
    except TransactionNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except InsufficientInventoryError as e:
        raise HTTPException(status_code=400, detail=str(e))

    session.commit()

@router.patch("/{transaction_id}", response_model=TransactionResponseSchema)
async def update_transaction(
    transaction_id: uuid.UUID,
    request: TransactionUpdateRequestSchema,
    session: Session = Depends(get_db_session),
):
    # First, retrieve the transaction
    transaction = session.get(Transaction, transaction_id)

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Check if there are changes to the date or line items
    date_changed = transaction.date != request.date
    
    # Check for line item changes (different quantities, prices, or set of line items)
    existing_line_items = {line_item.id: line_item for line_item in transaction.line_items}
    
    # Separate request line items with IDs from new ones (with id=None)
    request_line_items_with_ids = {item.id: item for item in request.line_items if item.id is not None}
    new_line_items = [item for item in request.line_items if item.id is None]
    
    # Check if line items have been added, removed, or if there are new ones
    line_items_ids_changed = (set(existing_line_items.keys()) != 
                             set(request_line_items_with_ids.keys()) or 
                             len(new_line_items) > 0)
    
    # Check if quantities or prices have changed for existing line items
    line_items_content_changed = False
    for item_id in set(existing_line_items.keys()) & set(request_line_items_with_ids.keys()):
        if (existing_line_items[item_id].quantity != request_line_items_with_ids[item_id].quantity or
            existing_line_items[item_id].unit_price_amount != request_line_items_with_ids[item_id].unit_price_amount):
            line_items_content_changed = True
            break
    
    line_items_changed = line_items_ids_changed or line_items_content_changed
    
    # Always update the basic transaction properties
    transaction.date = request.date
    transaction.counterparty_name = request.counterparty_name
    transaction.comment = request.comment
    transaction.currency = request.currency
    transaction.shipping_cost_amount = request.shipping_cost_amount

    session.flush()

    try:
        
        # If date or line items changed, update the line items
        if date_changed or line_items_changed:
            # Extract existing line item IDs
            existing_line_item_ids = list(existing_line_items.keys())
            
            # Delete existing line items using the appropriate function
            if existing_line_item_ids:
                delete_transaction_line_items(session, transaction.type, existing_line_item_ids)
            
            # Create new line items from the request
            line_items_data: list[LineItemDataDict] = []
            
            # Process existing line items with IDs
            for line_item in request.line_items:
                if line_item.id is not None:
                    # This is an existing line item being updated
                    line_items_data.append({
                        "sku_id": line_item.sku_id,
                        "quantity": line_item.quantity,
                        "unit_price_amount": line_item.unit_price_amount,
                        "id": line_item.id  # Pass the existing ID to reuse it
                    })
                else:
                    # This is a new line item
                    line_items_data.append({
                        "sku_id": line_item.sku_id,
                        "quantity": line_item.quantity,
                        "unit_price_amount": line_item.unit_price_amount
                        # No id provided for new items
                    })
            
            # Create the new line items associated with this transaction
            create_transaction_line_items(
                session, 
                transaction.id, 
                transaction.type, 
                line_items_data
            )
        
        session.commit()
        
    except InsufficientInventoryError:
        session.rollback()
        raise HTTPException(status_code=400, detail="Not enough inventory to complete the updated transaction")
    
    # Reload transaction with the appropriate load options
    transaction = session.scalar(
        select(Transaction)
        .options(*TransactionResponseSchema.get_load_options())
        .where(Transaction.id == transaction.id)
    )
        
    return transaction
