import uuid
from typing import Sequence, assert_never
from collections import defaultdict

from sqlalchemy import and_, asc, desc, select
from sqlalchemy.orm import Session

from core.models import SKU, TransactionType
from core.models.inventory import LineItem, LineItemConsumption, Transaction


def get_skus_by_id(session: Session, ids: list[uuid.UUID]) -> Sequence[SKU]:
    return session.scalars(select(SKU).where(SKU.id.in_(ids))).all()

class InsufficientInventoryError(Exception):
    pass

class TransactionNotFoundError(Exception):
    pass

def process_sale_line_items(session: Session, sale_line_items: list[LineItem]) -> None:
    if not sale_line_items:
        return

    # 1. Gather all relevant SKUs
    sku_ids = {item.sku_id for item in sale_line_items}

    # 2. Single query for all purchase line items ordered by date because FIFO
    all_purchase_line_items = (
        session.query(LineItem)
        .join(Transaction)
        .where(
            LineItem.sku_id.in_(sku_ids),
            LineItem.remaining_quantity.isnot(None),
            LineItem.remaining_quantity > 0,
        )
        .order_by(desc(Transaction.date), asc(LineItem.id))
        .all()
    )

    # 3. Group purchase line items by SKU
    sku_id_to_purchase_line_items = defaultdict(list)
    for purchase_line_item in all_purchase_line_items:
        sku_id_to_purchase_line_items[purchase_line_item.sku_id].append(purchase_line_item)

    # 4. Consume inventory for each sale line item
    for sale_line_item in sale_line_items:
        sell_quantity = sale_line_item.quantity
        fifo_purchase_line_items = sku_id_to_purchase_line_items[sale_line_item.sku_id]

        for purchase_line_item in fifo_purchase_line_items:
            if sell_quantity == 0:
                break

            if purchase_line_item.remaining_quantity >= sell_quantity:
                purchase_line_item.remaining_quantity -= sell_quantity
                session.add(
                    LineItemConsumption(
                        sale_line_item_id=sale_line_item.id,
                        purchase_line_item_id=purchase_line_item.id,
                        quantity=sell_quantity,
                    )
                )
                sell_quantity = 0
            else:
                quantity_available = purchase_line_item.remaining_quantity
                sell_quantity -= quantity_available
                purchase_line_item.remaining_quantity = 0

                session.add(
                    LineItemConsumption(
                        sale_line_item_id=sale_line_item.id,
                        purchase_line_item_id=purchase_line_item.id,
                        quantity=quantity_available,
                    )
                )

        # If we still have unfilled sale quantity --> insufficient inventory
        if sell_quantity > 0:
            raise InsufficientInventoryError("There is not enough inventory to fulfill the sale.")

def delete_transactions(session: Session, transaction_ids: list[uuid.UUID]) -> None:
    """
    Deletes all transactions (and their associated line items and consumptions)
    for the given list of transaction_ids.

    Raises:
        Exception: If one or more transactions are not found.
    """
    # Fetch all transactions with the provided IDs
    transactions = session.query(Transaction).filter(Transaction.id.in_(transaction_ids)).all()

    line_items = session.query(LineItem).filter(LineItem.transaction_id.in_(transaction_ids)).all()
    
    transaction_id_to_line_items = defaultdict(list)
    
    for line_item in line_items:
        transaction_id_to_line_items[line_item.transaction_id].append(line_item)

    if len(transactions) != len(transaction_ids):
        raise TransactionNotFoundError(f"Transactions not found: {set(transaction_ids) - {t.id for t in transactions}}")

    # Reorder transactions to process SALE transactions before PURCHASE transactions using exhaustive match‑case
    def transaction_priority(t: Transaction) -> int:
        match t.type:
            case TransactionType.SALE:
                return 0
            case TransactionType.PURCHASE:
                return 1
            case _:
                assert_never(t.type)

    ordered_transactions = sorted(transactions, key=transaction_priority)

    for transaction in ordered_transactions:
        line_item_ids = [line_item.id for line_item in transaction_id_to_line_items[transaction.id]]
        
        # Delete all associated line items
        for line_item in line_items:
            session.delete(line_item)
        
        # Delete the transaction itself
        session.delete(transaction)
        
        match transaction.type:
            case TransactionType.PURCHASE:
                consumptions = session.query(LineItemConsumption)\
                    .filter(LineItemConsumption.purchase_line_item_id.in_(line_item_ids))\
                    .all()
                sale_line_item_ids = {consumption.sale_line_item_id for consumption in consumptions}
                sale_line_items = session.scalars(
                    select(LineItem).where(LineItem.id.in_(sale_line_item_ids))
                ).all()

                # Delete all associated consumptions
                for consumption in consumptions:
                    session.delete(consumption)
        
                # Re-process sale line items
                process_sale_line_items(session, sale_line_items)

            case TransactionType.SALE:
                consumptions = session.query(LineItemConsumption)\
                    .filter(LineItemConsumption.sale_line_item_id.in_(line_item_ids))\
                    .all()
                purchase_line_item_ids = {consumption.purchase_line_item_id for consumption in consumptions}
                purchase_line_items = session.query(LineItem)\
                    .filter(LineItem.id.in_(purchase_line_item_ids))\
                    .all()
                purchase_line_item_dict = {line_item.id: line_item for line_item in purchase_line_items}
        
                for consumption in consumptions:
                    # Restore the purchase line item quantity
                    purchase_line_item_dict[consumption.purchase_line_item_id].remaining_quantity += consumption.quantity
        
                    # Delete the consumption
                    session.delete(consumption)

        session.flush()