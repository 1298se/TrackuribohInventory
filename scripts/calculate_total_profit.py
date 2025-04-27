import argparse

from core.database import SessionLocal
from core.dao.transaction import build_total_sales_profit_query


def calculate_profit(show_only_totals=False):
    """Calculate the total profit from all sales by analyzing LineItemConsumption records."""
    with SessionLocal() as session, session.begin():
        # Build and execute the profit query with the DAO builder
        result = session.execute(build_total_sales_profit_query()).first()
        num_sales, total_profit = result

        # Print only the requested information
        print(f"Total Sales: {num_sales}")
        print(f"Total Profit: ${total_profit:.2f}")


def main():
    parser = argparse.ArgumentParser(
        description="Calculate total profit from all sales."
    )
    parser.add_argument(
        "--detailed", action="store_true", help="Show detailed breakdown by product"
    )

    parser.parse_args()

    calculate_profit(show_only_totals=True)


if __name__ == "__main__":
    main()
