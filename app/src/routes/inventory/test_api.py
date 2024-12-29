from app.src.main import app

from fastapi.testclient import TestClient

def test_get_inventory():
    with TestClient(app) as client:
        response = client.get(
            url="/inventory",
        )

        assert response.status_code == 200, response.json()