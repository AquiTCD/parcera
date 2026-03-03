
import asyncio
import numpy as np
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# Mock the entire moonshine_voice module to avoid lazy loading issues in tests
import sys
mock_moonshine = MagicMock()
sys.modules["moonshine_voice"] = mock_moonshine
sys.modules["moonshine_voice.moonshine_api"] = MagicMock()

from src.core.stt import MoonshineRecognizer

@pytest.mark.asyncio
async def test_moonshine_initialization():
    with patch("os.path.exists", return_value=True):
        mock_moonshine.get_model_for_language.return_value = ("/tmp/fake_model", MagicMock())
        recognizer = MoonshineRecognizer(model_name="base-ja")
        assert recognizer.model_name == "base-ja"
        assert recognizer.transcriber is not None

@pytest.mark.asyncio
async def test_moonshine_transcription_cleaning():
    with patch("os.path.exists", return_value=True):
        mock_moonshine.get_model_for_language.return_value = ("/tmp/fake_model", MagicMock())
        recognizer = MoonshineRecognizer(model_name="base-ja")
        
        # Simulate Moonshine's result structure
        def mock_tws(audio, flags=0):
            mock_res = MagicMock()
            line = MagicMock()
            line.text = " こ ん に ち は Moonshine   で す "
            mock_res.lines = [line]
            return mock_res
        
        recognizer.transcriber.transcribe_without_streaming.side_effect = mock_tws
        
        audio_data = np.zeros(1600, dtype=np.int16).tobytes()
        text = await recognizer.transcribe(audio_data)
        
        # Test cleaning: 
        # " こ ん に ち は Moonshine   で す " 
        # -> "こんにちはMoonshineです"
        assert text == "こんにちはMoonshineです"

@pytest.mark.asyncio
async def test_moonshine_transcribe_with_flags():
    with patch("os.path.exists", return_value=True):
        mock_moonshine.get_model_for_language.return_value = ("/tmp/fake_model", MagicMock())
        recognizer = MoonshineRecognizer(model_name="base-ja", flags=7)
        
        def mock_tws(audio, flags=0):
            mock_res = MagicMock()
            mock_res.lines = []
            return mock_res
        recognizer.transcriber.transcribe_without_streaming.side_effect = mock_tws
        
        audio_data = np.zeros(1600, dtype=np.int16).tobytes()
        await recognizer.transcribe(audio_data)
        
        # Verify flags passed
        _, kwargs = recognizer.transcriber.transcribe_without_streaming.call_args
        assert kwargs["flags"] == 7
