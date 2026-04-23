
import pytest
import numpy as np
from unittest.mock import MagicMock, patch, AsyncMock
from src.core.stt import KotobaWhisperRecognizer

@pytest.fixture
def mock_whisper():
    with patch("faster_whisper.WhisperModel") as MockModel:
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

@pytest.mark.asyncio
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
