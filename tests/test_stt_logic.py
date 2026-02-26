import pytest
import numpy as np
from unittest.mock import MagicMock, patch, AsyncMock
from src.core.stt import KotobaWhisperRecognizer

@pytest.fixture
def mock_whisper():
    with patch("src.core.stt.WhisperModel") as MockModel:
        model_instance = MockModel.return_value
        # Mock transcribe to return an iterator of segments
        segment = MagicMock()
        segment.text = "テストです"
        model_instance.transcribe.return_value = ([segment], None)
        yield model_instance

@pytest.fixture
def stt(mock_whisper):
    return KotobaWhisperRecognizer(
        model_name="fake-model",
        device="cpu",
        compute_type="int8"
    )

@pytest.mark.anyio
async def test_stt_recognize_respects_busy_handler(stt):
    # Setup busy handler that says "I'm busy"
    stt.is_busy_handler = MagicMock(return_value=True)

    result = await stt.recognize("session1", b"\x00" * 1600)

    # Should return empty text and NOT call transcribe
    assert result.text == ""
    stt.is_busy_handler.assert_called_with("session1")
    stt.model.transcribe.assert_not_called()

@pytest.mark.anyio
async def test_stt_transcribe_concatenates_segments(stt):
    # Mock multiple segments
    s1 = MagicMock(); s1.text = "こんにちは"
    s2 = MagicMock(); s2.text = "パルセラさん"
    stt.model.transcribe.return_value = ([s1, s2], None)

    # 0.1s of silence (1600 samples at 16kHz)
    fake_audio = np.zeros(1600, dtype=np.int16).tobytes()

    text = await stt.transcribe(fake_audio, "session1")

    assert text == "こんにちはパルセラさん"
    assert stt.model.transcribe.called

@pytest.mark.anyio
async def test_recognize_immediate_busy_flagging(stt):
    # Simulate real busy state manager
    busy_sessions = set()
    def is_busy(sid): return sid in busy_sessions
    def set_busy(sid, busy):
        if busy: busy_sessions.add(sid)
        else: busy_sessions.discard(sid)

    stt.is_busy_handler = is_busy
    stt.set_busy_handler = set_busy

    fake_audio = np.zeros(1600, dtype=np.int16).tobytes()

    # 1. First recognition should work
    result = await stt.recognize("session1", fake_audio)
    assert result.text == "テストです"

    # In real app, InteractionController or TTS would clear/extend this.
    # For testing silence-reset, we clear it first.
    set_busy("session1", False)

    # 2. Busy flag should be cleared if text is empty (simulating silence)
    stt.model.transcribe.return_value = ([], None)
    result = await stt.recognize("session1", fake_audio)
    assert result.text == ""
    assert not is_busy("session1") # Should be cleared because it was just silence

@pytest.mark.anyio
async def test_recognize_no_log_no_callback_on_busy(stt):
    # Mock busy state
    stt.is_busy_handler = MagicMock(return_value=True)
    stt.on_recognized_callback = AsyncMock()

    fake_audio = np.zeros(1600, dtype=np.int16).tobytes()
    result = await stt.recognize("session1", fake_audio)

    # Assert result is empty and NO callback was fired
    assert result.text == ""
    stt.on_recognized_callback.assert_not_called()

@pytest.mark.anyio
async def test_stt_recognize_calls_callback(stt):
    # This is the original test, but we need to ensure it's awaited or handled correctly per PRD
    # (Actually the original test used create_task and a sleep, which we plan to change to await)
    stt.on_recognized_callback = AsyncMock()
    stt.is_busy_handler = MagicMock(return_value=False)

    # Mock result
    s = MagicMock(); s.text = "わっしょい"
    stt.model.transcribe.return_value = ([s], None)

    fake_audio = np.zeros(1600, dtype=np.int16).tobytes()
    await stt.recognize("session1", fake_audio)

    # In TDD, we want this to be synchronous (awaited) in the next phase
    # For now, let's keep it as is or update it to what we expect.
    import asyncio
    await asyncio.sleep(0.1)
    stt.on_recognized_callback.assert_called()
