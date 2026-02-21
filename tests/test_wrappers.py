import pytest
from unittest.mock import MagicMock
from src.core.wrappers import ParceraLLMWrapper, ParceraSTTWrapper

def test_llm_wrapper_profile_mode():
    inner_service = MagicMock()
    async def mock_chat(*args, **kwargs):
        yield "Hello"
    inner_service.chat.side_effect = mock_chat

    # Test with profile_mode=True
    wrapper = ParceraLLMWrapper(inner_service, profile_mode=True)

    # It should still call the inner service and we need to iterate over it
    async def run_chat():
        chunks = []
        async for chunk in wrapper.chat("Hi"):
            chunks.append(chunk)
        return "".join(chunks)

    import asyncio
    response = asyncio.run(run_chat())
    assert response == "Hello"
    inner_service.chat.assert_called()

def test_stt_wrapper_transcription_filtering():
    inner_stt = MagicMock()
    # Mocking a transcription response result structure
    mock_result = MagicMock()
    mock_result.text = "無視して"

    async def mock_recognize(session_id, data):
        return mock_result

    inner_stt.recognize.side_effect = mock_recognize

    # Response filter that says "No" to this text
    mock_filter = MagicMock()
    mock_filter.should_respond.return_value = False

    wrapper = ParceraSTTWrapper(inner_stt, response_filter=mock_filter)

    # The wrapper should return empty text result if filter rejects it
    import asyncio
    result = asyncio.run(wrapper.recognize("session", b"audio"))
    assert result.text == ""

    # If filter accepts it
    mock_filter.should_respond.return_value = True
    mock_result.text = "こんにちは"
    result = asyncio.run(wrapper.recognize("session", b"audio"))
    assert result.text == "こんにちは"
