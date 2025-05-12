#!/usr/bin/env python3
"""
Script to calculate total, short-term, and long-term capital gains profits
for sales on TCGPlayer and Paypal platforms.
"""

from sqlalchemy.orm import aliased
from core.database import SessionLocal
from core.models.transaction import Platform, Transaction, TransactionType
from core.models.transaction import LineItem, LineItemConsumption
from datetime import date
from sqlalchemy import cast, Date


def calculate_capital_gains():
    with SessionLocal() as session:
        platforms = session.query(Platform).all()
        if not platforms:
            print("No platforms found in database.")
            return
        for platform in platforms:
            platform_name = platform.name
            platform_id = platform.id

            # Prepare aliases
            SaleLI = aliased(LineItem)
            PurchaseLI = aliased(LineItem)
            SaleTxn = aliased(Transaction)
            PurchaseTxn = aliased(Transaction)

            # Query consumption records for sale transactions on this platform within 2024
            rows = (
                session.query(
                    SaleTxn.date.label("sale_date"),
                    PurchaseTxn.date.label("purchase_date"),
                    SaleLI.unit_price_amount.label("sale_price"),
                    PurchaseLI.unit_price_amount.label("purchase_price"),
                    LineItemConsumption.quantity,
                )
                .select_from(LineItemConsumption)
                .join(SaleLI, LineItemConsumption.sale_line_item)
                .join(PurchaseLI, LineItemConsumption.purchase_line_item)
                .join(SaleTxn, SaleLI.transaction)
                .join(PurchaseTxn, PurchaseLI.transaction)
                .filter(
                    SaleTxn.platform_id == platform_id,
                    SaleTxn.type == TransactionType.SALE,
                    cast(SaleTxn.date, Date) >= date(2024, 1, 1),
                    cast(SaleTxn.date, Date) <= date(2024, 12, 31),
                )
                .all()
            )

            total_profit = 0
            short_term_profit = 0
            long_term_profit = 0

            for sale_date, purchase_date, sale_price, purchase_price, qty in rows:
                profit = (sale_price - purchase_price) * qty
                total_profit += profit
                days_held = (sale_date - purchase_date).days
                if days_held > 365:
                    long_term_profit += profit
                else:
                    short_term_profit += profit

            # Print results per platform
            print(f"\nPlatform: {platform_name}")
            print(f"Total Profit: {total_profit:.2f}")
            print(f"Short-term Capital Gains Profit: {short_term_profit:.2f}")
            print(f"Long-term Capital Gains Profit: {long_term_profit:.2f}")


def main():
    calculate_capital_gains()


if __name__ == "__main__":
    main()
