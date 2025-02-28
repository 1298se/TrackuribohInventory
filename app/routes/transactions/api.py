import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.routes.transactions.dao import (
    InsufficientInventoryError,
    process_sale_line_items,
    delete_transactions, TransactionNotFoundError
)
from app.routes.transactions.schemas import (
    TransactionResponseSchema,
    TransactionCreateRequestSchema,
    TransactionsResponseSchema,
    BulkTransactionDeleteRequestSchema
)
from core.dao.skus import get_skus_by_id
from core.database import get_db_session
from core.models import TransactionType
from core.models.inventory import Transaction, LineItem
from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService, get_tcgplayer_catalog_service

router = APIRouter(
    prefix="/transactions",
)

@router.get("/", response_model=TransactionsResponseSchema)
async def get_transactions(session: Session = Depends(get_db_session)):
    transactions = session.scalars(select(Transaction).order_by(desc(Transaction.date)).options(
        *TransactionResponseSchema.get_load_options()
    )).all()
    return TransactionsResponseSchema(transactions=transactions)


@router.get("/{transaction_id}", response_model=TransactionResponseSchema)
async def get_transaction(transaction_id: uuid.UUID, session: Session = Depends(get_db_session)):
    transaction = session.scalar(
        select(Transaction)
        .options(*TransactionResponseSchema.get_load_options())
        .where(Transaction.id == transaction_id)
    )

    return transaction


@router.post("/", response_model=TransactionResponseSchema)
async def create_transaction(
        request: TransactionCreateRequestSchema,
        background_tasks: BackgroundTasks,
        catalog_service: TCGPlayerCatalogService = Depends(get_tcgplayer_catalog_service),
        session: Session = Depends(get_db_session),
):
    transaction = Transaction(
        date=request.date,
        type=request.type,
        counterparty_name=request.counterparty_name,
        comment=request.comment,
        currency=request.currency,
        shipping_cost_amount=request.shipping_cost_amount,
    )

    session.add(transaction)

    session.flush()

    sku_id_to_tcgplayer_id = {
        sku.id: sku.tcgplayer_id
        for sku in get_skus_by_id(session, ids=[line_item.sku_id for line_item in request.line_items])
    }

    line_items_by_tcgplayer_id = {
        sku_id_to_tcgplayer_id[line_item.sku_id]: line_item
        for line_item in request.line_items
    }

    # TODO: Should update this
    sku_prices = await catalog_service.get_sku_prices(
        [tcgplayer_id for tcgplayer_id in sku_id_to_tcgplayer_id.values()])

    transaction_total_market_price = sum(
        [sku_price.lowest_listing_price_total * line_items_by_tcgplayer_id[sku_price.sku_id].quantity for sku_price in
         sku_prices.results]
    )

    tcgplayer_id_to_lowest_price = {
        sku_price.sku_id: sku_price.lowest_listing_price_total
        for sku_price in sku_prices.results
    }

    ratio = request.total_amount / transaction_total_market_price


    line_items = [
        LineItem(
            transaction_id=transaction.id,
            sku_id=line_item.sku_id,
            quantity=line_item.quantity,
            price_per_item_amount=tcgplayer_id_to_lowest_price[sku_id_to_tcgplayer_id[line_item.sku_id]] * ratio,
        )
        for line_item in request.line_items
    ]

    session.add_all(line_items)
    # Flush to get LineItem ids
    session.flush()

    match request.type:
        case TransactionType.PURCHASE:
            for line_item in line_items:
                line_item.remaining_quantity = line_item.quantity

        case TransactionType.SALE:
                try:
                    process_sale_line_items(session, line_items)
                except InsufficientInventoryError:
                    raise HTTPException(status_code=400, detail="Not enough inventory to complete sale")

    session.commit()

    # Reload transaction with the appropriate load options
    transaction = session.scalar(
        select(Transaction)
        .options(*TransactionResponseSchema.get_load_options())
        .where(Transaction.id == transaction.id)
    )

    return transaction


@router.post("/bulk", status_code=204)
async def bulk_delete_transactions(
    request: BulkTransactionDeleteRequestSchema,
    session: Session = Depends(get_db_session),
):
    try:
        delete_transactions(session, request.transaction_ids)
    except TransactionNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except InsufficientInventoryError as e:
        raise HTTPException(status_code=400, detail=str(e))

    session.commit()
