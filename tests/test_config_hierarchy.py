import pytest
import yaml
import os
from unittest.mock import patch, mock_open
from src.core.config import ParceraConfig

def test_config_hierarchy_merging():
    # 1. system_vitals.yaml (Base)
    vitals_yaml = """
sensitivity_presets:
  high: [10.0, 0.1, 0.9]
  medium: [20.0, 0.1, 0.9]
tts_timing:
  chars_per_second: 5.0
"""
    # 2. settings.default.yaml (Defaults)
    default_settings_yaml = """
verbose: false
response_sensitivity: medium
llm:
  provider: gemini
"""
    # 3. config.json (User override)
    user_config_json = """
{
  "verbose": true,
  "log_level": "DEBUG",
  "response_sensitivity": "high",
  "llm": {
    "provider": "openai"
  }
}
"""

    # Mocking paths based on how ParceraConfig builds them
    def mock_exists(path):
        if "system_vitals.yaml" in path: return True
        if "settings.default.yaml" in path: return True
        # The user override path is the one passed to __init__ or from env
        if "config.json" in path: return True
        return False

    def mocked_open(path, *args, **kwargs):
        if "system_vitals.yaml" in path:
            return mock_open(read_data=vitals_yaml).return_value
        if "settings.default.yaml" in path:
            return mock_open(read_data=default_settings_yaml).return_value
        if "config.json" in path:
            return mock_open(read_data=user_config_json).return_value
        return mock_open().return_value

    with patch("os.path.exists", side_effect=mock_exists), \
         patch("builtins.open", side_effect=mocked_open), \
         patch("os.path.getmtime", return_value=123.456):
        
        # We pass config.json as the settings_path which is the "user override" layer in current impl
        config = ParceraConfig(settings_path="config.json")
        
        # Check hierarchy
        # From User: verbose=True, sensitivity=high, llm.provider=openai
        assert config.verbose is True
        assert config.get("response_sensitivity") == "high"
        assert config.get("llm").get("provider") == "openai"
        
        # From System Vitals: tts_timing.chars_per_second=5.0
        assert config.get("tts_timing").get("chars_per_second") == 5.0
        
        # From System Vitals (inherited): sensitivity_presets
        presets = config.get("sensitivity_presets")
        assert presets["high"] == [10.0, 0.1, 0.9]
