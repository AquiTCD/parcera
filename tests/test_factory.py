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
        assert kwargs["device"] == "cpu"
        assert kwargs["compute_type"] == "int8"

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
        # First call fails, should NOT retry now because we already forced CPU in build_stt
        mock_recognizer.side_effect = Exception("Model Error")
        factory.build_stt()
        assert mock_recognizer.call_count == 1

def test_build_llm_gemini():
    config = MagicMock()
    config.get.return_value = {"provider": "gemini", "providers": {"gemini": {"api_key": "fake-key"}}}
    config.full_system_prompt = "system"
    config.profile_mode = False
    config.verbose = False

    factory = ParceraComponentFactory(config)
    with patch("src.core.factory.SQLiteContextManager"):
        with patch("src.core.factory.FixedGeminiService") as MockGemini:
            factory.build_llm()
            MockGemini.assert_called_once()

def test_build_llm_openai():
    config = MagicMock()
    config.get.return_value = {"provider": "openai", "providers": {"openai": {"api_key": "fake-key"}}}
    config.full_system_prompt = "system"
    config.profile_mode = True

    factory = ParceraComponentFactory(config)
    with patch("src.core.factory.SQLiteContextManager"):
        with patch("src.core.factory.ChatGPTService") as MockGPT:
            with patch("src.core.factory.ParceraLLMWrapper") as MockWrapper:
                factory.build_llm()
                MockGPT.assert_called_once()
                MockWrapper.assert_called_once()

def test_build_stt_google():
    config = MagicMock()
    config.get.side_effect = lambda k, d=None: {"provider": "google", "providers": {"google": {"api_key": "k"}}} if k == "stt" else d

    factory = ParceraComponentFactory(config)
    with patch("src.core.factory.GoogleSpeechRecognizer") as MockGoogle:
        factory.build_stt()
        MockGoogle.assert_called_once()

def test_build_tts_voicevox():
    config = MagicMock()
    config.get.return_value = {"provider": "voicevox", "providers": {"voicevox": {"api_url": "http://127.0.0.1:50021"}}}

    factory = ParceraComponentFactory(config)
    with patch("src.core.factory.FineTunedVoicevoxTTS") as MockVV:
        factory.build_tts()
        MockVV.assert_called_once()

def test_build_vad():
    config = MagicMock()
    config.get.return_value = {"volume_db_threshold": -30.0}
    config.verbose = False

    factory = ParceraComponentFactory(config)
    with patch("src.core.factory.StandardSpeechDetector") as MockVAD:
        factory.build_vad()
        MockVAD.assert_called_once()
        _, kwargs = MockVAD.call_args
        assert kwargs["volume_db_threshold"] == -30.0
