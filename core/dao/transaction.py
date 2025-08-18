import uuid
from typing import assert_never, Optional, Dict, List
from collections import defaultdict
from datetime import datetime, date
from dataclasses import dataclass

from sqlalchemy import asc, desc, select, func, distinct, or_, literal
from sqlalchemy.orm import Session, aliased, Query

from core.models.transaction import TransactionType, Platform
from core.models.transaction import LineItem, LineItemConsumption, Transaction
from core.models.types import MoneyAmount
from core.models.catalog import SKU, Product, Set, Catalog


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
        sku_id_to_purchase_line_items[purchase_line_item.sku_id].append(
            purchase_line_item
        )

    # 5. Consume inventory for each sale line item
    for sale_line_item in sale_line_items:
        sell_quantity = sale_line_item.quantity
        sale_date = sale_line_item.transaction.date

        # Filter purchase line items to only include those with dates before the sale date
        fifo_purchase_line_items = [
            purchase_line_item
            for purchase_line_item in sku_id_to_purchase_line_items[
                sale_line_item.sku_id
            ]
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
            raise InsufficientInventoryError(
                "There is not enough inventory to fulfill the sale."
            )

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
    consumptions = (
        session.query(LineItemConsumption)
        .filter(LineItemConsumption.sale_line_item_id.in_(line_item_ids))
        .all()
    )

    # Get associated purchase line items
    purchase_line_item_ids = {
        consumption.purchase_line_item_id for consumption in consumptions
    }
    purchase_line_items = (
        session.query(LineItem).filter(LineItem.id.in_(purchase_line_item_ids)).all()
    )
    purchase_line_item_dict = {
        line_item.id: line_item for line_item in purchase_line_items
    }

    # Restore purchase line item quantities and delete consumptions
    for consumption in consumptions:
        # Restore the purchase line item quantity
        purchase_line_item_dict[
            consumption.purchase_line_item_id
        ].remaining_quantity += consumption.quantity
        # Delete the consumption
        session.delete(consumption)

    # Delete the sale line items
    for line_item_id in line_item_ids:
        line_item = session.query(LineItem).get(line_item_id)
        if line_item:
            session.delete(line_item)

    session.flush()


def delete_purchase_line_items(
    session: Session, line_item_ids: list[uuid.UUID]
) -> None:
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
    consumptions = (
        session.query(LineItemConsumption)
        .filter(LineItemConsumption.purchase_line_item_id.in_(line_item_ids))
        .all()
    )

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
    transactions = (
        session.query(Transaction).filter(Transaction.id.in_(transaction_ids)).all()
    )

    line_items = (
        session.query(LineItem)
        .filter(LineItem.transaction_id.in_(transaction_ids))
        .all()
    )

    transaction_id_to_line_items = defaultdict(list)

    for line_item in line_items:
        transaction_id_to_line_items[line_item.transaction_id].append(line_item)

    if len(transactions) != len(transaction_ids):
        raise TransactionNotFoundError(
            f"Transactions not found: {set(transaction_ids) - {t.id for t in transactions}}"
        )

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
        delete_transaction_line_items(
            session,
            transaction.type,
            [
                line_item.id
                for line_item in transaction_id_to_line_items[transaction.id]
            ],
        )

        session.delete(transaction)

    session.flush()


def delete_transaction_line_items(
    session: Session, transaction_type: TransactionType, line_item_ids: list[uuid.UUID]
) -> None:
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
    platform_order_id: Optional[str] = None


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
        platform_id=transaction_data.platform_id,
        platform_order_id=transaction_data.platform_order_id,
    )
    session.add(transaction)
    session.flush()  # Flush to get transaction ID

    create_transaction_line_items(
        session, transaction.id, transaction.type, line_items_data
    )

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
            id=item_data.id,
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
    updates: list[LineItemUpdateSpec],
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
        li.id: li
        for li in session.scalars(
            select(LineItem).where(LineItem.id.in_(line_item_ids))
        ).all()
    }

    # Fetch consumed quantities for purchase items if needed (only if decreasing)
    consumed_quantities: Dict[uuid.UUID, int] = {}
    if transaction_type == TransactionType.PURCHASE:
        purchase_items_to_check = [
            spec.line_item_id
            for spec in updates
            if spec.line_item_id in line_items_map
            and spec.quantity < line_items_map[spec.line_item_id].quantity
        ]
        if purchase_items_to_check:
            # Aggregate consumed quantity per purchase line item
            consumption_sums = session.execute(
                select(
                    LineItemConsumption.purchase_line_item_id,
                    func.sum(LineItemConsumption.quantity).label("consumed_total"),
                )
                .where(
                    LineItemConsumption.purchase_line_item_id.in_(
                        purchase_items_to_check
                    )
                )
                .group_by(LineItemConsumption.purchase_line_item_id)
            ).all()
            consumed_quantities = {
                row.purchase_line_item_id: row.consumed_total
                for row in consumption_sums
            }

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
                    if (
                        line_item.remaining_quantity is not None
                    ):  # Should always be true for PURCHASE
                        # Ensure remaining_quantity doesn't go below zero, although the check above should prevent this for decreases
                        line_item.remaining_quantity = max(
                            0, line_item.remaining_quantity + quantity_delta
                        )
                    else:
                        # This case shouldn't happen for a purchase item, but defensively set it
                        line_item.remaining_quantity = max(
                            0, new_quantity - consumed_quantities.get(line_item_id, 0)
                        )

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


def build_total_sales_profit_query(catalog_id: Optional[uuid.UUID] = None):
    """
    Build a SQLAlchemy Select to calculate the total number of sales and total profit across all transactions.
    """

    # Alias LineItem for sale and purchase sides
    SaleLineItem = aliased(LineItem)
    PurchaseLineItem = aliased(LineItem)

    query = (
        select(
            # Count distinct sale transactions
            func.count(distinct(SaleLineItem.transaction_id)).label("num_sales"),
            # Sum of profit per consumption (sale price - purchase price) * quantity
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
    )
    # Apply catalog filter if provided
    if catalog_id is not None:
        query = (
            query.join(SKU, SaleLineItem.sku_id == SKU.id)
            .join(Product, SKU.product_id == Product.id)
            .join(Set, Product.set_id == Set.id)
            .join(Catalog, Set.catalog_id == Catalog.id)
            .where(Catalog.id == catalog_id)
        )

    return query


@dataclass
class TransactionFilterParams:
    """Parameters for filtering transactions"""

    search_query: Optional[str] = None
    date_start: Optional[date] = None
    date_end: Optional[date] = None
    types: Optional[List[TransactionType]] = None
    platform_ids: Optional[List[uuid.UUID]] = None
    include_no_platform: bool = False
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None


def build_filtered_transactions_query(
    session: Session, filters: TransactionFilterParams
) -> Query[Transaction]:
    """
    Build a filtered, de-duplicated base query using DISTINCT ON for transactions.

    Returns a SELECT of (id, date, rank) ordered globally for pagination/consumption.
    """
    # Import here to avoid circular dependency
    from core.dao.catalog import create_product_set_fts_vector

    # Base FROM with necessary joins for filtering/search
    base_from = (
        Transaction.__table__.join(
            LineItem.__table__, LineItem.transaction_id == Transaction.id
        )
        .join(SKU.__table__, SKU.id == LineItem.sku_id)
        .join(Product.__table__, Product.id == SKU.product_id)
        .join(Set.__table__, Set.id == Product.set_id)
    )

    # Search rank
    rank_expr = literal(0.0).label("rank")
    if filters.search_query:
        search_terms = filters.search_query.split()
        if search_terms:
            counterparty_ts_vector = func.setweight(
                func.to_tsvector(
                    "english", func.coalesce(Transaction.counterparty_name, "")
                ),
                "A",
            )
            product_ts_vector = create_product_set_fts_vector()
            combined_ts_vector = counterparty_ts_vector.op("||")(product_ts_vector)
            prefix_terms = [term + ":*" for term in search_terms]
            ts_query = func.to_tsquery("english", " & ".join(prefix_terms))
            rank_expr = func.ts_rank(combined_ts_vector, ts_query).label("rank")

    # Build WHERE conditions
    where_clauses = []
    if filters.search_query:
        search_terms = filters.search_query.split()
        if search_terms:
            counterparty_ts_vector = func.setweight(
                func.to_tsvector(
                    "english", func.coalesce(Transaction.counterparty_name, "")
                ),
                "A",
            )
            product_ts_vector = create_product_set_fts_vector()
            combined_ts_vector = counterparty_ts_vector.op("||")(product_ts_vector)
            prefix_terms = [term + ":*" for term in search_terms]
            ts_query = func.to_tsquery("english", " & ".join(prefix_terms))
            where_clauses.append(combined_ts_vector.op("@@")(ts_query))

    if filters.date_start:
        where_clauses.append(Transaction.date >= filters.date_start)
    if filters.date_end:
        where_clauses.append(Transaction.date <= filters.date_end)

    if filters.types:
        where_clauses.append(Transaction.type.in_(filters.types))

    if filters.platform_ids or filters.include_no_platform:
        platform_conditions = []
        if filters.platform_ids:
            platform_conditions.append(
                Transaction.platform_id.in_(filters.platform_ids)
            )
        if filters.include_no_platform:
            platform_conditions.append(Transaction.platform_id.is_(None))
        if platform_conditions:
            where_clauses.append(or_(*platform_conditions))

    # Amount filters via subquery
    if filters.amount_min is not None or filters.amount_max is not None:
        amount_subq = (
            select(
                LineItem.transaction_id.label("tx_id"),
                func.sum(LineItem.unit_price_amount * LineItem.quantity).label(
                    "total_amount"
                ),
            )
            .group_by(LineItem.transaction_id)
            .subquery()
        )
        base_from = base_from.join(amount_subq, amount_subq.c.tx_id == Transaction.id)
        if filters.amount_min is not None:
            where_clauses.append(amount_subq.c.total_amount >= filters.amount_min)
        if filters.amount_max is not None:
            where_clauses.append(amount_subq.c.total_amount <= filters.amount_max)

    # Inner: pick best row per transaction id
    inner = select(
        Transaction.id.label("id"),
        Transaction.date.label("date"),
        rank_expr,
    ).select_from(base_from)
    if where_clauses:
        inner = inner.where(*where_clauses)

    inner = (
        inner.order_by(
            Transaction.id,  # required first for DISTINCT ON
            desc(rank_expr),
            desc(Transaction.date),
            desc(Transaction.id),
        )
        .distinct(Transaction.id)  # DISTINCT ON (id)
        .subquery()
    )

    # Outer: global order for pagination/consumption
    base_page = select(inner.c.id, inner.c.date, inner.c.rank).order_by(
        desc(inner.c.rank), desc(inner.c.date), desc(inner.c.id)
    )

    return base_page


def get_transaction_filter_options(
    session: Session, catalog_id: Optional[uuid.UUID] = None
) -> dict:
    """
    Get available options for transaction filters.
    This is useful for populating filter dropdowns in the UI.

    Args:
        session: The database session
        catalog_id: Optional catalog ID to filter options

    Returns:
        Dictionary containing available filter options
    """
    # Get all platforms
    platforms_query = session.query(Platform).order_by(Platform.name)

    # Get date range of transactions
    date_range = session.query(
        func.min(Transaction.date).label("min_date"),
        func.max(Transaction.date).label("max_date"),
    ).one()

    # Get transaction types (from enum)
    transaction_types = [type.value for type in TransactionType]

    # If catalog_id provided, filter to relevant platforms
    if catalog_id:
        # This would require joining through transactions -> line_items -> SKUs -> products -> sets
        # Implementation depends on your exact model relationships
        pass

    return {
        "platforms": [{"id": str(p.id), "name": p.name} for p in platforms_query.all()],
        "transaction_types": transaction_types,
        "date_range": {
            "min": date_range.min_date.isoformat() if date_range.min_date else None,
            "max": date_range.max_date.isoformat() if date_range.max_date else None,
        },
    }
