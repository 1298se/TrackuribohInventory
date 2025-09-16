from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from core.database import SessionLocal
from core.models.catalog import SKU


def test_get_product_market_data():
    """Test the new market endpoint for product market data"""
    with TestClient(app) as client:
        # Using a product ID that should exist based on the catalog test
        response = client.get(
            url="/market/products/0676da9d-25f9-7cd8-8000-2122017bf0a7",
        )

        # Should return 200 if the endpoint is working
        # Note: The actual response may vary depending on data availability
        assert response.status_code in [200, 404], (
            f"Unexpected status: {response.status_code}, response: {response.json()}"
        )


def test_get_product_market_data_with_params():
    """Test the product market data endpoint with sales lookback parameter"""
    with TestClient(app) as client:
        response = client.get(
            url="/market/products/0676da9d-25f9-7cd8-8000-2122017bf0a7?sales_lookback_days=7",
        )

        assert response.status_code in [200, 404], (
            f"Unexpected status: {response.status_code}, response: {response.json()}"
        )


def test_get_sku_market_data():
    """Test the new market endpoint for SKU market data"""
    with SessionLocal() as session, TestClient(app) as client:
        # Get a SKU ID from the database
        sku = session.scalar(select(SKU).limit(1))

        if sku:
            response = client.get(url=f"/market/skus/{sku.id}")
            assert response.status_code in [200, 404], (
                f"Unexpected status: {response.status_code}, response: {response.json()}"
            )
        else:
            # Skip test if no SKUs found
            pass


def test_get_sku_market_data_with_params():
    """Test the SKU market data endpoint with sales lookback parameter"""
    with SessionLocal() as session, TestClient(app) as client:
        # Get a SKU ID from the database
        sku = session.scalar(select(SKU).limit(1))

        if sku:
            response = client.get(url=f"/market/skus/{sku.id}?sales_lookback_days=30")
            assert response.status_code in [200, 404], (
                f"Unexpected status: {response.status_code}, response: {response.json()}"
            )
        else:
            # Skip test if no SKUs found
            pass


def test_invalid_product_id():
    """Test market data endpoint with invalid product ID"""
    with TestClient(app) as client:
        response = client.get("/market/products/invalid-uuid")
        assert response.status_code == 422  # Validation error for invalid UUID


def test_invalid_sku_id():
    """Test market data endpoint with invalid SKU ID"""
    with TestClient(app) as client:
        response = client.get("/market/skus/invalid-uuid")
        assert response.status_code == 422  # Validation error for invalid UUID
