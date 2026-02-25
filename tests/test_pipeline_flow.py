import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock, patch
from src.run_server import ParceraServer

@pytest.fixture
def server():
    with patch("src.core.avatar.ParceraConfig") as MockConfig:
        mock_cfg = MockConfig.return_value
        mock_cfg.get.return_value = {}
        mock_cfg.profile_mode = False
        mock_cfg.app_data_dir = "/tmp/parcera_test"

        with patch("src.core.avatar.ParceraComponentFactory") as MockFactory:
            mock_factory = MockFactory.return_value
            mock_factory.build_llm.return_value = MagicMock()
            mock_factory.build_stt.return_value = MagicMock()
            mock_factory.build_tts.return_value = MagicMock()
            mock_factory.build_vad.return_value = MagicMock()

            with patch("src.run_server.SQLiteSessionStateManager"), \
                 patch("src.run_server.SQLitePerformanceRecorder"), \
                 patch("src.run_server.AIAvatarWebSocketServer"):

                server = ParceraServer()
                # Manually set some things for testing
                server.aiavatar_server = MagicMock()
                server.aiavatar_server.websockets = {}
                return server

@pytest.mark.anyio
async def test_flow_ignore_and_release(server):
    session_id = "session1"
    server.set_busy = MagicMock()

    # Simulate on_recognized being called with is_filtered=True
    # This happens when the STT component decides to ignore the text
    await server.on_recognized(session_id, "あ", is_filtered=True)

    # Assert: 1. set_busy(False) was called to release the earm immediately
    server.set_busy.assert_called_with(session_id, False)

@pytest.mark.anyio
async def test_tts_duration_estimation(server):
    session_id = "session1"
    server.set_busy = MagicMock()

    # We use a known string to verify the real calculate_weight integration
    # "テスト" -> Weight 3.0
    # Expected duration: (3.0 / 6.0) + 1.0 = 0.5 + 1.0 = 1.5

    sts_response = MagicMock()
    sts_response.type = "final"
    sts_response.text = "テスト"

    aiavatar_response = MagicMock()
    aiavatar_response.session_id = session_id

    await server.on_response(aiavatar_response, sts_response)

    assert server.set_busy.call_count > 0
    args, kwargs = server.set_busy.call_args
    assert args[0] == session_id
    assert args[1] == True
    assert kwargs["timeout"] == pytest.approx(1.5)
