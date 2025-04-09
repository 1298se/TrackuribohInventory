#!/usr/bin/env python3
"""
Backfill script to recreate SALE transactions with shipping costs.

This script fetches all SALE-type transactions with shipping_cost_amount > 0,
deletes them, and recreates them using the improved logic in create_transaction_service.
The improved logic properly handles shipping costs based on transaction type:
- For SALE transactions: Shipping costs are kept separate and not included in unit prices
- For PURCHASE transactions: Shipping costs are distributed among items as part of their cost

This ensures that:
1. The total_amount computed field correctly reflects profit/expenditure
2. Inventory costs are properly calculated with shipping included for purchases
3. Sale prices don't incorrectly include shipping costs paid by the seller
"""

import asyncio
import logging
import traceback
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload, joinedload

from core.dao.transaction import delete_transactions
from app.routes.transactions.schemas import (
    TransactionCreateRequestSchema, 
    TransactionResponseSchema,
    LineItemCreateRequestSchema,
    SKUWithProductResponseSchema
)
from app.routes.transactions.service import create_transaction_service
from core.database import SessionLocal
from core.models import TransactionType
from core.models.transaction import Transaction, LineItem
from core.models.types import MoneyAmount
from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

async def get_transactions_to_recreate(session):
    """
    Get all SALE transactions with shipping_cost_amount > 0.
    """
    # Fetch the full transactions directly in a single query
    query = (
        select(Transaction)
        .options(
            selectinload(Transaction.line_items).options(
                joinedload(LineItem.sku).options(*SKUWithProductResponseSchema.get_load_options())
            )
        )
        .where(
            Transaction.type == TransactionType.SALE,
            Transaction.shipping_cost_amount > 0,
        )
    )
    
    # Execute the query
    result = session.execute(query)
    return list(result.scalars().all())

def create_transaction_request(transaction: Transaction) -> TransactionCreateRequestSchema:
    """
    Create a TransactionCreateRequestSchema from an existing Transaction.
    """
    # Create line item requests from existing line items
    line_items = [
        LineItemCreateRequestSchema(
            sku_id=line_item.sku_id,
            quantity=line_item.quantity
        )
        for line_item in transaction.line_items
    ]
    
    # Calculate subtotal from line items
    subtotal = sum(
        line_item.unit_price_amount * line_item.quantity 
        for line_item in transaction.line_items
    )
    
    # Create the transaction request
    return TransactionCreateRequestSchema(
        date=transaction.date,
        type=transaction.type,
        counterparty_name=transaction.counterparty_name,
        comment=transaction.comment,
        line_items=line_items,
        currency=transaction.currency,
        shipping_cost_amount=transaction.shipping_cost_amount,
        tax_amount=transaction.tax_amount,
        subtotal_amount=MoneyAmount(subtotal)
    )

async def process_single_transaction(transaction: Transaction, tcgplayer_service: TCGPlayerCatalogService, session):
    """
    Process a single transaction with individual session handling for better error isolation.
    """
    transaction_id = transaction.id
    
    try:
        # Create a request schema from the existing transaction
        request = create_transaction_request(transaction)
        
        # Log transaction details before deletion
        logger.info(f"Processing transaction {transaction_id} - Counterparty: {transaction.counterparty_name}")
        logger.info(f"  Shipping Cost: {transaction.shipping_cost_amount}, Line Items: {len(transaction.line_items)}")
        logger.info(f"  SKU IDs: {[line_item.sku_id for line_item in transaction.line_items]}")
        
        # Check for valid TCGPlayer IDs
        has_missing_tcgplayer_ids = any(
            line_item.sku is None or line_item.sku.tcgplayer_id is None 
            for line_item in transaction.line_items
        )
        
        if has_missing_tcgplayer_ids:
            logger.warning(f"  Transaction {transaction_id} has line items with missing TCGPlayer IDs")
        
        # Delete the transaction
        logger.info(f"  Deleting transaction {transaction_id}")
        delete_transactions(session, [transaction_id])
        
        # Create new transaction
        logger.info(f"  Recreating transaction {transaction_id}")
        new_transaction = await create_transaction_service(request, tcgplayer_service, session)
        
        # Log success
        logger.info(f"✓ Successfully recreated transaction. Old ID: {transaction_id}, New ID: {new_transaction.id}")

        session.commit()
        
        return True
    except Exception as e:
        logger.error(f"✗ Error processing transaction {transaction_id}: {type(e).__name__}: {e}")
        logger.error(f"  Traceback: {traceback.format_exc()}")
        return False

async def recreate_transactions(transactions: list[Transaction], tcgplayer_service: TCGPlayerCatalogService, session):
    """
    Delete and recreate the provided transactions one by one with individual session handling.
    """
    successful_count = 0
    failed_count = 0
    failed_ids = []
    
    for transaction in transactions:
        # Start a new transaction
        result = await process_single_transaction(transaction, tcgplayer_service, session)
        
        if result:
            successful_count += 1
        else:
            failed_count += 1
            failed_ids.append(str(transaction.id))
    
    # Log summary
    logger.info(f"Completed processing {len(transactions)} transactions:")
    logger.info(f"  - Successful: {successful_count}")
    logger.info(f"  - Failed: {failed_count}")
    
    if failed_ids:
        logger.info(f"Failed transaction IDs: {', '.join(failed_ids)}")

async def main():
    """
    Main entry point for the backfill script.
    """
    logger.info("Starting backfill to recreate SALE transactions with shipping costs")
    
    # Initialize services
    tcgplayer_service = TCGPlayerCatalogService()
    await tcgplayer_service.init()
    
    try:
        # Use context manager for session handling
        with SessionLocal() as session:
            # Get all SALE transactions with shipping costs
            transactions = await get_transactions_to_recreate(session)
            logger.info(f"Found {len(transactions)} SALE transactions with shipping costs")
            
            # Exit if no transactions to process
            if not transactions:
                logger.info("No transactions to process. Exiting.")
                return
            
            # Process transactions one by one
            await recreate_transactions(transactions, tcgplayer_service, session)
    finally:
        # Clean up resources
        await tcgplayer_service.close()
    
    logger.info("Backfill completed successfully")

if __name__ == "__main__":
    asyncio.run(main()) 