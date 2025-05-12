#!/usr/bin/env python3
import asyncio

from core.database import SessionLocal
from core.models.transaction import (
    LineItem,
    LineItemConsumption,
    TransactionType,
    Transaction,
)
from core.dao.transaction import process_sale_line_items, InsufficientInventoryError
from app.routes.transactions.schemas import TransactionCreateRequestSchema
from scripts.common.order_utils import parse_sales_order

# Define the sale object below. Modify this dict to process a different sale.
SALE_OBJ = {
    "account": "Sky Pillar Trading",
    "feeAmount": 0.52,
    "orderedAt": "2024-09-10",
    "orderType": "sale",
    "refundAmount": 0,
    "shippingAmount": 1.27,
    "shippingStatus": "unknown",
    "taxAmount": 0.34,
    "vendor": "TCG",
    "vendorId": "804606EF-C131AC-B8C89",
    "products": [
        {
            "condition": "near mint",
            "finish": "1st edition",
            "itemIndex": 1,
            "name": "Atlantean Dragoons",
            "price": 2.25,
            "currency": "USD",
            "productLine": "Yugioh",
            "productType": "unknown",
            "quantity": 1,
            "party": "Malique Bonilla",
            "setName": "Structure Deck: Realm of the Sea Emperor",
            "url": "https://store.tcgplayer.com/productCatalog/product/productSearch/67120",
            "vendorId": "67120",
            "setCode": "",
        }
    ],
}


async def main():
    with SessionLocal() as session:
        # 1) Create the new sale transaction and its line items (no initial consumption)
        # Use shared parser to convert the new-schema literal into request kwargs and get line items with prices
        sale_kwargs, line_items_data = parse_sales_order(session, SALE_OBJ)
        sale_request = TransactionCreateRequestSchema(**sale_kwargs)
        # Insert Transaction
        new_tx = Transaction(
            date=sale_request.date,
            type=sale_request.type,
            counterparty_name=sale_request.counterparty_name,
            comment=sale_request.comment,
            currency=sale_request.currency,
            shipping_cost_amount=sale_request.shipping_cost_amount,
            tax_amount=sale_request.tax_amount,
            platform_id=sale_request.platform_id,
            platform_order_id=sale_request.platform_order_id,
        )
        session.add(new_tx)
        session.flush()
        # 2) Per-SKU insertion and rebalance (using parsed line_items_data with unit prices)
        from collections import defaultdict

        # Group new line items by SKU
        sku_to_data: dict = defaultdict(list)
        for li_data in line_items_data:
            sku_to_data[li_data.sku_id].append(li_data)

        for sku_id, group in sku_to_data.items():
            # Insert new sale line items for this SKU
            new_sku_line_items = []
            for li_data in group:
                li = LineItem(
                    transaction_id=new_tx.id,
                    sku_id=li_data.sku_id,
                    quantity=li_data.quantity,
                    unit_price_amount=li_data.unit_price_amount,
                    remaining_quantity=None,
                )
                new_sku_line_items.append(li)
            session.add_all(new_sku_line_items)
            session.flush()

            # Fetch all sale line items for this SKU in chronological order
            sale_lis = (
                session.query(LineItem)
                .join(Transaction)
                .filter(
                    Transaction.type == TransactionType.SALE,
                    LineItem.sku_id == sku_id,
                )
                .order_by(Transaction.date)
                .all()
            )
            # Remove existing consumptions for this SKU and restore purchase quantities
            sale_ids = [li.id for li in sale_lis]
            consumptions = (
                session.query(LineItemConsumption)
                .filter(LineItemConsumption.sale_line_item_id.in_(sale_ids))
                .all()
            )
            for c in consumptions:
                purchase_li = session.get(LineItem, c.purchase_line_item_id)
                if purchase_li.remaining_quantity is not None:
                    purchase_li.remaining_quantity += c.quantity
                else:
                    purchase_li.remaining_quantity = c.quantity
                session.delete(c)
            session.flush()

            # Re-apply FIFO consumption for this SKU
            try:
                process_sale_line_items(session, sale_lis)
            except InsufficientInventoryError:
                session.rollback()
                print(
                    f"Insufficient inventory for SKU {sku_id}; aborting sale and rolling back."
                )
                return

        # Commit final state after processing all SKUs
        session.commit()
        print(
            f"Sale transaction {new_tx.id} created and inventory rebalanced successfully."
        )


if __name__ == "__main__":
    asyncio.run(main())
