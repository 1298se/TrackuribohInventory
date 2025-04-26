from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, desc
from typing import List, TypedDict
from uuid import UUID
from decimal import Decimal

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
)
from app.routes.utils import MoneySchema
from core.database import get_db_session
from core.models import (
    SKU,
    Product,
    Set,
    Catalog,
    SKULatestPriceData,
    LineItem,
    Transaction,
    Platform,
)
from core.models.transaction import TransactionType
from core.inventory.query_builder import build_inventory_query
from core.inventory.service import get_inventory_metrics

router = APIRouter(
    prefix="/inventory",
)


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
                amount=price_data.lowest_listing_price_amount, currency="USD"
            )
            if price_data and price_data.lowest_listing_price_amount
            else None,
        )
        for (sku, total_quantity, total_cost, price_data) in skus_with_quantity
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

    query = (
        select(
            SKU,
            inventory_sku_quantity_cte.c.total_quantity,
            inventory_sku_quantity_cte.c.total_cost,
            SKULatestPriceData,
        )
        .join(inventory_sku_quantity_cte, SKU.id == inventory_sku_quantity_cte.c.sku_id)
        .outerjoin(SKULatestPriceData, SKU.id == SKULatestPriceData.sku_id)
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

    sku_obj, total_quantity, total_cost, latest_price_data = result

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
            amount=latest_price_data.lowest_listing_price_amount,
            currency="USD",  # Assuming USD as currency is not stored in SKULatestPriceData
        )
        if latest_price_data
        and latest_price_data.lowest_listing_price_amount is not None
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
        select(
            Transaction.id.label("transaction_id"),
            Transaction.date.label("transaction_date"),
            Transaction.type.label("transaction_type"),
            LineItem.quantity,
            LineItem.unit_price_amount,
            Transaction.currency.label("currency"),
            Platform.name.label("platform_name"),
        )
        .select_from(LineItem)  # Start from LineItem
        .join(
            Transaction, LineItem.transaction_id == Transaction.id
        )  # Join Transaction explicitly
        .outerjoin(
            Platform, Transaction.platform_id == Platform.id
        )  # Outer join Platform explicitly
        .where(LineItem.sku_id == sku_id)
        .order_by(desc(Transaction.date))
    )

    # Execute query to get row mappings (dictionary-like objects)
    results: list[SKUTransactionHistoryRow] = session.execute(query).mappings().all()
    total = len(results)

    # Map results to the response schema
    history_items = []
    for row in results:
        history_items.append(
            InventorySKUTransactionLineItemSchema(
                transaction_id=row["transaction_id"],
                transaction_date=row["transaction_date"],
                transaction_type=row["transaction_type"],
                quantity=row["quantity"],
                unit_price=MoneySchema(
                    amount=row["unit_price_amount"], currency=row["currency"]
                ),
                platform_name=row[
                    "platform_name"
                ],  # Will be None if no platform due to outer join
            )
        )

    return InventorySKUTransactionsResponseSchema(items=history_items, total=total)
