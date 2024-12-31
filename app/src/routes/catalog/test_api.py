from src.main import app

from fastapi.testclient import TestClient

def test_get_product():
    with TestClient(app) as client:
        response = client.get(
            url="/catalog/product/0676da9d-25f9-7cd8-8000-2122017bf0a7",
        )

        assert response.status_code == 200, response.json()

def test_search_products():
    with TestClient(app) as client:
        response = client.get(
            url="/catalog/search?query=Blue Eyes"
        )

        print(response.json()["results"])

        assert response.status_code == 200, response.json()