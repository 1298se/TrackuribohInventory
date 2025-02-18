from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from core.database import SessionLocal
from core.models.catalog import Catalog


def test_get_product():
    with TestClient(app) as client:
        response = client.get(
            url="/catalog/product/0676da9d-25f9-7cd8-8000-2122017bf0a7",
        )

        assert response.status_code == 200, response.json()

def test_search_products():
    with SessionLocal() as session, TestClient(app) as client:
        pokemon_catalog = session.scalar(select(Catalog).where(Catalog.tcgplayer_id == 3))

        response = client.get(
            url=f"/catalog/search?query=Blue Eyes&catalog_id={pokemon_catalog.id}"
        )

        assert response.status_code == 200, response.json()

def test_get_catalogs():
    with TestClient(app) as client:
        response = client.get("/catalog/catalogs")
        assert response.status_code == 200, response.json()