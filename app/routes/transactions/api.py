import uuid
from typing import List, Tuple, Dict, Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import desc, select, func, or_, exists, select as subquery_select, and_
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
    TransactionUpdateRequestSchema,
    PlatformResponseSchema,
    PlatformCreateRequestSchema
)
from app.routes.transactions.service import create_transaction_service
from core.dao.skus import get_skus_by_id
from core.database import get_db_session
from core.models import TransactionType
from core.models.transaction import Transaction, LineItem, LineItemConsumption, Platform
from core.models.catalog import SKU, Product
from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService, get_tcgplayer_catalog_service

router = APIRouter(
    prefix="/transactions",
)

@router.get("/platforms", response_model=list[PlatformResponseSchema])
async def get_platforms(session: Session = Depends(get_db_session)):
    """Get all available platforms."""
    platforms = session.query(Platform).all()
    return platforms

@router.post("/platforms", response_model=PlatformResponseSchema, status_code=201)
async def create_platform(
    request: PlatformCreateRequestSchema,
    session: Session = Depends(get_db_session)
):
    """Create a new platform."""
    platform = Platform(name=request.name)
    session.add(platform)
    session.commit()
    session.refresh(platform)
    return platform

@router.get("/", response_model=TransactionsResponseSchema)
async def get_transactions(
    query: str = None,
    session: Session = Depends(get_db_session)
):
    # Step 1: Apply filters and sorting to get a list of matching transaction IDs
    base_id_query = (
        select(Transaction.id)  # Include date in the SELECT list
        .outerjoin(Transaction.line_items)
        .outerjoin(LineItem.sku)
        .outerjoin(SKU.product)
    )
    
    # Only apply the filter if query is provided
    if query:
        # Split the search query into terms
        search_terms = query.split()
        
        if search_terms:
            # Define text search vectors with weights for different columns
            counterparty_ts_vector = func.setweight(
                func.to_tsvector('english', func.coalesce(Transaction.counterparty_name, '')), 
                'A'
            )
            product_ts_vector = func.setweight(
                func.to_tsvector('english', func.coalesce(Product.name, '')),
                'B'
            )
            
            # Combine the vectors
            combined_ts_vector = counterparty_ts_vector.op('||')(product_ts_vector)
            
            # Create TS query with prefix matching support
            prefix_terms = [term + ":*" for term in search_terms]
            ts_query = func.to_tsquery('english', ' & '.join(prefix_terms))
            
            # Add text search condition to the query
            base_id_query = base_id_query.where(combined_ts_vector.op('@@')(ts_query))
            
            # Calculate rank for sorting
            combined_rank = func.ts_rank(combined_ts_vector, ts_query)
            
            # Add ranking as first ordering criterion, followed by date
            base_id_query = base_id_query.order_by(combined_rank.desc(), desc(Transaction.date))
        else:
            # If query is provided but empty, just order by date
            base_id_query = base_id_query.order_by(desc(Transaction.date))
    else:
        # If no query is provided, just order by date
        base_id_query = base_id_query.order_by(desc(Transaction.date))
    
    # Execute the first query to get just the IDs
    result = session.execute(base_id_query).all()
    transaction_ids = [row[0] for row in result]  # Extract just the IDs from the result tuples
    
    # Step 2: If we have matching IDs, query for full transaction data with load options
    if not transaction_ids:
        # Return empty result if no matches
        return TransactionsResponseSchema(transactions=[])
    
    # Query for full transaction data with the matched IDs
    transactions_query = (
        select(Transaction)
        .where(Transaction.id.in_(transaction_ids))
        .options(*TransactionResponseSchema.get_load_options())
    )
    
    # Execute the second query to get the full data
    transactions = session.scalars(transactions_query).all()

    # Sort transactions by the position of their id in transaction_ids
    transactions.sort(key=lambda transaction: transaction_ids.index(transaction.id))
    
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
    try:
        # Use the service function to create the transaction
        transaction = await create_transaction_service(request, catalog_service, session)
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
    transaction.platform_id = request.platform_id
    transaction.shipping_cost_amount = request.shipping_cost_amount
    transaction.tax_amount = request.tax_amount

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

