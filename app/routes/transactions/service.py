from typing import List, TypedDict, Optional
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import func, select, and_, case, Date

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
    user_id: UUID,
) -> Transaction:
    """
    Service function to create a transaction and its line items.

    Args:
        request: The transaction creation request
        catalog_service: The TCGPlayer catalog service for price information
        session: The database session
        user_id: The ID of the user creating the transaction

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
        user_id=user_id,
    )

    # Calculate line item prices using the helper function
    line_items_data: List[LineItemData] = await calculate_weighted_unit_prices(
        session=session,
        catalog_service=catalog_service,
        line_items=request.line_items,
        total_amount=request.total_amount,
        user_id=user_id,
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


def get_transaction_performance(session: Session, days: Optional[int] = 30) -> dict:
    """Get transaction analytics data for the specified time period."""

    # Calculate the date range
    end_date = date.today()

    if days is None:
        # For "All time", find the earliest transaction date
        earliest_date_result = session.execute(
            select(func.min(Transaction.date))
        ).scalar()

        if earliest_date_result is None:
            # No transactions exist, return empty data
            return {
                "data_points": [],
                "currency": "USD",
            }

        start_date = earliest_date_result.date()

        # Calculate days from start to end for granularity determination
        actual_days = (end_date - start_date).days
        granularity = "daily" if actual_days <= 30 else "weekly"
    else:
        start_date = end_date - timedelta(days=days)
        # Auto-determine granularity based on days
        # For periods <= 30 days, use daily; for longer periods, use weekly
        granularity = "daily" if days <= 30 else "weekly"

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

    if granularity == "weekly":
        # Weekly aggregation with proper date grouping
        # First, create a subquery with transaction totals
        transaction_totals = (
            select(
                Transaction.id,
                Transaction.date,
                Transaction.type,
                Transaction.tax_amount,
                Transaction.shipping_cost_amount,
                func.coalesce(line_items_total.c.line_items_total, 0).label(
                    "line_items_total"
                ),
            )
            .outerjoin(
                line_items_total, Transaction.id == line_items_total.c.transaction_id
            )
            .where(and_(Transaction.date >= start_date, Transaction.date <= end_date))
            .subquery()
        )

        # Main query with weekly grouping
        query = (
            select(
                func.extract("isoyear", transaction_totals.c.date).label("iso_year"),
                func.extract("week", transaction_totals.c.date).label("week_number"),
                func.cast(
                    func.date_trunc("week", transaction_totals.c.date), Date
                ).label("week_start_date"),
                func.sum(
                    case(
                        (
                            transaction_totals.c.type == TransactionType.SALE,
                            transaction_totals.c.line_items_total
                            + transaction_totals.c.tax_amount
                            - transaction_totals.c.shipping_cost_amount,
                        ),
                        else_=0,
                    )
                ).label("revenue"),
                func.sum(
                    case(
                        (
                            transaction_totals.c.type == TransactionType.PURCHASE,
                            transaction_totals.c.line_items_total
                            + transaction_totals.c.tax_amount
                            + transaction_totals.c.shipping_cost_amount,
                        ),
                        else_=0,
                    )
                ).label("expenses"),
                func.count(transaction_totals.c.id).label("transaction_count"),
            )
            .select_from(transaction_totals)
            .group_by(
                func.extract("isoyear", transaction_totals.c.date),
                func.extract("week", transaction_totals.c.date),
                func.cast(func.date_trunc("week", transaction_totals.c.date), Date),
            )
            .order_by("week_start_date")
        )
    else:
        # Daily aggregation
        transaction_totals = (
            select(
                Transaction.id,
                Transaction.date,
                Transaction.type,
                Transaction.tax_amount,
                Transaction.shipping_cost_amount,
                func.coalesce(line_items_total.c.line_items_total, 0).label(
                    "line_items_total"
                ),
            )
            .outerjoin(
                line_items_total, Transaction.id == line_items_total.c.transaction_id
            )
            .where(and_(Transaction.date >= start_date, Transaction.date <= end_date))
            .subquery()
        )

        query = (
            select(
                func.cast(
                    func.date_trunc("day", transaction_totals.c.date), Date
                ).label("period_date"),
                func.sum(
                    case(
                        (
                            transaction_totals.c.type == TransactionType.SALE,
                            transaction_totals.c.line_items_total
                            + transaction_totals.c.tax_amount
                            - transaction_totals.c.shipping_cost_amount,
                        ),
                        else_=0,
                    )
                ).label("revenue"),
                func.sum(
                    case(
                        (
                            transaction_totals.c.type == TransactionType.PURCHASE,
                            transaction_totals.c.line_items_total
                            + transaction_totals.c.tax_amount
                            + transaction_totals.c.shipping_cost_amount,
                        ),
                        else_=0,
                    )
                ).label("expenses"),
                func.count(transaction_totals.c.id).label("transaction_count"),
            )
            .select_from(transaction_totals)
            .group_by(
                func.cast(func.date_trunc("day", transaction_totals.c.date), Date)
            )
            .order_by(
                func.cast(func.date_trunc("day", transaction_totals.c.date), Date)
            )
        )

    # Execute the query
    results = session.execute(query).all()

    # Create a dictionary for quick lookup of existing data points
    existing_data = {}

    if granularity == "weekly":
        # For weekly data, we get iso_year, week_number, and week_start_date
        for result in results:
            revenue = float(result.revenue or 0)
            expenses = float(result.expenses or 0)
            existing_data[result.week_start_date] = {
                "date": result.week_start_date.isoformat(),
                "revenue": revenue,
                "expenses": expenses,
                "net_profit": revenue - expenses,
                "transaction_count": result.transaction_count,
            }
    else:
        # For daily data
        for result in results:
            revenue = float(result.revenue or 0)
            expenses = float(result.expenses or 0)
            existing_data[result.period_date] = {
                "date": result.period_date.isoformat(),
                "revenue": revenue,
                "expenses": expenses,
                "net_profit": revenue - expenses,
                "transaction_count": result.transaction_count,
            }

    # Generate complete time series with zeros for missing dates
    all_data_points = []
    current_date = start_date

    # For performance, limit filling to reasonable ranges
    date_range_days = (end_date - start_date).days
    should_fill_gaps = date_range_days <= 730  # Only fill gaps for up to 2 years

    if should_fill_gaps and existing_data:
        # Industry standard: "Right End Only" - find first actual transaction date
        if granularity == "weekly":
            first_data_date = min(existing_data.keys())
        else:
            first_data_date = min(existing_data.keys())

        # Start filling from the first actual data point, not the requested start date
        fill_start_date = max(start_date, first_data_date)
        current_date = fill_start_date

        # Fill all dates from first transaction to end date
        while current_date <= end_date:
            if granularity == "weekly":
                # For weekly, find the start of the current week (Monday)
                days_since_monday = current_date.weekday()
                week_start = current_date - timedelta(days=days_since_monday)

                # Only add this week if we haven't added it yet
                week_start_iso = week_start.isoformat()
                if not any(
                    point.get("date") == week_start_iso for point in all_data_points
                ):
                    if week_start in existing_data:
                        all_data_points.append(existing_data[week_start])
                    else:
                        all_data_points.append(
                            {
                                "date": week_start_iso,
                                "revenue": 0.0,
                                "expenses": 0.0,
                                "net_profit": 0.0,
                                "transaction_count": 0,
                            }
                        )

                # Move to next week
                current_date += timedelta(days=7)
            else:
                # Daily granularity
                if current_date in existing_data:
                    all_data_points.append(existing_data[current_date])
                else:
                    all_data_points.append(
                        {
                            "date": current_date.isoformat(),
                            "revenue": 0.0,
                            "expenses": 0.0,
                            "net_profit": 0.0,
                            "transaction_count": 0,
                        }
                    )

                # Move to next day
                current_date += timedelta(days=1)

        # Sort by date to ensure proper ordering
        all_data_points = sorted(all_data_points, key=lambda x: x["date"])
    else:
        # For very large ranges OR no existing data, just return actual data points
        all_data_points = []
        if granularity == "weekly":
            for result in results:
                revenue = float(result.revenue or 0)
                expenses = float(result.expenses or 0)
                all_data_points.append(
                    {
                        "date": result.week_start_date.isoformat(),
                        "revenue": revenue,
                        "expenses": expenses,
                        "net_profit": revenue - expenses,
                        "transaction_count": result.transaction_count,
                    }
                )
        else:
            for result in results:
                revenue = float(result.revenue or 0)
                expenses = float(result.expenses or 0)
                all_data_points.append(
                    {
                        "date": result.period_date.isoformat(),
                        "revenue": revenue,
                        "expenses": expenses,
                        "net_profit": revenue - expenses,
                        "transaction_count": result.transaction_count,
                    }
                )

    return {
        "data_points": all_data_points,
        "currency": "USD",
    }
