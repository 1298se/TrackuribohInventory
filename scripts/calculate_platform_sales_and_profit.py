#!/usr/bin/env python3
import argparse
from datetime import date
from sqlalchemy import select, func, distinct, cast, Date
from sqlalchemy.orm import aliased

from core.database import SessionLocal
from core.models.transaction import Platform, Transaction
from core.models.transaction import LineItem, LineItemConsumption


def calculate_sales_and_profit(platform_name: str, start_date: date, end_date: date):
    """
    Calculate and print total sales amount and total profit for the given platform and date range.
    """
    with SessionLocal() as session:
        # Retrieve platform ID by name
        platform_id = session.scalar(
            select(Platform.id).where(Platform.name == platform_name)
        )
        if platform_id is None:
            print(f"No platform found with name '{platform_name}'")
            return

        # Alias line items for sale and purchase sides
        SaleLineItem = aliased(LineItem)
        PurchaseLineItem = aliased(LineItem)

        # Build query to compute total sales and profit
        query = (
            select(
                func.count(distinct(SaleLineItem.transaction_id)).label("num_sales"),
                func.coalesce(
                    func.sum(
                        SaleLineItem.unit_price_amount * LineItemConsumption.quantity
                    ),
                    0,
                ).label("total_sales_amount"),
                func.coalesce(
                    func.sum(
                        PurchaseLineItem.unit_price_amount
                        * LineItemConsumption.quantity
                    ),
                    0,
                ).label("total_cost"),
                func.coalesce(
                    func.sum(
                        LineItemConsumption.quantity
                        * (
                            SaleLineItem.unit_price_amount
                            - PurchaseLineItem.unit_price_amount
                        )
                    ),
                    0,
                ).label("total_profit"),
            )
            .select_from(LineItemConsumption)
            .join(SaleLineItem, LineItemConsumption.sale_line_item)
            .join(PurchaseLineItem, LineItemConsumption.purchase_line_item)
            .join(Transaction, SaleLineItem.transaction)
            .where(
                Transaction.platform_id == platform_id,
                cast(Transaction.date, Date) >= start_date,
                cast(Transaction.date, Date) <= end_date,
            )
        )

        num_sales, total_sales_amount, total_cost, total_profit = session.execute(
            query
        ).first()

        print(f"Number of Sales: {num_sales}")
        print(f"Total Sales Amount: ${total_sales_amount:.2f}")
        print(f"Total Cost: ${total_cost:.2f}")
        print(f"Total Profit: ${total_profit:.2f}")

        # Print monthly sales amounts by month
        print("\nMonthly Sales Amounts:")
        monthly_query = (
            select(
                func.date_trunc("month", Transaction.date).label("month"),
                func.coalesce(
                    func.sum(
                        SaleLineItem.unit_price_amount * LineItemConsumption.quantity
                    ),
                    0,
                ).label("sales_amount"),
            )
            .select_from(LineItemConsumption)
            .join(SaleLineItem, LineItemConsumption.sale_line_item)
            .join(Transaction, SaleLineItem.transaction)
            .where(
                Transaction.platform_id == platform_id,
                cast(Transaction.date, Date) >= start_date,
                cast(Transaction.date, Date) <= end_date,
            )
            .group_by("month")
            .order_by("month")
        )
        monthly_results = session.execute(monthly_query).all()
        for month, sales_amount in monthly_results:
            print(f"{month.strftime('%Y-%m')}: ${sales_amount:.2f}")


def main():
    parser = argparse.ArgumentParser(
        description="Calculate total sales amount and profit for a given platform and date range."
    )
    parser.add_argument(
        "--platform",
        type=str,
        default="Paypal",
        help="Platform name (e.g. Paypal)",
    )
    parser.add_argument(
        "--start-date",
        type=lambda s: date.fromisoformat(s),
        default=date(2024, 1, 1),
        help="Start date in YYYY-MM-DD format",
    )
    parser.add_argument(
        "--end-date",
        type=lambda s: date.fromisoformat(s),
        default=date(2024, 12, 12),
        help="End date in YYYY-MM-DD format",
    )
    args = parser.parse_args()

    calculate_sales_and_profit(args.platform, args.start_date, args.end_date)


if __name__ == "__main__":
    main()
