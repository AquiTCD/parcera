
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from src.run_server import app, parcera_server

@pytest.fixture
def client():
    # Mock stt just in case
    parcera_server.stt = MagicMock()
    yield TestClient(app)

def test_get_training_status(client):
    with patch("routers.training_router.TrainingService") as mock_ts_cls:
        mock_ts = mock_ts_cls.return_value
        mock_ts.get_training_status.return_value = {"status": "idle"}
        
        response = client.get("/training/profiles/default/status")
        assert response.status_code == 200
        assert response.json()["status"] == "idle"

def test_reset_training_endpoint(client):
    with patch("routers.training_router.TrainingService") as mock_ts_cls:
        mock_ts = mock_ts_cls.return_value
        
        response = client.post("/training/profiles/default/reset")
        assert response.status_code == 200
        assert response.json()["success"] is True
        
        # Verify service method and reload called
        mock_ts.reset_training.assert_called_once()
        parcera_server.stt.reload.assert_called_once()
