#!/usr/bin/env python3
"""
Script to find missing PayPal sale transactions in the database.
"""

import os
import sys
import csv

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.database import SessionLocal
from core.models.transaction import Platform, Transaction, TransactionType


def find_missing_paypal_sales(csv_file_path):
    missing = []
    with open(csv_file_path, newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        fieldnames = reader.fieldnames or []
        rows = list(reader)
        print(f"Total rows read: {len(rows)}")

    with SessionLocal() as session:
        # Ensure Paypal platform exists
        platform = session.query(Platform).filter(Platform.name == "Paypal").first()
        if not platform:
            print("Error: 'Paypal' platform not found in database.")
            return

        for row in rows:
            txn_id = row.get("Transaction ID")
            if not txn_id:
                continue

            txn = (
                session.query(Transaction)
                .filter(
                    Transaction.platform_id == platform.id,
                    Transaction.platform_order_id == txn_id,
                    Transaction.type == TransactionType.SALE,
                )
                .first()
            )
            if not txn:
                missing.append(row)

    # Print missing rows as CSV
    if missing:
        writer = csv.DictWriter(sys.stdout, fieldnames=fieldnames)
        writer.writeheader()
        for row in missing:
            writer.writerow(row)

    print(f"Total missing transactions: {len(missing)}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Find missing PayPal sale transactions in database"
    )
    parser.add_argument(
        "csv_path",
        nargs="?",
        default="/Users/oliversong/Downloads/paypal_sales.csv",
        help="Path to PayPal sale CSV file",
    )
    args = parser.parse_args()
    find_missing_paypal_sales(args.csv_path)
