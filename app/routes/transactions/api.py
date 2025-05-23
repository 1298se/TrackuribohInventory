import uuid
from typing import List, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, select
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
)
from core.database import get_db_session
from core.models.transaction import Transaction, LineItem, Platform
from core.models.catalog import SKU, Product
from core.services.create_transaction import (
    LineItemInput,
    calculate_weighted_unit_prices,
)
from core.services.tcgplayer_catalog_service import (
    TCGPlayerCatalogService,
    get_tcgplayer_catalog_service,
)
from core.dao.catalog import create_product_set_fts_vector

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
    query: str | None = None, session: Session = Depends(get_db_session)
):
    # Step 1: Apply filters and sorting to get a list of matching transaction IDs
    base_id_query = (
        select(Transaction.id)  # Include date in the SELECT list
        .outerjoin(Transaction.line_items)
        .outerjoin(LineItem.sku)
        .outerjoin(SKU.product)
        # Join Set table for full-text search vector fields
        .outerjoin(Product.set)
    )

    # Only apply the filter if query is provided
    if query:
        # Split the search query into terms
        search_terms = query.split()

        if search_terms:
            # Define text search vectors with weights for different columns
            counterparty_ts_vector = func.setweight(
                func.to_tsvector(
                    "english", func.coalesce(Transaction.counterparty_name, "")
                ),
                "A",
            )
            product_ts_vector = create_product_set_fts_vector()

            # Combine the vectors
            combined_ts_vector = counterparty_ts_vector.op("||")(product_ts_vector)

            # Create TS query with prefix matching support
            prefix_terms = [term + ":*" for term in search_terms]
            ts_query = func.to_tsquery("english", " & ".join(prefix_terms))

            # Add text search condition to the query
            base_id_query = base_id_query.where(combined_ts_vector.op("@@")(ts_query))

            # Calculate rank for sorting
            combined_rank = func.ts_rank(combined_ts_vector, ts_query)

            # Add ranking as first ordering criterion, followed by date
            base_id_query = base_id_query.order_by(
                combined_rank.desc(), desc(Transaction.date)
            )
        else:
            # If query is provided but empty, just order by date
            base_id_query = base_id_query.order_by(desc(Transaction.date))
    else:
        # If no query is provided, just order by date
        base_id_query = base_id_query.order_by(desc(Transaction.date))

    # Execute the first query to get just the IDs
    result = session.execute(base_id_query).all()
    transaction_ids = [
        row[0] for row in result
    ]  # Extract just the IDs from the result tuples

    # Step 2: If we have matching IDs, query for full transaction data with load options
    if not transaction_ids:
        # Return empty result if no matches
        return TransactionsResponseSchema(transactions=[])

    # Query for full transaction data with the matched IDs
    transactions_query = (
        select(Transaction)
        .where(Transaction.id.in_(transaction_ids))
        .options(*TransactionResponseSchema.get_load_options())
    )

    # Execute the second query to get the full data
    transactions = session.scalars(transactions_query).all()

    # Sort transactions by the position of their id in transaction_ids
    transactions.sort(key=lambda transaction: transaction_ids.index(transaction.id))

    return TransactionsResponseSchema(transactions=transactions)


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
