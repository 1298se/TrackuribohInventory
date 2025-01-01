import uuid
from datetime import datetime
from decimal import Decimal

from fastapi.testclient import TestClient

from core.models.inventory import TransactionType
from src.main import app
from src.routes.transactions.api import TransactionProRataRequestSchema
from src.routes.transactions.schemas import TransactionCreateRequestSchema, \
    LineItemCreateRequestSchema, LineItemBaseSchema
from src.routes.utils import MoneySchema

test_sku_id = uuid.UUID("06770852-f60c-7f9e-8000-edad80b54f57")

def test_transaction_pro_rata():
    with TestClient(app) as client:
        json = TransactionProRataRequestSchema(
            line_items=[
                LineItemBaseSchema(
                    sku_id=test_sku_id,
                    quantity=3,
                )
            ],
            total_amount=MoneySchema(
                amount=Decimal("12345"),
                currency="USD",
            )
        ).model_dump_json()

        pro_rata_response_schema = client.post(
            url="/transactions/pro-rata/calculate",
            content=json,
        )

        print(pro_rata_response_schema.json())

        assert pro_rata_response_schema.status_code == 200


def test_create_and_get_transaction():
    with TestClient(app) as client:
        json = TransactionCreateRequestSchema(
                date=datetime.now(),
                type=TransactionType.PURCHASE,
                counterparty_name="Billy Bob",
                line_items=[
                    LineItemCreateRequestSchema(
                        sku_id=test_sku_id,
                        quantity=3,
                        price_per_item=MoneySchema(
                            amount=Decimal("12.34"),
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
