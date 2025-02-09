
from fastapi.testclient import TestClient

from app.main import app


def test_get_inventory():
    with TestClient(app) as client:
        response = client.get(
            url="/inventory",
        )

        print(response.json())

        assert response.status_code == 200, response.json()