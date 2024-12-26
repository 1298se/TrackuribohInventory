from datetime import datetime

from fastapi.testclient import TestClient

from app.src.main import app
from core.models.inventory import TransactionType
from app.src.routes.transactions.schemas import TransactionCreateRequestSchema, \
    LineItemCreateRequestSchema



def test_create_and_get_transaction():
    with TestClient(app) as client:
        json = TransactionCreateRequestSchema(
                date=datetime.now(),
                type=TransactionType.PURCHASE,
                amount=420.69,
                counterparty_name="Billy Bob",
                line_items=[
                    LineItemCreateRequestSchema(
                        sku_id=2,
                        quantity=3,
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
