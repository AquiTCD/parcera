import pytest
import os
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient

# Mock components before importing app
with patch("src.core.avatar.ParceraComponentFactory") as MockFactory:
    # Setup mock factory
    mock_factory = MockFactory.return_value
    mock_factory.build_llm.return_value = MagicMock()
    mock_factory.build_stt.return_value = MagicMock()
    mock_factory.build_tts.return_value = MagicMock()
    mock_factory.build_vad.return_value = MagicMock()

    # Import app and server instance
    from src.run_server import app, parcera_server

@pytest.fixture
def client():
    return TestClient(app)

def test_health_check_endpoint(client):
    # Mock httpx to avoid real network call in health check
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_get.return_value = MagicMock(status_code=200)
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "tts_engine": True}

def test_reload_config_endpoint(client):
    # Mock nested objects
    parcera_server.config = MagicMock()
    parcera_server.current_stt_provider = "faster_whisper"
    parcera_server.current_tts_provider = "aivisspeech"
    parcera_server.apply_runtime_config = MagicMock()
    parcera_server._sync_to_server = MagicMock()

    new_settings = {
        "stt": {"provider": "faster_whisper"},
        "tts": {"provider": "aivisspeech"},
        "ai_profile": {"name": "TestAI"}
    }

    # Mock config.get to return values from our new_settings
    def mock_get(key, default=None):
        return new_settings.get(key, default)
    parcera_server.config.get.side_effect = mock_get

    response = client.post("/config/reload", json=new_settings)

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["restart_required"] == False

    # Verify internal calls
    parcera_server.config.refresh.assert_called_with(new_settings)
    parcera_server.apply_runtime_config.assert_called()
    parcera_server._sync_to_server.assert_called()

def test_reload_config_restart_required(client):
    parcera_server.config = MagicMock()
    parcera_server.current_stt_provider = "faster_whisper"
    parcera_server.current_tts_provider = "aivisspeech"

    # Change provider to trigger restart_required
    new_settings = {
        "stt": {"provider": "openai"},
        "tts": {"provider": "voicevox"}
    }

    def mock_get(key, default=None):
        return new_settings.get(key, default)
    parcera_server.config.get.side_effect = mock_get

    response = client.post("/config/reload", json=new_settings)

    assert response.status_code == 200
    data = response.json()
    assert data["restart_required"] == True

def test_get_tts_speakers_endpoint(client):
    # Mock config settings
    parcera_server.config.settings = {
        "tts": {
            "providers": {
                "voicevox": {
                    "api_url": "http://localhost:50021",
                    "engine_path": "/path/to/engine"
                }
            }
        }
    }
    parcera_server.current_tts_provider = "aivisspeech" # Different from requested

    # Mock success on first try (engine already running)
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_get.return_value = MagicMock(status_code=200)
        mock_get.return_value.json.return_value = [{"name": "Speaker 1"}]

        response = client.get("/tts/speakers?provider=voicevox")
        assert response.status_code == 200
        assert response.json() == [{"name": "Speaker 1"}]

def test_get_tts_speakers_with_temp_start(client):
    # Mock config
    parcera_server.config.settings = {
        "tts": {
            "providers": {
                "voicevox": {
                    "api_url": "http://localhost:50021",
                    "engine_path": "/path/to/engine"
                }
            }
        }
    }
    parcera_server.current_tts_provider = "aivisspeech"

    # Mock flow: 1. Fail first check, 2. Start engine, 3. Succeed second check, 4. Stop engine
    with patch("httpx.AsyncClient.get") as mock_get:
        # First call fails (ConnectError), second succeeds
        mock_get.side_effect = [
            Exception("Connection refused"), # First check
            MagicMock(status_code=200, json=lambda: [{"name": "Temp Speaker"}]) # Second check after start
        ]

        with patch("src.run_server.TTSEngineManager") as MockManager:
            mock_manager = MockManager.return_value
            mock_manager.start = AsyncMock()
            mock_manager.stop = AsyncMock()

            with patch("os.path.exists", return_value=True):
                response = client.get("/tts/speakers?provider=voicevox")

                assert response.status_code == 200
                assert response.json() == [{"name": "Temp Speaker"}]
                mock_manager.start.assert_called()
                mock_manager.stop.assert_called() # Should stop because it's not active provider
