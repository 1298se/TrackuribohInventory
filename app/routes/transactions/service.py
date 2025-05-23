from typing import List, TypedDict

from sqlalchemy.orm import Session
from sqlalchemy import func, select

from core.dao.transaction import (
    LineItemData,
    InsufficientInventoryError,
    create_transaction_with_line_items,
    TransactionData,
)
from app.routes.transactions.schemas import TransactionCreateRequestSchema
from core.models.transaction import Transaction, TransactionType, LineItem
from core.services.create_transaction import calculate_weighted_unit_prices
from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService


class TransactionMetrics(TypedDict):
    """TypedDict representing aggregated transaction metrics."""

    total_revenue: float
    total_spent: float
    net_profit: float
    total_transactions: int
    currency: str


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


def get_transaction_metrics(session: Session) -> TransactionMetrics:
    """Calculate aggregate metrics for all transactions."""

    # Subquery to calculate line item totals per transaction
    line_items_total = (
        select(
            LineItem.transaction_id,
            func.sum(LineItem.quantity * LineItem.unit_price_amount).label(
                "line_items_total"
            ),
        )
        .group_by(LineItem.transaction_id)
        .subquery()
    )

    # Query for sales transactions with totals
    sales_query = (
        select(
            func.count(Transaction.id).label("count"),
            func.coalesce(
                func.sum(
                    line_items_total.c.line_items_total
                    + Transaction.tax_amount
                    - Transaction.shipping_cost_amount
                ),
                0,
            ).label("total"),
        )
        .join(line_items_total, Transaction.id == line_items_total.c.transaction_id)
        .where(Transaction.type == TransactionType.SALE)
    )

    # Query for purchase transactions with totals
    purchase_query = (
        select(
            func.count(Transaction.id).label("count"),
            func.coalesce(
                func.sum(
                    line_items_total.c.line_items_total
                    + Transaction.tax_amount
                    + Transaction.shipping_cost_amount
                ),
                0,
            ).label("total"),
        )
        .join(line_items_total, Transaction.id == line_items_total.c.transaction_id)
        .where(Transaction.type == TransactionType.PURCHASE)
    )

    # Execute queries
    sales_result = session.execute(sales_query).first()
    purchase_result = session.execute(purchase_query).first()

    # Extract values
    sales_count = sales_result.count if sales_result else 0
    sales_total = float(sales_result.total) if sales_result else 0.0

    purchase_count = purchase_result.count if purchase_result else 0
    purchase_total = float(purchase_result.total) if purchase_result else 0.0

    net_profit = sales_total - purchase_total
    total_transactions = sales_count + purchase_count

    return {
        "total_revenue": sales_total,
        "total_spent": purchase_total,
        "net_profit": net_profit,
        "total_transactions": total_transactions,
        "currency": "USD",
    }
