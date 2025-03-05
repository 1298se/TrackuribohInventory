import uuid
from datetime import datetime
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.routes.transactions.schemas import BulkTransactionDeleteRequestSchema, LineItemBaseSchema, TransactionCreateRequestSchema, \
    LineItemCreateRequestSchema
from app.routes.utils import MoneyAmountSchema, MoneySchema
from core.database import SessionLocal
from core.models import Product, SKU
from core.models.transaction import TransactionType

def test_get_transactions():
    with TestClient(app) as client:
        response = client.get("/transactions/")
        assert response.status_code == 200


def test_create_purchase_transaction():
    with TestClient(app) as client:
        test_sku = get_test_sku()

        json = TransactionCreateRequestSchema(
            date=datetime.now(),
            type=TransactionType.PURCHASE,
            counterparty_name="Billy Bob",
            line_items=[
                LineItemCreateRequestSchema(
                    sku_id=test_sku.id,
                    quantity=3,
                    price_per_item_amount=MoneyAmountSchema("10.00")
                )
            ],
            currency="USD",
        ).model_dump_json()

        create_transaction_response = client.post(
            url="/transactions/",
            content=json,
        )

        assert create_transaction_response.status_code == 200, create_transaction_response.json()


def test_create_sale_transaction():
    with TestClient(app) as client:
        test_sku = get_test_sku()

        json = TransactionCreateRequestSchema(
                date=datetime.now(),
                type=TransactionType.SALE,
                counterparty_name="Billy Bob",
                line_items=[
                    LineItemCreateRequestSchema(
                        sku_id=test_sku.id,
                        quantity=5,
                        price_per_item_amount=MoneyAmountSchema("20.00")
                    )
                ],
                currency="USD",
            ).model_dump_json()

        create_transaction_response = client.post(
            url="/transactions/",
            content=json,
        )

        assert create_transaction_response.status_code == 200, create_transaction_response.json()

        get_transaction_response = client.get(
            url=f"/transactions/{create_transaction_response.json()["id"]}"
        )

        print(get_transaction_response.json())

        assert get_transaction_response.status_code == 200, get_transaction_response.json()

def test_bulk_delete_transaction():
    with TestClient(app) as client:
        # First, create a transaction that we will later delete via the bulk delete endpoint.
        test_sku = get_test_sku()

        json = TransactionCreateRequestSchema(
            date=datetime.now(),
            type=TransactionType.PURCHASE,
            counterparty_name="Billy Bob",
            line_items=[
                LineItemCreateRequestSchema(
                    sku_id=test_sku.id,
                    quantity=3,
                    price_per_item_amount=MoneyAmountSchema("10.00")
                )
            ],
            currency="USD",
        ).model_dump_json()

        create_transaction_response = client.post(
            url="/transactions/",
            content=json,
        )

        assert create_transaction_response.status_code == 200, create_transaction_response.json()
        transaction_id = create_transaction_response.json()["id"]

        # Now, test the bulk deletion endpoint by removing the created transaction.
        bulk_delete_payload = BulkTransactionDeleteRequestSchema(
            transaction_ids=[transaction_id]
        ).model_dump_json()

        delete_response = client.post(
            url="/transactions/bulk",
            content=bulk_delete_payload,
        )
        assert delete_response.status_code == 204, delete_response.text

def test_bulk_delete_fail_on_insufficient_inventory():
    with TestClient(app) as client:
        # Create a transaction with insufficient inventory
        test_sku = get_test_sku()

        json = TransactionCreateRequestSchema(
            date=datetime.now(),
            type=TransactionType.PURCHASE,
            counterparty_name="Billy Bob",
            line_items=[
                LineItemCreateRequestSchema(
                    sku_id=test_sku.id,
                    quantity=1,
                    price_per_item_amount=MoneyAmountSchema("10.00")
                )
            ],
            currency="USD",
        ).model_dump_json()

        purchase_response = client.post(
            url="/transactions/",
            content=json,
        )
        
        sale = TransactionCreateRequestSchema(
            date=datetime.now(),
            type=TransactionType.SALE,
            counterparty_name="Billy Bob",
            line_items=[LineItemCreateRequestSchema(sku_id=test_sku.id, quantity=1, price_per_item_amount=MoneyAmountSchema("10.00"))],
            currency="USD",
        ).model_dump_json()

        client.post(
            url="/transactions/",
            content=sale,
        )

        bulk_delete_payload = BulkTransactionDeleteRequestSchema(
            transaction_ids=[purchase_response.json()["id"]]
        ).model_dump_json()

        delete_response = client.post(
            url="/transactions/bulk",
            content=bulk_delete_payload,
        )

        assert delete_response.status_code == 400, delete_response.json()

def test_bulk_delete_sale_and_purchase_simultaneous():
    with TestClient(app) as client:
        # Create a purchase transaction
        test_sku = get_test_sku()

        purchase_json = TransactionCreateRequestSchema(
            date=datetime.now(),
            type=TransactionType.PURCHASE,
            counterparty_name="Billy Bob",
            line_items=[
                LineItemCreateRequestSchema(
                    sku_id=test_sku.id,
                    quantity=3,
                    price_per_item_amount=MoneyAmountSchema("10.00")
                )
            ],
            currency="USD",
        ).model_dump_json()

        purchase_response = client.post(
            url="/transactions/",
            content=purchase_json,
        )

        sale_json = TransactionCreateRequestSchema(
            date=datetime.now(),
            type=TransactionType.SALE,
            counterparty_name="Billy Bob",
            line_items=[LineItemCreateRequestSchema(sku_id=test_sku.id, quantity=3, price_per_item_amount=MoneyAmountSchema("10.00"))],
            currency="USD",
        ).model_dump_json()

        sale_response = client.post(
            url="/transactions/",
            content=sale_json,
        )

        bulk_delete_payload = BulkTransactionDeleteRequestSchema(
            transaction_ids=[purchase_response.json()["id"], sale_response.json()["id"]]
        ).model_dump_json()

        delete_response = client.post(
            url="/transactions/bulk",
            content=bulk_delete_payload,
        )

        assert delete_response.status_code == 204, delete_response.text

def get_test_sku() -> SKU:
    with SessionLocal() as session:
        return session.scalar(
            # 151 booster bundle
            select(SKU).where(SKU.tcgplayer_id == 7239001)
        )