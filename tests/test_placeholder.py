
import pytest
from unittest.mock import patch, mock_open
from src.core.config import ParceraConfig

def test_placeholder_filling():
    # Setup mock prompt templates
    system_prompt_md = "I am ${name}. You are ${userName}. Gender: ${userGender}. My tone is ${tone}. This is ${situation}."
    context_prompt_md = "Mode: ${mode}, Knowledge: ${knowledge}"

    # We need to handle multiple open calls for different files
    def get_mock_file_open(settings_content):
        def mock_file_open(path, *args, **kwargs):
            if "settings.default.yaml" in path or "test_settings.yaml" in path:
                return mock_open(read_data=settings_content).return_value
            if "system_prompt.md" in path:
                return mock_open(read_data=system_prompt_md).return_value
            if "context_prompt.md" in path:
                return mock_open(read_data=context_prompt_md).return_value
            if "action_guidelines_soliloquy.md" in path:
                return mock_open(read_data="Guidelines-Content").return_value
            # Default fallback for any other files
            return mock_open(read_data="").return_value
        return mock_file_open

    settings_base = """
ai_profile:
  name: "TestAI"
  tone: "Friendly"
user_profile:
  name: "UserA"
  calling: "Sir"
  mode: "soliloquy"
  gender: "Male"
knowledge: "Some fact"
"""

    with patch("os.path.exists", return_value=True):
        with patch("os.path.getmtime", return_value=123.456):
            with patch("builtins.open", side_effect=get_mock_file_open(settings_base)):
                config = ParceraConfig(settings_path="test_settings.yaml")

            assert "I am TestAI" in config.full_system_prompt
            assert "You are UserA" in config.full_system_prompt
            assert "Gender: Male" in config.full_system_prompt
            assert "My tone is Friendly" in config.full_system_prompt
            assert "Mode: soliloquy" in config.full_system_prompt
            assert "Knowledge: Some fact" in config.full_system_prompt

            # Check if situation was auto-generated in English
            assert "is fully immersed in gaming" in config.full_system_prompt
