import pytest
from unittest.mock import patch, mock_open
from src.core.config import ParceraConfig

def test_config_load_defaults():
    # Mocking file read to simulate a default config
    dummy_yaml = "verbose: true\nlog_level: DEBUG"
    with patch("builtins.open", mock_open(read_data=dummy_yaml)):
        with patch("os.path.exists", return_value=True):
            with patch("os.path.getmtime", return_value=123.456):
                config = ParceraConfig(settings_path="test_settings.yaml")
                assert config.verbose is True
                assert config.get("log_level") == "DEBUG"

def test_config_get_with_default():
    dummy_yaml = "llm:\n  provider: gemini"
    with patch("builtins.open", mock_open(read_data=dummy_yaml)):
        with patch("os.path.exists", return_value=True):
            with patch("os.path.getmtime", return_value=123.456):
                config = ParceraConfig(settings_path="test_settings.yaml")
            # Nested get
            assert config.get("llm").get("provider") == "gemini"
            # Fallback
            assert config.get("nonexistent", "fallback") == "fallback"

def test_config_validation_fallback(caplog):
    # Feed intentionally invalid type (int for provider string)
    dummy_yaml = "llm:\n  provider: 12345"
    with patch("builtins.open", mock_open(read_data=dummy_yaml)):
        with patch("os.path.exists", return_value=True):
            with patch("os.path.getmtime", return_value=123.456):
                config = ParceraConfig(settings_path="test_settings.yaml")
                
                # Should fallback to strict dict as specified in plan
                assert config.get("llm").get("provider") == 12345
                
                # Verify that warning was emitted
                assert "Config validation failed" in caplog.text


def test_knowledge_presets_defaults():
    from src.core.schema import ParceraSettings

    settings = ParceraSettings()
    assert settings.knowledge_presets == []
    assert settings.active_knowledge_preset_id == ""


def test_config_loads_knowledge_presets():
    dummy_yaml = (
        "active_knowledge_preset_id: sf6\n"
        "knowledge_presets:\n"
        "  - id: sf6\n"
        "    title: スト6配信\n"
        "    content: バーンアウトしたら攻める\n"
    )
    with patch("builtins.open", mock_open(read_data=dummy_yaml)):
        with patch("os.path.exists", return_value=True):
            with patch("os.path.getmtime", return_value=123.456):
                config = ParceraConfig(settings_path="test_settings.yaml")
                presets = config.get("knowledge_presets")
                assert len(presets) == 1
                assert presets[0]["id"] == "sf6"
                assert presets[0]["title"] == "スト6配信"
                assert presets[0]["content"] == "バーンアウトしたら攻める"
                assert config.get("active_knowledge_preset_id") == "sf6"

