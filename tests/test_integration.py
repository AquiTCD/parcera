import pytest
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
from aiavatar.sts.models import STSRequest

@pytest.fixture
def mock_components():
    with patch("src.core.avatar.ParceraComponentFactory") as MockFactory:
        factory = MockFactory.return_value
        factory.build_llm.return_value = MagicMock()
        factory.build_stt.return_value = MagicMock()
        
        # Mock TTS to prevent actual audio rendering
        mock_tts = MagicMock()
        mock_tts.synthesize = AsyncMock()
        mock_tts.voice_text_to_wav = AsyncMock()
        factory.build_tts.return_value = mock_tts
        
        factory.build_vad.return_value = MagicMock()
        yield factory

@pytest.mark.asyncio
async def test_twitch_to_lls_tts_pipeline(mock_components):
    # Import inside after mocking factory to avoid immediate initiation side-effects
    from src.run_server import ParceraServer
    from core.constants import TWITCH_SESSION_ID

    server = ParceraServer()
    
    # Mock the AIAvatarWebSocketServer sts.invoke behavior to simulate LLM thinking
    async def mock_sts_invoke(req: STSRequest):
        # Yield fake response chunks simulating standard STS generator behavior
        from dataclasses import dataclass
        @dataclass
        class MockSTSResponse:
            type: str
            text: str
            audio_data: bytes = None

        yield MockSTSResponse(type="chunk", text="Hello ")
        yield MockSTSResponse(type="final", text="TestUser!")
        
    server.aiavatar_server.sts.invoke = MagicMock(side_effect=mock_sts_invoke)
    
    # Force Twitch reading wait to 0s to avoid test sleep
    server.twitch_service._calculate_wait_time = MagicMock(return_value=0.0)

    # Mock the internal websocket send_json for the twitch session
    mock_ws = AsyncMock()
    server.aiavatar_server.websockets[TWITCH_SESSION_ID] = mock_ws

    # Step 1: Simulate incoming Twitch message (matching new 4-tuple schema)
    import time
    await server.twitch_service.queue.put(("TestUser", "Hello AI!", "chat", time.time()))
    
    # Step 2: Run process_queue but cancel it after it processes one item
    process_task = asyncio.create_task(server.twitch_service.process_queue())
    
    # Wait briefly to let the queue processor handle the item
    await asyncio.sleep(0.5)
    
    # Check that invoke was called with the correctly formatted twitch message
    server.aiavatar_server.sts.invoke.assert_called_once()
    req_arg = server.aiavatar_server.sts.invoke.call_args[0][0]
    assert req_arg.session_id == TWITCH_SESSION_ID
    assert "TestUser" in req_arg.text
    assert "Hello AI!" in req_arg.text

    # Check that send_json was called with thinking signal and the 2 generated text chunks
    # Note: total 3 calls expected (1 thinking, 2 chunks)
    assert mock_ws.send_json.call_count == 3
    
    # Clean up background task
    process_task.cancel()
    try:
        await process_task
    except asyncio.CancelledError:
        pass
