import argparse
from decimal import Decimal

from core.database import SessionLocal
from app.routes.transactions.dao import get_total_sales_profit


def calculate_profit(show_only_totals=False):
    """Calculate the total profit from all sales by analyzing LineItemConsumption records."""
    with SessionLocal() as session, session.begin():
        # Use the DAO function to get total sales and profit
        num_sales, total_profit = get_total_sales_profit(session)
        
        # Print only the requested information
        print(f"Total Sales: {num_sales}")
        print(f"Total Profit: ${total_profit:.2f}")


def main():
    parser = argparse.ArgumentParser(description="Calculate total profit from all sales.")
    parser.add_argument("--detailed", action="store_true", help="Show detailed breakdown by product")
    
    args = parser.parse_args()
    
    calculate_profit(show_only_totals=True)


if __name__ == "__main__":
    main() 