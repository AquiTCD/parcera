
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

@pytest.mark.asyncio
async def test_moonshine_reload():
    with patch("os.path.exists", return_value=True):
        mock_moonshine.get_model_for_language.return_value = ("/tmp/fake_model", MagicMock())
        
        # Initial: adapter enabled and path provided
        recognizer = MoonshineRecognizer(
            model_name="base-ja", 
            active_profile="test_prof", 
            adapter_enabled=True,
            adapter_path="/path/to/adapter"
        )
        assert recognizer.active_profile == "test_prof"
        assert recognizer.adapter_enabled is True
        assert recognizer.adapter_path == "/path/to/adapter"
        
        # Verify Transcriber created with adapter_path initially
        args, kwargs = mock_moonshine.Transcriber.call_args
        assert kwargs["options"]["adapter_path"] == "/path/to/adapter"

        # Explicitly reload with a new path
        recognizer.reload(adapter_path="/path/to/new_adapter")
        
        # Verify Transcriber re-created with new adapter_path
        args, kwargs = mock_moonshine.Transcriber.call_args
        assert kwargs["options"]["adapter_path"] == "/path/to/new_adapter"
        assert recognizer.adapter_path == "/path/to/new_adapter"
        
        # Disable adapter and reload (should ignore path)
        recognizer.adapter_enabled = False
        recognizer.reload()
        
        # Verify Transcriber re-created WITHOUT adapter_path
        args, kwargs = mock_moonshine.Transcriber.call_args
        assert "adapter_path" not in kwargs["options"]
