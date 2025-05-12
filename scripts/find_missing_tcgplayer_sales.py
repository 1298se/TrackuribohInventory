#!/usr/bin/env python3
"""
Script to find missing TCGPlayer sale orders in the database.
"""

import os
import sys
import json
from datetime import date
from decimal import Decimal

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.database import SessionLocal
from core.models.transaction import Platform, Transaction, TransactionType


def find_missing_sales(
    json_file_path, start_date=date(2024, 1, 1), end_date=date(2024, 12, 31)
):
    # Load orders from JSON file
    with open(json_file_path, "r") as f:
        orders = json.load(f)

    missing = []

    with SessionLocal() as session:
        # Ensure TCGPlayer platform exists
        platform = session.query(Platform).filter(Platform.name == "TCGPlayer").first()
        if not platform:
            print("Error: 'TCGPlayer' platform not found in database.")
            return
        for order in orders:
            # Only sale orders
            if order.get("orderType") != "sale":
                continue
            # Only TCG vendor
            if order.get("vendor") != "TCG":
                continue
            # Skip canceled orders
            if order.get("shippingStatus", "").lower() == "canceled":
                continue
            # Skip orders fully refunded (refund amount equals total price)
            refund_amount = Decimal(str(order.get("refundAmount", 0)))
            total_price = Decimal("0")
            for p in order.get("products", []):
                price = Decimal(str(p.get("price", 0)))
                quantity = p.get("quantity", 1)
                total_price += price * quantity
            if refund_amount >= total_price:
                continue
            # Parse order date
            try:
                order_date = date.fromisoformat(order.get("orderedAt", ""))
            except Exception:
                continue
            if order_date < start_date or order_date > end_date:
                continue
            # Use vendorId as platform_order_id
            platform_order_id = order.get("vendorId")
            # Check if matching transaction exists
            txn = (
                session.query(Transaction)
                .filter(
                    Transaction.platform_id == platform.id,
                    Transaction.platform_order_id == platform_order_id,
                    Transaction.type == TransactionType.SALE,
                )
                .first()
            )
            if not txn:
                missing.append(order)

    # Save missing orders to formatted JSON file
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    output_dir = os.path.join(project_root, ".tmp")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "missing_tcgplayer_sales_2024.json")
    with open(output_path, "w") as out_f:
        json.dump(missing, out_f, default=str, indent=2)
    print(f"Saved {len(missing)} missing sale orders to {output_path}")
    # Print the raw number of unmatched transactions
    print(f"Number of unmatched transactions: {len(missing)}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Find missing TCGPlayer sale orders in database"
    )
    parser.add_argument(
        "json_path",
        nargs="?",
        default="/Users/oliversong/Downloads/orderwand_2025-04-23.json",
        help="Path to orderwand JSON file",
    )
    args = parser.parse_args()
    find_missing_sales(args.json_path)
