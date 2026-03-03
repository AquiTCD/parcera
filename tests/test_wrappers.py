
import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock
from src.core.wrappers import ParceraLLMWrapper, ParceraSTTWrapper
from aiavatar.sts.stt.base import SpeechRecognitionResult

@pytest.mark.asyncio
async def test_stt_wrapper_transcription_filtering():
    inner_stt = MagicMock()
    # Mocking a transcription response result structure
    mock_result = SpeechRecognitionResult(text="無視して")

    async def mock_recognize(session_id, data):
        return mock_result

    inner_stt.recognize.side_effect = mock_recognize

    # Response filter that says "No" to this text
    mock_filter = MagicMock()
    mock_filter.should_respond.return_value = False

    wrapper = ParceraSTTWrapper(inner_stt, response_filter=mock_filter)

    # The wrapper should return empty text result if filter rejects it
    result = await wrapper.recognize("session", b"audio")
    assert result.text == ""

    # If filter accepts it
    mock_filter.should_respond.return_value = True
    mock_result.text = "こんにちは"
    result = await wrapper.recognize("session", b"audio")
    assert result.text == "こんにちは"

@pytest.mark.asyncio
async def test_stt_wrapper_busy_management():
    inner_stt = MagicMock()
    inner_stt.recognize = AsyncMock(return_value=SpeechRecognitionResult(text="テスト"))

    # Track busy state
    busy_state = {"session": False}
    def is_busy(sid): return busy_state[sid]
    def set_busy(sid, busy): busy_state[sid] = busy

    wrapper = ParceraSTTWrapper(
        inner_stt,
        is_busy_handler=is_busy,
        set_busy_handler=set_busy
    )

    # 1. Normal call sets busy flag
    await wrapper.recognize("session", b"audio")
    assert busy_state["session"] == True
    inner_stt.recognize.assert_called_once()

    # 2. Call while busy returns empty and doesn't call inner STT
    inner_stt.recognize.reset_mock()
    result = await wrapper.recognize("session", b"audio")
    assert result.text == ""
    inner_stt.recognize.assert_not_called()

    # 3. If inner STT returns empty, busy flag should be cleared
    busy_state["session"] = False # Reset manually
    inner_stt.recognize.return_value = SpeechRecognitionResult(text="")
    await wrapper.recognize("session", b"audio")
    assert busy_state["session"] == False

@pytest.mark.asyncio
async def test_stt_wrapper_callback():
    inner_stt = MagicMock()
    inner_stt.recognize = AsyncMock(return_value=SpeechRecognitionResult(text="ハロー"))
    
    callback = AsyncMock()
    mock_filter = MagicMock()
    mock_filter.should_respond.return_value = False # Ignored text

    wrapper = ParceraSTTWrapper(
        inner_stt, 
        on_recognized_callback=callback,
        response_filter=mock_filter
    )

    result = await wrapper.recognize("session", b"audio")
    
    # Text is "ハロー", filter says "ignore" (False)
    # Callback should receive (text, is_filtered=True)
    callback.assert_called_once_with("session", "ハロー", True)
    assert result.text == "" # Filtered out
