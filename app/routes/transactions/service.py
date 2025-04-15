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
from core.services.create_transaction import calculate_weighted_unit_prices
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

    # Calculate line item prices using the helper function
    line_items_data = await calculate_weighted_unit_prices(
        session=session,
        catalog_service=catalog_service,
        line_items=request.line_items,
        total_amount=request.total_amount
    )

    # Prepare line items for DAO - this stays in the service
    dao_line_items: list[LineItemDataDict] = [
        {
            "sku_id": item["sku_id"],
            "quantity": item["quantity"],
            "unit_price_amount": item["unit_price_amount"],
        }
        for item in line_items_data
    ]

    try:
        # Use the DAO function to create the transaction and line items
        transaction = create_transaction_with_line_items(session, transaction_data, dao_line_items)
    
        # Return the created transaction
        return transaction
    except InsufficientInventoryError as e:
        # Re-raise the exception to be handled by the caller
        raise e 