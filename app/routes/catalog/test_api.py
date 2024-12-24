from app.main import app

from fastapi.testclient import TestClient

def test_get_product():
    with TestClient(app) as client:
        response = client.get(
            url="/catalog/product/06743503-43ad-79f0-8000-54adacfea7a2",
        )

        print(response.json())

        assert response.status_code == 200, response.json()
        assert response.json()["tcgplayer_url"] == "www.tcgplayer.com/product/554935"
        assert len(response.json()["skus"]) == 5