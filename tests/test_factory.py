import pytest
from unittest.mock import MagicMock, patch
from src.core.factory import ParceraComponentFactory

def test_build_stt_faster_whisper_default():
    config = MagicMock()
    config.verbose = False
    settings = {
        "response_sensitivity": "medium",
        "stt": {
            "provider": "faster_whisper",
            "providers": {
                "faster_whisper": {"device": "cpu", "compute_type": "int8"}
            }
        },
        "avatars": {"force_keywords": ["test"], "ignore_sentences": []}
    }
    config.get.side_effect = lambda k, d=None: settings.get(k, d)

    factory = ParceraComponentFactory(config)
    with patch("src.core.factory.KotobaWhisperRecognizer") as mock_recognizer:
        factory.build_stt()
        _, kwargs = mock_recognizer.call_args
        assert kwargs["device"] == "cpu"
        assert kwargs["compute_type"] == "int8"

def test_build_stt_mps_safety_check():
    config = MagicMock()
    config.verbose = False
    settings = {
        "response_sensitivity": "medium",
        "stt": {
            "provider": "faster_whisper",
            "providers": {
                "faster_whisper": {"device": "mps", "compute_type": "int8"}
            }
        },
        "avatars": {"force_keywords": ["test"], "ignore_sentences": []}
    }
    config.get.side_effect = lambda k, d=None: settings.get(k, d)

    factory = ParceraComponentFactory(config)
    with patch("src.core.factory.KotobaWhisperRecognizer") as mock_recognizer:
        factory.build_stt()
        _, kwargs = mock_recognizer.call_args
        assert kwargs["device"] == "mps"
        assert kwargs["compute_type"] == "float16"

def test_build_stt_mps_fallback():
    config = MagicMock()
    config.verbose = False
    settings = {
        "response_sensitivity": "medium",
        "stt": {
            "provider": "faster_whisper",
            "providers": {
                "faster_whisper": {"device": "mps", "compute_type": "float16"}
            }
        },
        "avatars": {"force_keywords": ["test"], "ignore_sentences": []}
    }
    config.get.side_effect = lambda k, d=None: settings.get(k, d)

    factory = ParceraComponentFactory(config)
    with patch("src.core.factory.KotobaWhisperRecognizer") as mock_recognizer:
        mock_recognizer.side_effect = [Exception("MPS Error"), MagicMock()]
        factory.build_stt()
        assert mock_recognizer.call_count == 2
        last_call_kwargs = mock_recognizer.call_args_list[1].kwargs
        assert last_call_kwargs["device"] == "cpu"
        assert last_call_kwargs["compute_type"] == "int8"
