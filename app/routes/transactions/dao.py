import uuid
from typing import Sequence, assert_never, TypedDict, Optional
from collections import defaultdict
from datetime import datetime

from sqlalchemy import and_, asc, desc, select
from sqlalchemy.orm import Session

from core.models import SKU, TransactionType
from core.models.transaction import LineItem, LineItemConsumption, Transaction
from core.models.types import MoneyAmount




class InsufficientInventoryError(Exception):
    pass

class TransactionNotFoundError(Exception):
    pass


def process_sale_line_items(session: Session, sale_line_items: list[LineItem]) -> None:
    if not sale_line_items:
        return

    # 1. Gather all relevant SKUs
    sku_ids = {item.sku_id for item in sale_line_items}

    # 2. Group sale line items by SKU and date for easier processing
    sku_id_to_sale_line_items = defaultdict(list)
    for sale_line_item in sale_line_items:
        sku_id_to_sale_line_items[sale_line_item.sku_id].append(sale_line_item)

    # 3. Single query for all eligible purchase line items 
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

    # 4. Group purchase line items by SKU
    sku_id_to_purchase_line_items = defaultdict(list)
    for purchase_line_item in all_purchase_line_items:
        sku_id_to_purchase_line_items[purchase_line_item.sku_id].append(purchase_line_item)

    # 5. Consume inventory for each sale line item
    for sale_line_item in sale_line_items:
        sell_quantity = sale_line_item.quantity
        sale_date = sale_line_item.transaction.date
        
        # Filter purchase line items to only include those with dates before the sale date
        fifo_purchase_line_items = [
            purchase_line_item for purchase_line_item in sku_id_to_purchase_line_items[sale_line_item.sku_id]
            if purchase_line_item.transaction.date < sale_date
        ]

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
    
    session.flush()

def delete_sale_line_items(session: Session, line_item_ids: list[uuid.UUID]) -> None:
    """
    Deletes sale line items and their associated consumptions.
    
    Args:
        session: The database session
        line_item_ids: List of line item IDs to delete
        
    Returns:
        None
    """
    # Find all consumptions related to these sale line items
    consumptions = session.query(LineItemConsumption)\
        .filter(LineItemConsumption.sale_line_item_id.in_(line_item_ids))\
        .all()
    
    # Get associated purchase line items
    purchase_line_item_ids = {consumption.purchase_line_item_id for consumption in consumptions}
    purchase_line_items = session.query(LineItem)\
        .filter(LineItem.id.in_(purchase_line_item_ids))\
        .all()
    purchase_line_item_dict = {line_item.id: line_item for line_item in purchase_line_items}

    # Restore purchase line item quantities and delete consumptions
    for consumption in consumptions:
        # Restore the purchase line item quantity
        purchase_line_item_dict[consumption.purchase_line_item_id].remaining_quantity += consumption.quantity
        # Delete the consumption
        session.delete(consumption)
        
    # Delete the sale line items
    for line_item_id in line_item_ids:
        line_item = session.query(LineItem).get(line_item_id)
        if line_item:
            session.delete(line_item)
            
    session.flush()


def delete_purchase_line_items(session: Session, line_item_ids: list[uuid.UUID]) -> None:
    """
    Deletes purchase line items and their associated consumptions.
    This will also reprocess any affected sale line items.
    
    Args:
        session: The database session
        line_item_ids: List of line item IDs to delete
        
    Returns:
        None
    """
    # Find all consumptions related to these purchase line items
    consumptions = session.query(LineItemConsumption)\
        .filter(LineItemConsumption.purchase_line_item_id.in_(line_item_ids))\
        .all()
    
    # Get associated sale line items
    sale_line_item_ids = {consumption.sale_line_item_id for consumption in consumptions}
    sale_line_items = session.scalars(
        select(LineItem).where(LineItem.id.in_(sale_line_item_ids))
    ).all()

    # Delete all associated consumptions
    for consumption in consumptions:
        session.delete(consumption)
    
    # Delete the purchase line items
    for line_item_id in line_item_ids:
        line_item = session.query(LineItem).get(line_item_id)
        if line_item:
            session.delete(line_item)
    
    # Re-process sale line items
    process_sale_line_items(session, sale_line_items)
    
    session.flush()


def delete_transactions(session: Session, transaction_ids: list[uuid.UUID]) -> None:
    """
    Deletes all transactions (and their associated line items and consumptions)
    for the given list of transaction_ids.

    Raises:
        TransactionNotFoundError: If one or more transactions are not found.
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
        delete_transaction_line_items(session, transaction.type, [line_item.id for line_item in transaction_id_to_line_items[transaction.id]])

        session.delete(transaction)

    session.flush()

def delete_transaction_line_items(session: Session, transaction_type: TransactionType, line_item_ids: list[uuid.UUID]) -> None:
        match transaction_type:
            case TransactionType.PURCHASE:
                delete_purchase_line_items(session, line_item_ids)
            case TransactionType.SALE:
                delete_sale_line_items(session, line_item_ids)

class TransactionDataDict(TypedDict):
    date: datetime
    type: TransactionType
    counterparty_name: str
    comment: Optional[str]
    currency: str
    shipping_cost_amount: MoneyAmount


class LineItemDataDict(TypedDict):
    sku_id: uuid.UUID
    quantity: int
    unit_price_amount: MoneyAmount

def create_transaction_with_line_items(
    session: Session,
    transaction_data: TransactionDataDict,
    line_items_data: list[LineItemDataDict],
) -> Transaction:
    """
    Creates a transaction and its associated line items.
    
    Args:
        session: The database session
        transaction_data: Dictionary containing transaction data (date, type, counterparty_name, etc.)
        line_items_data: List of dictionaries containing line item data 
                         (sku_id, quantity, unit_price_amount)
        
    Returns:
        The created transaction with line items
    """
    # Create the transaction
    transaction = Transaction(**transaction_data)
    session.add(transaction)
    session.flush()  # Flush to get transaction ID

    create_transaction_line_items(session, transaction.id, transaction.type, line_items_data)
    
    return transaction

def create_transaction_line_items(
    session: Session,
    transaction_id: uuid.UUID,
    transaction_type: TransactionType,
    line_items_data: list[LineItemDataDict],
) -> list[LineItem]:
    # Create the line items with the transaction ID using list comprehension
    line_items = [
        LineItem(**{**dict(item_data), "transaction_id": transaction_id})
        for item_data in line_items_data
    ]
    
    session.add_all(line_items)
    session.flush()  # Flush to get LineItem IDs
    
    # Handle transaction type-specific logic
    match transaction_type:
        case TransactionType.PURCHASE:
            for line_item in line_items:
                line_item.remaining_quantity = line_item.quantity
                
        case TransactionType.SALE:
            process_sale_line_items(session, line_items)