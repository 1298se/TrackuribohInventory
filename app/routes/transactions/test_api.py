import uuid
from datetime import datetime
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.routes.transactions.api import TransactionProRataRequestSchema
from app.routes.transactions.schemas import LineItemBaseSchema, TransactionCreateRequestSchema, \
    LineItemCreateRequestSchema
from app.routes.utils import MoneySchema
from core.database import SessionLocal
from core.models import Product, SKU
from core.models.inventory import TransactionType

def test_get_transactions():
    with TestClient(app) as client:
        response = client.get("/transactions/")
        assert response.status_code == 200

def test_transaction_pro_rata():
    with TestClient(app) as client:
        test_sku = get_test_sku()
        json = TransactionProRataRequestSchema(
            line_items=[
                LineItemBaseSchema(
                    sku_id=test_sku.id,
                    quantity=3,
                )
            ],
            total_amount=MoneySchema(
                amount=Decimal("10.00"),
                currency="USD",
            )
        ).model_dump_json()

        pro_rata_response_schema = client.post(
            url="/transactions/pro-rata/calculate",
            content=json,
        )

        print(pro_rata_response_schema.json())

        assert pro_rata_response_schema.status_code == 200


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
                    price_per_item=MoneySchema(
                        amount=Decimal("10.00"),
                        currency="USD",
                    )
                )
            ]
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
                        price_per_item=MoneySchema(
                            amount=Decimal("20.00"),
                            currency="USD",
                        )
                    )
                ]
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

def get_test_sku() -> SKU:
    with SessionLocal() as session:
        return session.scalar(
            # 151 booster bundle
            select(SKU).where(SKU.tcgplayer_id == 7239001)
        )