from datetime import datetime, timedelta, date
from datetime import timezone as datetime_timezone
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
from core.auth import User, get_current_user
from core.dao.inventory import (
    InventoryQueryResultRow,
    get_sku_cost_quantity_cte,
    build_inventory_query,
)
from app.routes.inventory.schemas import (
    InventoryResponseSchema,
    InventoryItemResponseSchema,
    InventorySKUTransactionsResponseSchema,
    InventorySKUTransactionLineItemSchema,
    InventoryMetricsResponseSchema,
    InventoryHistoryItemSchema,
    InventoryPriceHistoryResponseSchema,
    InventoryPriceHistoryItemSchema,
    InventorySkuMarketplacesResponseSchema,
)
from app.routes.utils import MoneySchema
from core.database import get_db_session
from core.models.catalog import SKU, Product
from core.dao.price import (
    latest_price_subquery,
    price_24h_ago_subquery,
    fetch_sku_price_snapshots,
    normalize_price_history,
    date_to_datetime_utc,
    PriceHistoryPoint,
)
from core.services.tcgplayer_catalog_service import get_tcgplayer_catalog_service
from core.models.transaction import Transaction, LineItem, TransactionType
from core.services.inventory_service import get_inventory_metrics, get_inventory_history
from core.services.price_service import build_daily_price_series_for_skus


router = APIRouter(
    prefix="/inventory",
    dependencies=[Depends(get_current_user)],  # All routes require authentication
)


# Authentication is handled at router level
# Individual endpoints can still access current_user via Depends(get_current_user)


# -------------------------------------------------------------------------
# Inventory History endpoint
# -------------------------------------------------------------------------


@router.get("/performance", response_model=list[InventoryHistoryItemSchema])
def get_inventory_performance_endpoint(
    catalog_id: UUID | None = None,
    days: int | None = None,
    session: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Return historical inventory performance data for visualization.

    If ``catalog_id`` is omitted the response aggregates across user's catalogues. When
    ``days`` is omitted, all available history is returned.
    """

    # 1) Load persisted end-of-day snapshots
    history = get_inventory_history(
        session=session, user_id=current_user.id, catalog_id=catalog_id, days=days
    )
    # 2) Fetch live metrics for today
    metrics = get_inventory_metrics(
        session=session, user_id=current_user.id, catalog_id=catalog_id
    )
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
    current_user: User = Depends(get_current_user),
):
    """Return aggregate metrics for the selected catalogue (or all user's catalogues)."""
    metrics = get_inventory_metrics(
        session=session, user_id=current_user.id, catalog_id=catalog_id
    )
    return InventoryMetricsResponseSchema(**metrics)


@router.get("/catalogs", response_model=CatalogsResponseSchema)
def get_inventory_catalogs(
    session: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get all catalogs that have items in the user's inventory.
    """
    # Use the updated user-aware query
    from core.dao.inventory import query_inventory_catalogs

    catalogs_query = query_inventory_catalogs(user_id=current_user.id)
    catalogs = session.scalars(catalogs_query).all()

    return CatalogsResponseSchema(catalogs=catalogs)


@router.get("/", response_model=InventoryResponseSchema)
async def get_inventory(
    session: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    query: str | None = None,
    catalog_id: UUID | None = None,
):
    inventory_query = build_inventory_query(
        user_id=current_user.id, query=query, catalog_id=catalog_id
    ).options(*SKUWithProductResponseSchema.get_load_options())
    skus_with_quantity: List[InventoryQueryResultRow] = session.execute(
        inventory_query
    ).all()

    # Bulk fetch 7-day price histories for all SKUs to avoid N+1 queries
    sku_ids = [sku.id for sku, _, _, _, _ in skus_with_quantity]
    start_date = datetime.now(datetime_timezone.utc) - timedelta(days=7)
    end_date = datetime.now(datetime_timezone.utc)

    try:
        daily_series = build_daily_price_series_for_skus(
            session=session, sku_ids=sku_ids, start_date=start_date, end_date=end_date
        )
    except Exception as e:
        # Log the error but don't fail the request
        import logging

        logging.warning(f"Failed to fetch bulk 7d price histories: {e}")
        daily_series = {}

    inventory_items = []
    for (
        sku,
        total_quantity,
        total_cost,
        lowest_listing_price,
        price_24h_ago,
    ) in skus_with_quantity:
        # Get 7-day price history for this SKU from bulk results
        price_history_7d = None
        price_change_7d_amount = None
        price_change_7d_percentage = None

        price_points = daily_series.get(sku.id, [])

        # Convert to schema format
        if price_points:
            price_history_7d = [
                InventoryPriceHistoryItemSchema(
                    datetime=point.datetime_iso,
                    price=MoneySchema(amount=point.price, currency="USD"),
                )
                for point in price_points
            ]

            # Calculate 7-day change if we have enough data
            if len(price_points) >= 2:
                first_price = price_points[0].price
                last_price = price_points[-1].price
                if first_price != 0:
                    change_amount = last_price - first_price
                    change_percentage = (change_amount / first_price) * 100
                    price_change_7d_amount = MoneySchema(
                        amount=change_amount, currency="USD"
                    )
                    price_change_7d_percentage = change_percentage

        inventory_items.append(
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
                price_change_7d_amount=price_change_7d_amount,
                price_change_7d_percentage=price_change_7d_percentage,
                price_history_7d=price_history_7d,
            )
        )

    return InventoryResponseSchema(inventory_items=inventory_items)


@router.get(
    "/{sku_id}",
    response_model=InventoryItemResponseSchema,
    summary="Get Inventory Item Details",
)
def get_inventory_item_details(
    sku_id: UUID,
    session: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get details for a specific inventory item identified by its SKU ID for the current user.

    An inventory item's quantity and cost are calculated dynamically based on
    the user's transaction line items with remaining quantities.
    """
    inventory_sku_quantity_cte = get_sku_cost_quantity_cte(user_id=current_user.id)
    latest_price = latest_price_subquery()
    price_24h_ago = price_24h_ago_subquery()

    query = (
        select(
            SKU,
            inventory_sku_quantity_cte.c.total_quantity,
            inventory_sku_quantity_cte.c.total_cost,
            latest_price.c.lowest_listing_price_total,
            price_24h_ago.c.lowest_listing_price_total.label("price_24h_ago"),
        )
        .join(inventory_sku_quantity_cte, SKU.id == inventory_sku_quantity_cte.c.sku_id)
        .outerjoin(latest_price, SKU.id == latest_price.c.sku_id)
        .outerjoin(price_24h_ago, SKU.id == price_24h_ago.c.sku_id)
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

    (
        sku_obj,
        total_quantity,
        total_cost,
        lowest_listing_price_total,
        price_24h_ago_total,
    ) = result

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

    # Get 7-day price history for sparkline
    price_history_7d = None
    price_change_7d_amount = None
    price_change_7d_percentage = None

    try:
        # Calculate date range for 7 days
        start_date = datetime.now(datetime_timezone.utc) - timedelta(days=7)
        end_date = datetime.now(datetime_timezone.utc)

        # Get raw price history from the database
        price_changes, initial_price = fetch_sku_price_snapshots(
            session=session, sku_id=sku_id, start_date=start_date, end_date=end_date
        )

        # Normalize the price data
        price_data = normalize_price_history(
            price_changes=price_changes,
            initial_price=initial_price,
            start_date=start_date,
            end_date=end_date,
        )

        # Convert to schema format
        if price_data:
            price_history_7d = [
                InventoryPriceHistoryItemSchema(
                    datetime=data_point["datetime"],
                    price=MoneySchema(
                        amount=data_point["price"],
                        currency="USD",
                    ),
                )
                for data_point in price_data
            ]

            # Calculate 7-day change if we have enough data
            if len(price_data) >= 2:
                first_price = price_data[0]["price"]
                last_price = price_data[-1]["price"]
                if first_price != 0:
                    change_amount = last_price - first_price
                    change_percentage = (change_amount / first_price) * 100
                    price_change_7d_amount = MoneySchema(
                        amount=change_amount, currency="USD"
                    )
                    price_change_7d_percentage = change_percentage

    except Exception as e:
        # Log the error but don't fail the request
        import logging

        logging.warning(f"Failed to fetch 7d price history for SKU {sku_id}: {e}")

    # Manually construct the response object
    response_data = InventoryItemResponseSchema(
        sku=sku_obj,  # Pass the fetched SKU object with its eager-loaded relations
        quantity=total_quantity,
        average_cost_per_item=avg_cost,
        lowest_listing_price=lowest_listing,
        price_change_7d_amount=price_change_7d_amount,
        price_change_7d_percentage=price_change_7d_percentage,
        price_history_7d=price_history_7d,
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
    current_user: User = Depends(get_current_user),
):
    """Get the transaction history for a specific SKU in the user's inventory."""

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
        .where(LineItem.user_id == current_user.id)  # Filter by user
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


@router.get(
    "/{sku_id}/price-history",
    response_model=InventoryPriceHistoryResponseSchema,
    summary="Get Price History for an Inventory SKU",
)
async def get_sku_price_history(
    sku_id: UUID,
    days: int | None = None,
    marketplace: str | None = None,
    session: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get the normalized price history for a specific SKU in inventory.

    Returns daily price data with forward-filled values (last known price
    is carried forward until a new price is recorded).

    Parameters:
    - sku_id: The SKU to get price history for
    - days: Number of days to look back (defaults to 30)
    - marketplace: Marketplace to filter by (currently returns combined data)
    """
    # Default to 30 days if not specified
    if days is None:
        days = 30

    # Calculate date range
    start_date = datetime.now(datetime_timezone.utc) - timedelta(days=days)
    end_date = datetime.now(datetime_timezone.utc)

    # Get raw price history from the database
    price_changes, initial_price = fetch_sku_price_snapshots(
        session=session, sku_id=sku_id, start_date=start_date, end_date=end_date
    )

    # Normalize the price data
    price_data = normalize_price_history(
        price_changes=price_changes,
        initial_price=initial_price,
        start_date=start_date,
        end_date=end_date,
    )

    # Fetch fresh price data for today (read-only, not stored)
    try:
        sku_tcgplayer_id = session.execute(
            select(SKU.tcgplayer_id).where(SKU.id == sku_id)
        ).scalar_one_or_none()

        if sku_tcgplayer_id:
            catalog_service = get_tcgplayer_catalog_service()
            # Fetch current price directly from TCGPlayer
            sku_prices_response = await catalog_service.get_sku_prices(
                [sku_tcgplayer_id]
            )

            if sku_prices_response.results:
                fresh_price = sku_prices_response.results[0].lowest_listing_price_total

                if fresh_price is not None:
                    today_iso = date_to_datetime_utc(date.today()).isoformat()

                    # Check if the last data point is today and update it, otherwise append
                    if price_data and price_data[-1].datetime_iso == today_iso:
                        price_data[-1] = PriceHistoryPoint(
                            datetime_iso=today_iso, price=float(fresh_price)
                        )
                    else:
                        price_data.append(
                            PriceHistoryPoint(
                                datetime_iso=today_iso, price=float(fresh_price)
                            )
                        )

    except Exception as e:
        # Log the error but don't fail the request - just return historical data
        import logging

        logging.warning(f"Failed to fetch fresh price data for SKU {sku_id}: {e}")

    # Convert to response schema
    history_items = [
        InventoryPriceHistoryItemSchema(
            datetime=data_point.datetime_iso,
            price=MoneySchema(
                amount=data_point.price,
                currency="USD",  # Assuming USD for now
            ),
        )
        for data_point in price_data
    ]

    return InventoryPriceHistoryResponseSchema(items=history_items)


@router.get(
    "/{sku_id}/marketplaces",
    response_model=InventorySkuMarketplacesResponseSchema,
    summary="Get Available Marketplaces for an Inventory SKU",
)
def get_sku_marketplaces(
    sku_id: UUID,
    session: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get the list of marketplaces available for a specific SKU in the user's inventory.

    Returns a list of marketplace names that have data available for this SKU.
    """
    # Verify SKU exists in user's inventory
    inventory_sku_quantity_cte = get_sku_cost_quantity_cte(user_id=current_user.id)

    sku_check = session.execute(
        select(SKU.id)
        .join(inventory_sku_quantity_cte, SKU.id == inventory_sku_quantity_cte.c.sku_id)
        .where(SKU.id == sku_id)
    ).scalar_one_or_none()

    if not sku_check:
        raise HTTPException(status_code=404, detail="SKU not found in user inventory")

    # For now, return available marketplaces (currently only TCGPlayer)
    # TODO: In the future, this could query actual marketplace data availability
    marketplaces = ["TCGPlayer"]

    return InventorySkuMarketplacesResponseSchema(marketplaces=marketplaces)
