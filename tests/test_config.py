import pytest
from unittest.mock import patch, mock_open
from src.core.config import ParceraConfig

def test_config_load_defaults():
    # Mocking file read to simulate a default config
    dummy_yaml = "verbose: true\nlog_level: DEBUG"
    with patch("builtins.open", mock_open(read_data=dummy_yaml)):
        with patch("os.path.exists", return_value=True):
            config = ParceraConfig()
            assert config.verbose is True
            assert config.get("log_level") == "DEBUG"

def test_config_get_with_default():
    dummy_yaml = "llm:\n  provider: gemini"
    with patch("builtins.open", mock_open(read_data=dummy_yaml)):
        with patch("os.path.exists", return_value=True):
            config = ParceraConfig()
            # Nested get
            assert config.get("llm").get("provider") == "gemini"
            # Fallback
            assert config.get("nonexistent", "fallback") == "fallback"
