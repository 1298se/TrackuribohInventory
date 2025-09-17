from fastapi.testclient import TestClient

from app.main import app


PRISMATIC_EVOLUTIONS_BB_PRODUCT_ID = "067859c3-a6e2-77f2-8000-271ddf8762d3"


def test_get_product_market_data():
    """Test the market endpoint for product market data"""
    with TestClient(app) as client:
        response = client.get(
            url=f"/market/products/{PRISMATIC_EVOLUTIONS_BB_PRODUCT_ID}",
        )
        assert response.status_code in [200, 404], (
            f"Unexpected status: {response.status_code}, response: {response.json()}"
        )


def test_get_product_market_data_with_params():
    """Test the product market data endpoint with sales lookback parameter"""
    with TestClient(app) as client:
        response = client.get(
            url=f"/market/products/{PRISMATIC_EVOLUTIONS_BB_PRODUCT_ID}?sales_lookback_days=7",
        )
        assert response.status_code in [200, 404], (
            f"Unexpected status: {response.status_code}, response: {response.json()}"
        )


def test_get_product_listings():
    with TestClient(app) as client:
        response = client.get(
            url=f"/market/product/{PRISMATIC_EVOLUTIONS_BB_PRODUCT_ID}/listings",
            params={"marketplace": "tcgplayer"},
        )
        assert response.status_code in [200, 404], response.json()
        data = response.json()
        # Results may be empty depending on external API availability
        assert "results" in data


def test_get_product_sales():
    with TestClient(app) as client:
        response = client.get(
            url=f"/market/product/{PRISMATIC_EVOLUTIONS_BB_PRODUCT_ID}/sales",
            params={"marketplace": "tcgplayer"},
        )
        assert response.status_code in [200, 404], response.json()
        data = response.json()
        assert "results" in data
