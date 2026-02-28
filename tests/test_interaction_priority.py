import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from core.interaction import InteractionController

@pytest.fixture
def mock_avatar():
    avatar = MagicMock()
    avatar.is_busy = MagicMock(return_value=False)
    avatar.set_busy = MagicMock()
    avatar.aiavatar_server = MagicMock()
    avatar.aiavatar_server.websockets = {}
    return avatar

@pytest.fixture
def mock_config():
    config = MagicMock()
    config.profile_mode = False
    config.refresh = MagicMock(return_value=False)
    return config

@pytest.mark.anyio
async def test_on_recognized_drops_when_twitch_busy(mock_avatar, mock_config):
    controller = InteractionController(mock_avatar, mock_config)

    # Simulate AI busy with Twitch
    mock_avatar.is_busy.side_effect = lambda source=None: source == "twitch"

    await controller.on_recognized("session", "Hello")

    # Should call set_busy(False) to clear the flag for the dropped session
    mock_avatar.set_busy.assert_called_once_with("session", False)

@pytest.mark.anyio
async def test_on_response_sets_source_correctly(mock_avatar, mock_config):
    mock_config.get.return_value = {"chars_per_second": 6.0, "buffer_latency": 1.0}
    controller = InteractionController(mock_avatar, mock_config)

    mock_sts_response = MagicMock()
    mock_sts_response.type = "final"
    mock_sts_response.text = "Hello there"

    mock_avatar_response = MagicMock()
    # Twitch session ID
    mock_avatar_response.session_id = "twitch-session"

    await controller.on_response(mock_avatar_response, mock_sts_response)

    # Should call set_busy with source="twitch"
    mock_avatar.set_busy.assert_called_once_with("twitch-session", True, timeout=pytest.approx(2.83, 0.1), source="twitch")

@pytest.mark.anyio
async def test_twitch_queue_logic():
    from src.run_server import ParceraServer
    server = ParceraServer()
    server.is_busy = MagicMock(return_value=False)
    server.twitch_service._invoke_response = AsyncMock()

    # Mock calculate_wait_time to return fast for testing
    server.twitch_service._calculate_wait_time = MagicMock(return_value=0.01)

    # Put item in queue
    await server.twitch_service.queue.put(("User", "Hello"))

    # Run the processor briefly
    task = asyncio.create_task(server.twitch_service.process_queue())
    await asyncio.sleep(0.1)
    task.cancel()

    # Verify AI was invoked with delay
    server.twitch_service._invoke_response.assert_called_once_with("User", "Hello", audio_delay=0.01)
