from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid_extensions import uuid7

from core.models.database import get_db_session
from core.models.inventory import LineItem, Transaction
from src.routes.transactions.schemas import TransactionCreateRequestSchema, \
    TransactionResponseSchema
from src.routes.transactions.dao import get_skus_by_id
from core.services.tcgplayer_catalog_service import TCGPlayerCatalogService, get_tcgplayer_catalog_service

router = APIRouter(
    prefix="/transactions",
)

@router.get("/{transaction_id}", response_model=TransactionResponseSchema)
async def get_transaction(transaction_id: str, session: Session = Depends(get_db_session)):
    transaction = session.get(Transaction, transaction_id)

    return transaction

@router.post("/", response_model=TransactionResponseSchema)
async def create_transaction(
    request: TransactionCreateRequestSchema,
    catalog_service: TCGPlayerCatalogService = Depends(get_tcgplayer_catalog_service),
    session: Session = Depends(get_db_session),
):
    transaction_id = uuid7()
    transaction = Transaction(
        id=transaction_id,
        date=request.date,
        type=request.type,
        counterparty_name=request.counterparty_name,
    )

    session.add(transaction)

    sku_id_to_tcgplayer_id = {
        sku.id: sku.tcgplayer_id
        for sku in get_skus_by_id(session, ids=[line_item.sku_id for line_item in request.line_items])
    }

    # TODO: Should cache this in redis
    sku_prices = await catalog_service.get_sku_prices([tcgplayer_id for tcgplayer_id in sku_id_to_tcgplayer_id.values()])

    transaction_total_market_price = sum([sku_price.lowest_listing_price_total for sku_price in sku_prices.results])

    sku_tcgplayer_id_to_lowest_price = {
        sku_price.sku_id: sku_price.lowest_listing_price_total
        for sku_price in sku_prices.results
    }

    ratio = request.amount / transaction_total_market_price

    line_items = [
        LineItem(
            transaction_id=transaction_id,
            sku_id=line_item.sku_id,
            quantity=line_item.quantity,
            amount=sku_tcgplayer_id_to_lowest_price[sku_id_to_tcgplayer_id[line_item.sku_id]] * ratio,
        )
        for line_item in request.line_items
    ]

    session.add_all(line_items)

    session.commit()

    return transaction

