from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, desc
from typing import List, TypedDict
from uuid import UUID
from decimal import Decimal
from datetime import date

from app.routes.catalog.schemas import (
    SKUWithProductResponseSchema,
    CatalogsResponseSchema,
)
from core.dao.inventory import (
    query_inventory_items,
    InventoryQueryResultRow,
    get_sku_cost_quantity_cte,
)
from app.routes.inventory.schemas import (
    InventoryResponseSchema,
    InventoryItemResponseSchema,
    InventorySKUTransactionsResponseSchema,
    InventorySKUTransactionLineItemSchema,
    InventoryMetricsResponseSchema,
    InventoryHistoryItemSchema,
)
from app.routes.utils import MoneySchema
from core.database import get_db_session
from core.models.catalog import SKU, Catalog, Product, Set
from core.dao.price import latest_price_subquery
from core.models.transaction import Transaction, LineItem, TransactionType
from core.inventory.inventory import build_inventory_query
from core.services.inventory_service import get_inventory_metrics, get_inventory_history

router = APIRouter(
    prefix="/inventory",
)


# -------------------------------------------------------------------------
# Inventory History endpoint
# -------------------------------------------------------------------------


@router.get("/history", response_model=list[InventoryHistoryItemSchema])
def get_inventory_history_endpoint(
    catalog_id: UUID | None = None,
    days: int | None = None,
    session: Session = Depends(get_db_session),
):
    """Return historical inventory valuation snapshots.

    If ``catalog_id`` is omitted the response aggregates across catalogues. When
    ``days`` is omitted, all available history is returned.
    """

    # 1) Load persisted end-of-day snapshots
    history = get_inventory_history(session=session, catalog_id=catalog_id, days=days)
    # 2) Fetch live metrics for today
    metrics = get_inventory_metrics(session=session, catalog_id=catalog_id)
    # 3) Build today's snapshot row
    today_snapshot = InventoryHistoryItemSchema(
        snapshot_date=date.today(),
        total_cost=metrics["total_inventory_cost"],
        total_market_value=metrics["total_market_value"],
        unrealised_profit=metrics["unrealised_profit"],
    )
    # 4) Return combined history
    return [*history, today_snapshot]


@router.get("/metrics", response_model=InventoryMetricsResponseSchema)
def get_inventory_metrics_endpoint(
    catalog_id: UUID | None = None,
    session: Session = Depends(get_db_session),
):
    """Return aggregate metrics for the selected catalogue (or all)."""
    metrics = get_inventory_metrics(session=session, catalog_id=catalog_id)
    return InventoryMetricsResponseSchema(**metrics)


@router.get("/catalogs", response_model=CatalogsResponseSchema)
def get_inventory_catalogs(
    session: Session = Depends(get_db_session),
):
    """
    Get all catalogs that have items in the inventory.
    """
    # First get SKUs in inventory
    inventory_query = query_inventory_items()
    sku_ids_with_inventory = [
        sku.id for sku, _, _, _ in session.execute(inventory_query).all()
    ]

    # Now find which catalogs these SKUs belong to
    catalogs_query = (
        select(Catalog)
        .distinct()
        .join(Set, Catalog.id == Set.catalog_id)
        .join(Product, Set.id == Product.set_id)
        .join(SKU, Product.id == SKU.product_id)
        .where(SKU.id.in_(sku_ids_with_inventory))
        .order_by(Catalog.display_name)
    )

    catalogs = session.scalars(catalogs_query).all()

    return CatalogsResponseSchema(catalogs=catalogs)


@router.get("/", response_model=InventoryResponseSchema)
def get_inventory(
    session: Session = Depends(get_db_session),
    query: str | None = None,
    catalog_id: UUID | None = None,
):
    inventory_query = build_inventory_query(query=query, catalog_id=catalog_id).options(
        *SKUWithProductResponseSchema.get_load_options()
    )
    skus_with_quantity: List[InventoryQueryResultRow] = session.execute(
        inventory_query
    ).all()

    inventory_items = [
        InventoryItemResponseSchema(
            sku=sku,
            quantity=total_quantity,
            average_cost_per_item=MoneySchema(
                amount=total_cost / total_quantity, currency="USD"
            ),
            lowest_listing_price=MoneySchema(
                amount=lowest_listing_price, currency="USD"
            )
            if lowest_listing_price is not None
            else None,
        )
        for (
            sku,
            total_quantity,
            total_cost,
            lowest_listing_price,
        ) in skus_with_quantity
    ]

    return InventoryResponseSchema(inventory_items=inventory_items)


@router.get(
    "/{sku_id}",
    response_model=InventoryItemResponseSchema,
    summary="Get Inventory Item Details",
)
def get_inventory_item_details(
    sku_id: UUID,
    session: Session = Depends(get_db_session),
):
    """
    Get details for a specific inventory item identified by its SKU ID.

    An inventory item's quantity and cost are calculated dynamically based on
    transaction line items with remaining quantities.
    """
    inventory_sku_quantity_cte = get_sku_cost_quantity_cte()
    latest_price = latest_price_subquery()

    query = (
        select(
            SKU,
            inventory_sku_quantity_cte.c.total_quantity,
            inventory_sku_quantity_cte.c.total_cost,
            latest_price.c.lowest_listing_price_total,
        )
        .join(inventory_sku_quantity_cte, SKU.id == inventory_sku_quantity_cte.c.sku_id)
        .outerjoin(latest_price, SKU.id == latest_price.c.sku_id)
        .options(  # Eager load SKU's related data for the response schema
            joinedload(SKU.product).joinedload(Product.set),
            joinedload(SKU.condition),
            joinedload(SKU.printing),
            joinedload(SKU.language),
        )
        .where(SKU.id == sku_id)  # Filter by the specific SKU ID
    )

    result = session.execute(query).first()

    if result is None:
        raise HTTPException(
            status_code=404, detail="Inventory item not found or quantity is zero"
        )

    sku_obj, total_quantity, total_cost, lowest_listing_price_total = result

    # Ensure total_cost is treated as Decimal for calculation
    total_cost_decimal = total_cost if isinstance(total_cost, Decimal) else Decimal(0)

    # Calculate average cost
    avg_cost_amount = (
        (total_cost_decimal / total_quantity) if total_quantity > 0 else Decimal(0)
    )

    # Construct MoneySchema, assuming USD for average cost for now
    # TODO: Determine if currency should be stored/derived for average cost
    avg_cost = MoneySchema(amount=avg_cost_amount, currency="USD")

    # Construct MoneySchema for lowest listing price if available
    lowest_listing = (
        MoneySchema(
            amount=lowest_listing_price_total,
            currency="USD",  # Assuming USD as currency
        )
        if lowest_listing_price_total is not None
        else None
    )

    # Manually construct the response object
    response_data = InventoryItemResponseSchema(
        sku=sku_obj,  # Pass the fetched SKU object with its eager-loaded relations
        quantity=total_quantity,
        average_cost_per_item=avg_cost,
        lowest_listing_price=lowest_listing,
    )

    return response_data


class SKUTransactionHistoryRow(TypedDict):
    transaction_id: UUID
    transaction_date: datetime
    transaction_type: TransactionType
    quantity: int
    unit_price_amount: Decimal
    currency: str
    platform_name: str | None


@router.get(
    "/{sku_id}/transactions",
    response_model=InventorySKUTransactionsResponseSchema,
    summary="Get Transaction History for an Inventory SKU",
)
def get_sku_transaction_history(
    sku_id: UUID,
    session: Session = Depends(get_db_session),
):
    """Get the transaction history for a specific SKU in inventory."""

    # Query selecting specific columns using explicit joins
    query = (
        select(LineItem)
        .join(
            Transaction, LineItem.transaction_id == Transaction.id
        )  # Join Transaction explicitly
        .options(
            joinedload(LineItem.transaction)
        )  # Eager load the transaction relationship
        .where(LineItem.sku_id == sku_id)
        .order_by(desc(Transaction.date))
    )

    # Execute query to get row mappings (dictionary-like objects)
    results = session.execute(query).scalars().all()
    total = len(results)

    # Map results to the response schema
    history_items = []
    for line_item in results:
        history_items.append(
            InventorySKUTransactionLineItemSchema(
                transaction_id=line_item.transaction_id,
                counterparty_name=line_item.transaction.counterparty_name,
                transaction_date=line_item.transaction.date,
                transaction_type=line_item.transaction.type,
                quantity=line_item.quantity,
                unit_price=MoneySchema(
                    amount=line_item.unit_price_amount,
                    currency=line_item.transaction.currency,
                ),
            )
        )

    return InventorySKUTransactionsResponseSchema(items=history_items, total=total)
