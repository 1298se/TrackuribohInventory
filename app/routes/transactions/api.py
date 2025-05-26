import uuid
from typing import List, Dict, Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.routes.transactions.service import (
    create_transaction_service,
    get_transaction_metrics,
)
from core.dao.transaction import (
    InsufficientInventoryError,
    create_transaction_line_items,
    delete_transaction_line_items,
    delete_transactions,
    TransactionNotFoundError,
    LineItemData,
    LineItemUpdateSpec,
    bulk_update_transaction_line_items,
    TransactionFilterParams,
    get_transaction_filter_options as dao_get_transaction_filter_options,
    build_filtered_transactions_query,
)
from app.routes.transactions.schemas import (
    TransactionResponseSchema,
    TransactionCreateRequestSchema,
    TransactionsResponseSchema,
    BulkTransactionDeleteRequestSchema,
    TransactionUpdateRequestSchema,
    PlatformResponseSchema,
    PlatformCreateRequestSchema,
    WeightedPriceCalculationRequestSchema,
    WeightedPriceCalculationResponseSchema,
    CalculatedWeightedLineItemSchema,
    TransactionMetricsResponseSchema,
    TransactionFilterOptionsResponseSchema,
)
from core.database import get_db_session
from core.models.transaction import Transaction, LineItem, Platform, TransactionType
from core.services.create_transaction import (
    LineItemInput,
    calculate_weighted_unit_prices,
)
from core.services.tcgplayer_catalog_service import (
    TCGPlayerCatalogService,
    get_tcgplayer_catalog_service,
)

router = APIRouter(
    prefix="/transactions",
)


@router.get("/metrics", response_model=TransactionMetricsResponseSchema)
async def get_transactions_metrics(session: Session = Depends(get_db_session)):
    """Get aggregate metrics for all transactions."""
    metrics = get_transaction_metrics(session=session)
    return TransactionMetricsResponseSchema(**metrics)


@router.get("/platforms", response_model=list[PlatformResponseSchema])
async def get_platforms(session: Session = Depends(get_db_session)):
    """Get all available platforms."""
    platforms = session.query(Platform).all()
    return platforms


@router.post("/platforms", response_model=PlatformResponseSchema, status_code=201)
async def create_platform(
    request: PlatformCreateRequestSchema, session: Session = Depends(get_db_session)
):
    """Create a new platform."""
    with session.begin():
        platform = Platform(name=request.name)
        session.add(platform)

    session.refresh(platform)
    return platform


@router.get("/", response_model=TransactionsResponseSchema)
async def get_transactions(
    # Existing search parameter
    q: Optional[str] = Query(None, description="Search query"),
    # New filter parameters
    date_start: Optional[date] = Query(None, description="Start date"),
    date_end: Optional[date] = Query(None, description="End date"),
    types: Optional[List[TransactionType]] = Query(
        None, description="Transaction types"
    ),
    platform_ids: Optional[List[str]] = Query(None, description="Platform IDs"),
    include_no_platform: bool = Query(False, description="Include no platform"),
    amount_min: Optional[float] = Query(None, description="Minimum amount"),
    amount_max: Optional[float] = Query(None, description="Maximum amount"),
    # Dependencies
    session: Session = Depends(get_db_session),
):
    """Get transactions with optional filtering"""

    # Build filter params from query parameters
    filter_params = TransactionFilterParams(
        search_query=q,
        date_start=date_start,
        date_end=date_end,
        types=types,
        platform_ids=[uuid.UUID(pid) for pid in platform_ids] if platform_ids else None,
        include_no_platform=include_no_platform,
        amount_min=amount_min,
        amount_max=amount_max,
    )

    # Build the filtered query and execute
    query = build_filtered_transactions_query(session, filter_params)
    transactions = query.options(*TransactionResponseSchema.get_load_options()).all()

    # Convert to response schema
    return TransactionsResponseSchema(
        transactions=[TransactionResponseSchema.from_orm(t) for t in transactions],
    )


@router.get("/filter-options", response_model=TransactionFilterOptionsResponseSchema)
async def get_transaction_filter_options(
    catalog_id: Optional[str] = Query(None, description="Catalog ID"),
    session: Session = Depends(get_db_session),
):
    """Get available options for transaction filters"""

    options = dao_get_transaction_filter_options(
        session, uuid.UUID(catalog_id) if catalog_id else None
    )

    return TransactionFilterOptionsResponseSchema(**options)


@router.get("/{transaction_id}", response_model=TransactionResponseSchema)
async def get_transaction(
    transaction_id: uuid.UUID, session: Session = Depends(get_db_session)
):
    transaction = session.scalar(
        select(Transaction)
        .options(*TransactionResponseSchema.get_load_options())
        .where(Transaction.id == transaction_id)
    )

    return transaction


@router.post("/", response_model=TransactionResponseSchema)
async def create_transaction(
    request: TransactionCreateRequestSchema,
    catalog_service: TCGPlayerCatalogService = Depends(get_tcgplayer_catalog_service),
    session: Session = Depends(get_db_session),
):
    try:
        # Start a transaction explicitly
        with session.begin():
            transaction = await create_transaction_service(
                request, catalog_service, session
            )

        # Reload transaction with the appropriate load options
        transaction = session.scalar(
            select(Transaction)
            .options(*TransactionResponseSchema.get_load_options())
            .where(Transaction.id == transaction.id)
        )

        return transaction
    except InsufficientInventoryError:
        raise HTTPException(
            status_code=400, detail="Not enough inventory to complete sale"
        )


@router.post("/bulk", status_code=204)
async def bulk_delete_transactions(
    request: BulkTransactionDeleteRequestSchema,
    session: Session = Depends(get_db_session),
):
    try:
        with session.begin():
            delete_transactions(session, request.transaction_ids)
    except TransactionNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except InsufficientInventoryError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{transaction_id}", response_model=TransactionResponseSchema)
async def update_transaction(
    transaction_id: uuid.UUID,
    request: TransactionUpdateRequestSchema,
    session: Session = Depends(get_db_session),
):
    # Start a transaction explicitly
    with session.begin():
        # Step 1: Retrieve the transaction
        # Eager load line items to avoid extra queries
        transaction = session.get(
            Transaction, transaction_id, options=[joinedload(Transaction.line_items)]
        )

        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")

        # Step 2: Update basic transaction properties (Simplified: Always assign)
        transaction.date = request.date
        transaction.counterparty_name = request.counterparty_name
        # Normalize blank comment to null
        transaction.comment = request.comment or None
        transaction.currency = request.currency
        transaction.platform_id = request.platform_id
        transaction.platform_order_id = request.platform_order_id
        transaction.shipping_cost_amount = request.shipping_cost_amount
        transaction.tax_amount = request.tax_amount

        # Step 3: Prepare lookups for line item comparison
        existing_items_map: Dict[uuid.UUID, LineItem] = {
            item.id: item for item in transaction.line_items
        }
        # Assuming request.line_items are Pydantic models with .id attribute
        request_items_map: Dict[
            uuid.UUID, TransactionUpdateRequestSchema.LineItemSchema
        ] = {item.id: item for item in request.line_items if item.id is not None}

        # Step 4: Identify changes
        ids_to_delete: List[uuid.UUID] = []
        items_to_update: List[LineItemUpdateSpec] = []
        items_to_add: List[LineItemData] = []

        # Identify deletions (and sku changes treated as delete+add)
        for existing_id, existing_item in existing_items_map.items():
            request_item = request_items_map.get(existing_id)
            if not request_item or request_item.sku_id != existing_item.sku_id:
                ids_to_delete.append(existing_id)

        # Identify additions and updates
        for request_item in request.line_items:
            existing_item = (
                existing_items_map.get(request_item.id) if request_item.id else None
            )

            if not existing_item or request_item.sku_id != existing_item.sku_id:
                # This is a new item or an existing item with a changed SKU (treat as add)
                items_to_add.append(
                    LineItemData(
                        sku_id=request_item.sku_id,
                        quantity=request_item.quantity,
                        unit_price_amount=request_item.unit_price_amount,
                        # ID is omitted for new items
                    )
                )
            elif (
                request_item.quantity != existing_item.quantity
                or request_item.unit_price_amount != existing_item.unit_price_amount
            ):
                # This is an existing item with changed quantity or price (treat as update)
                items_to_update.append(
                    LineItemUpdateSpec(
                        line_item_id=existing_item.id,  # Must have ID here
                        quantity=request_item.quantity,
                        unit_price_amount=request_item.unit_price_amount,
                    )
                )
            # Else: Item exists, SKU matches, quantity and price match -> No change needed

        # Step 5 & 6: Execute changes
        if ids_to_delete or items_to_update or items_to_add:
            try:
                # Execute in order: Delete -> Update -> Add
                if ids_to_delete:
                    delete_transaction_line_items(
                        session, transaction.type, ids_to_delete
                    )
                    session.flush()  # Flush deletions so subsequent operations see the changes

                if items_to_update:
                    bulk_update_transaction_line_items(
                        session=session,
                        transaction_type=transaction.type,
                        updates=items_to_update,
                    )
                    session.flush()  # Flush updates so subsequent operations see the changes

                if items_to_add:
                    create_transaction_line_items(
                        session=session,
                        transaction_id=transaction.id,
                        transaction_type=transaction.type,
                        line_items_data=items_to_add,
                    )

            except (InsufficientInventoryError, NotImplementedError) as e:
                # Will be rollback by the session.begin() context manager
                raise HTTPException(status_code=400, detail=str(e))
            except Exception as e:
                # Will be rollback by the session.begin() context manager
                # Log e
                raise HTTPException(
                    status_code=500,
                    detail=f"An unexpected error occurred during transaction update: {e}",
                )

    # Step 7: Reload transaction with the appropriate load options for the response
    # Need to create a new transaction here since we're outside the previous one
    refreshed_transaction = session.scalar(
        select(Transaction)
        .options(*TransactionResponseSchema.get_load_options())
        .where(Transaction.id == transaction_id)
    )

    return refreshed_transaction


@router.post(
    "/calculate-weighted-line-item-prices",
    response_model=WeightedPriceCalculationResponseSchema,
)
async def calculate_weighted_prices(
    request: WeightedPriceCalculationRequestSchema,
    session: Session = Depends(get_db_session),
    catalog_service: TCGPlayerCatalogService = Depends(get_tcgplayer_catalog_service),
):
    """Calculate unit prices by distributing total amount based on market price weighting."""

    core_line_items = [
        LineItemInput(sku_id=item.sku_id, quantity=item.quantity)
        for item in request.line_items
    ]

    try:
        # Function now returns List[LineItemData]
        calculated_data: List[LineItemData] = await calculate_weighted_unit_prices(
            session=session,
            catalog_service=catalog_service,
            line_items=core_line_items,
            total_amount=request.total_amount,
        )
    except Exception as e:
        # Log the error e
        raise HTTPException(
            status_code=500, detail=f"Error during price calculation: {e}"
        )

    # Map the result (List[LineItemData]) to the response schema using attribute access
    response_items = [
        CalculatedWeightedLineItemSchema(
            sku_id=item.sku_id,  # Use attribute access
            quantity=item.quantity,  # Use attribute access
            unit_price_amount=item.unit_price_amount,  # Use attribute access
        )
        for item in calculated_data
    ]

    return WeightedPriceCalculationResponseSchema(calculated_line_items=response_items)
