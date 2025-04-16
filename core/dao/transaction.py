import uuid
from typing import Sequence, assert_never, TypedDict, Optional, NotRequired, Dict, Tuple, List
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from dataclasses import dataclass, field

from sqlalchemy import and_, asc, desc, select, func
from sqlalchemy.orm import Session, joinedload

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
            if purchase_line_item.transaction.date <= sale_date
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

@dataclass
class TransactionData:
    date: datetime
    type: TransactionType
    counterparty_name: str
    currency: str
    shipping_cost_amount: MoneyAmount
    tax_amount: MoneyAmount
    comment: Optional[str] = None
    platform_id: Optional[uuid.UUID] = None

@dataclass
class LineItemData:
    sku_id: uuid.UUID
    quantity: int
    unit_price_amount: MoneyAmount
    id: Optional[uuid.UUID] = None

@dataclass
class LineItemUpdateSpec:
    line_item_id: uuid.UUID
    quantity: int
    unit_price_amount: MoneyAmount

def create_transaction_with_line_items(
    session: Session,
    transaction_data: TransactionData,
    line_items_data: list[LineItemData],
) -> Transaction:
    """
    Creates a transaction and its associated line items.
    
    Args:
        session: The database session
        transaction_data: Dataclass containing transaction data (date, type, counterparty_name, etc.)
        line_items_data: List of dataclasses containing line item data 
                         (sku_id, quantity, unit_price_amount)
        
    Returns:
        The created transaction with line items
    """
    # Create the transaction using attributes from dataclass
    transaction = Transaction(
        date=transaction_data.date,
        type=transaction_data.type,
        counterparty_name=transaction_data.counterparty_name,
        comment=transaction_data.comment,
        currency=transaction_data.currency,
        shipping_cost_amount=transaction_data.shipping_cost_amount,
        tax_amount=transaction_data.tax_amount,
        platform_id=transaction_data.platform_id
    )
    session.add(transaction)
    session.flush()  # Flush to get transaction ID

    create_transaction_line_items(session, transaction.id, transaction.type, line_items_data)
    
    return transaction

def create_transaction_line_items(
    session: Session,
    transaction_id: uuid.UUID,
    transaction_type: TransactionType,
    line_items_data: list[LineItemData],
) -> list[LineItem]:
    # Create the line items using attributes from dataclasses
    line_items = [
        LineItem(
            transaction_id=transaction_id, 
            sku_id=item_data.sku_id,
            quantity=item_data.quantity,
            unit_price_amount=item_data.unit_price_amount,
            # Use the id from dataclass if provided (relevant for updates later, though create doesn't use it)
            id=item_data.id 
        )
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

# --- NEW FUNCTION ---
def bulk_update_transaction_line_items(
    session: Session, 
    transaction_type: TransactionType, 
    updates: list[LineItemUpdateSpec]
) -> None:
    """
    Updates existing transaction line items in bulk.

    Handles quantity changes, including validation against consumed quantities
    for PURCHASE items. Price updates are also applied.

    Relies on the caller to manage session flush, commit, and rollback.

    Args:
        session: The database session.
        transaction_type: The type of the parent transaction (PURCHASE or SALE).
        updates: A list of dataclasses specifying the updates. Each dict
                 should contain 'line_item_id', 'quantity', and 'unit_price_amount'.

    Raises:
        InsufficientInventoryError: If attempting to decrease a purchase line item's
                                     quantity below what has already been consumed.
        NotImplementedError: If attempting to change the quantity of a SALE line item
                             (as this requires complex consumption reprocessing).
    """
    if not updates:
        return

    line_item_ids = [spec.line_item_id for spec in updates]
    
    # Fetch all relevant line items in one query
    line_items_map: Dict[uuid.UUID, LineItem] = {
        li.id: li for li in session.scalars(
            select(LineItem).where(LineItem.id.in_(line_item_ids))
        ).all()
    }

    # Fetch consumed quantities for purchase items if needed (only if decreasing)
    consumed_quantities: Dict[uuid.UUID, int] = {}
    if transaction_type == TransactionType.PURCHASE:
        purchase_items_to_check = [
            spec.line_item_id for spec in updates 
            if spec.line_item_id in line_items_map and spec.quantity < line_items_map[spec.line_item_id].quantity
        ]
        if purchase_items_to_check:
            # Aggregate consumed quantity per purchase line item
            consumption_sums = session.execute(
                select(
                    LineItemConsumption.purchase_line_item_id,
                    func.sum(LineItemConsumption.quantity).label('consumed_total')
                )
                .where(LineItemConsumption.purchase_line_item_id.in_(purchase_items_to_check))
                .group_by(LineItemConsumption.purchase_line_item_id)
            ).all()
            consumed_quantities = {row.purchase_line_item_id: row.consumed_total for row in consumption_sums}


    for spec in updates:
        line_item_id = spec.line_item_id
        new_quantity = spec.quantity
        new_unit_price = spec.unit_price_amount

        line_item = line_items_map.get(line_item_id)
        
        # Should not happen if caller logic is correct, but defensive check
        if not line_item:  
            # Maybe log a warning here? Or raise? For now, skip.
            continue 

        original_quantity = line_item.quantity
        quantity_delta = new_quantity - original_quantity

        # --- Quantity Change Logic ---
        if quantity_delta != 0:
            match transaction_type:
                case TransactionType.PURCHASE:
                    # Check for decrease below consumed quantity
                    if quantity_delta < 0:
                        consumed = consumed_quantities.get(line_item_id, 0)
                        if new_quantity < consumed:
                            raise InsufficientInventoryError(
                                f"Cannot reduce quantity of purchase line item {line_item_id} "
                                f"to {new_quantity}. Already consumed: {consumed}."
                            )
                    
                    # Update remaining quantity
                    if line_item.remaining_quantity is not None: # Should always be true for PURCHASE
                         # Ensure remaining_quantity doesn't go below zero, although the check above should prevent this for decreases
                        line_item.remaining_quantity = max(0, line_item.remaining_quantity + quantity_delta)
                    else:
                        # This case shouldn't happen for a purchase item, but defensively set it
                        line_item.remaining_quantity = max(0, new_quantity - consumed_quantities.get(line_item_id, 0))

                    line_item.quantity = new_quantity

                case TransactionType.SALE:
                    # Updating sale quantity requires reprocessing consumptions, which is complex.
                    # For now, disallow quantity changes for sales.
                    raise NotImplementedError(
                        "Changing the quantity of a SALE line item is not supported "
                        "due to inventory reprocessing complexity."
                    )
                case _:
                    assert_never(transaction_type)

        # --- Price Change Logic ---
        if line_item.unit_price_amount != new_unit_price:
            line_item.unit_price_amount = new_unit_price

        # Line item is already part of the session, modifications are tracked.
        # No explicit session.add(line_item) needed unless it was detached.

def get_total_sales_profit(session: Session) -> Tuple[int, Decimal]:
    """
    Calculate the total profit from all sales by analyzing LineItemConsumption records.
    
    Args:
        session: The database session
        
    Returns:
        A tuple containing (total_sales_count, total_profit)
    """
    # Get all LineItemConsumption records with their associated sale and purchase line items
    query = (
        select(LineItemConsumption)
        .options(
            joinedload(LineItemConsumption.sale_line_item)
            .joinedload(LineItem.transaction),
            joinedload(LineItemConsumption.purchase_line_item)
            .joinedload(LineItem.transaction)
        )
    )
    
    consumptions = session.scalars(query).all()
    
    # Initialize counters
    total_profit = Decimal('0')
    total_revenue = Decimal('0')
    
    # Process each consumption record
    for consumption in consumptions:
        # Skip if we can't find the associated transactions
        if not consumption.sale_line_item or not consumption.purchase_line_item:
            continue
            
        # Get the sale and purchase prices
        sale_unit_price = consumption.sale_line_item.unit_price_amount
        purchase_unit_price = consumption.purchase_line_item.unit_price_amount
        quantity = consumption.quantity
        
        # Calculate profit for this consumption
        item_revenue = sale_unit_price * quantity
        item_cost = purchase_unit_price * quantity
        item_profit = item_revenue - item_cost
        
        # Add to totals
        total_revenue += item_revenue
        total_profit += item_profit
    
    # Calculate number of sales
    num_sales = len(set(c.sale_line_item.transaction_id for c in consumptions if c.sale_line_item))
    
    return num_sales, total_profit