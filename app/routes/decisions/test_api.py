from fastapi.testclient import TestClient

from app.main import app


def test_get_buy_decisions():
    """Test that the buy-decisions endpoint works and returns valid response."""
    with TestClient(app) as client:
        response = client.get("/buy-decisions")

        assert response.status_code == 200, response.json()
        data = response.json()

        # Should return valid structure
        assert "decisions" in data
        assert "total_count" in data
        assert "filters_applied" in data
