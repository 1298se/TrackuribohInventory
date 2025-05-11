from typing import List

from sqlalchemy.orm import Session

from core.dao.transaction import (
    create_transaction_with_line_items,
    TransactionData,
    LineItemData,
    InsufficientInventoryError,
)
from app.routes.transactions.schemas import TransactionCreateRequestSchema
from core.models.transaction import Transaction
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
    # Convert the request to the format expected by the DAO
    transaction_data: TransactionData = TransactionData(
        date=request.date,
        type=request.type,
        counterparty_name=request.counterparty_name,
        comment=request.comment or None,
        currency=request.currency,
        shipping_cost_amount=request.shipping_cost_amount,
        tax_amount=request.tax_amount,
        platform_id=request.platform_id,
        platform_order_id=request.platform_order_id,
    )

    # Calculate line item prices using the helper function
    line_items_data: List[LineItemData] = await calculate_weighted_unit_prices(
        session=session,
        catalog_service=catalog_service,
        line_items=request.line_items,
        total_amount=request.total_amount,
    )

    try:
        # Use the DAO function to create the transaction and line items
        transaction = create_transaction_with_line_items(
            session, transaction_data, line_items_data
        )

        # Return the created transaction
        return transaction
    except InsufficientInventoryError as e:
        # Re-raise the exception to be handled by the caller
        raise e
