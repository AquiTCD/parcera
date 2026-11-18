import pytest
from unittest.mock import MagicMock, patch
from pydantic import ValidationError

from src.core.schema import GeminiConfig, OpenAIConfig
from src.core.factory import ParceraComponentFactory
from src.core.gemini import FixedGeminiService
from src.core.wrappers import ParceraLLMWrapper


# --- Schema Tests ---

def test_schema_thinking_level_defaults_and_validation():
    gemini = GeminiConfig()
    openai = OpenAIConfig()
    assert gemini.thinking_level is None
    assert openai.thinking_level is None

    for level in ("low", "medium", "high"):
        assert GeminiConfig(thinking_level=level).thinking_level == level
        assert OpenAIConfig(thinking_level=level).thinking_level == level

    with pytest.raises(ValidationError):
        GeminiConfig(thinking_level="invalid")
    with pytest.raises(ValidationError):
        OpenAIConfig(thinking_level="xhigh")


# --- Factory Wiring Tests ---

def test_factory_passes_thinking_level_to_gemini():
    config = MagicMock()
    config.get.return_value = {
        "provider": "gemini",
        "providers": {"gemini": {"api_key": "fake-key", "model": "gemini-4-hydrogen", "thinking_level": "low"}},
    }
    config.full_system_prompt = "system"
    config.profile_mode = False
    config.verbose = False

    factory = ParceraComponentFactory(config)
    with patch("src.core.factory.SQLiteContextManager"), \
         patch("src.core.factory.FixedGeminiService") as MockGemini:
        factory.build_llm()
        _, kwargs = MockGemini.call_args
        assert kwargs["thinking_level"] == "low"


def test_factory_normalizes_empty_thinking_level_to_none():
    config = MagicMock()
    config.get.return_value = {
        "provider": "gemini",
        "providers": {"gemini": {"api_key": "fake-key", "thinking_level": ""}},
    }
    config.full_system_prompt = "system"
    config.profile_mode = False
    config.verbose = False

    factory = ParceraComponentFactory(config)
    with patch("src.core.factory.SQLiteContextManager"), \
         patch("src.core.factory.FixedGeminiService") as MockGemini:
        factory.build_llm()
        _, kwargs = MockGemini.call_args
        assert kwargs["thinking_level"] is None


def test_factory_maps_thinking_level_to_openai_reasoning_effort():
    config = MagicMock()
    config.get.return_value = {
        "provider": "openai",
        "providers": {"openai": {"api_key": "fake-key", "thinking_level": "medium"}},
    }
    config.full_system_prompt = "system"
    config.profile_mode = False

    factory = ParceraComponentFactory(config)
    with patch("src.core.factory.SQLiteContextManager"), \
         patch("src.core.factory.ChatGPTService") as MockGPT, \
         patch("src.core.factory.ParceraLLMWrapper"):
        factory.build_llm()
        _, kwargs = MockGPT.call_args
        assert kwargs["reasoning_effort"] == "medium"


# --- Runtime Fallback Tests ---

@pytest.mark.asyncio
async def test_fixed_gemini_service_falls_back_when_thinking_level_unsupported():
    with patch("aiavatar.sts.llm.gemini.genai.Client"):
        service = FixedGeminiService(
            gemini_api_key="fake-key",
            model="gemini-2.0-flash",
            thinking_level="low",
        )

    call_levels = []

    async def fake_super_stream(self, *args, **kwargs):
        call_levels.append(self.thinking_level)
        if self.thinking_level is not None:
            raise Exception("400 INVALID_ARGUMENT: Thinking level is not supported for this model.")
        yield "ok-chunk"

    with patch("aiavatar.sts.llm.gemini.GeminiService.get_llm_stream_response", new=fake_super_stream):
        chunks = [c async for c in service.get_llm_stream_response("ctx", "usr", [])]

    assert chunks == ["ok-chunk"]
    assert call_levels == ["low", None]
    assert service.thinking_level is None


@pytest.mark.asyncio
async def test_fixed_gemini_service_does_not_swallow_unrelated_errors():
    with patch("aiavatar.sts.llm.gemini.genai.Client"):
        service = FixedGeminiService(
            gemini_api_key="fake-key",
            model="gemini-4-hydrogen",
            thinking_level="low",
        )

    async def fake_super_stream(self, *args, **kwargs):
        raise RuntimeError("network timeout")
        yield  # pragma: no cover

    with patch("aiavatar.sts.llm.gemini.GeminiService.get_llm_stream_response", new=fake_super_stream):
        with pytest.raises(RuntimeError, match="network timeout"):
            [c async for c in service.get_llm_stream_response("ctx", "usr", [])]

    assert service.thinking_level == "low"


@pytest.mark.asyncio
async def test_wrapper_falls_back_when_openai_reasoning_effort_unsupported():
    wrapped = MagicMock()
    wrapped.reasoning_effort = "low"
    call_efforts = []

    async def fake_stream(*args, **kwargs):
        call_efforts.append(wrapped.reasoning_effort)
        if wrapped.reasoning_effort is not None:
            raise Exception("400 BadRequestError: Unsupported parameter: 'reasoning_effort' is not supported with this model.")
        yield "ok-openai-chunk"

    wrapped.get_llm_stream_response = fake_stream
    wrapper = ParceraLLMWrapper(wrapped, profile_mode=False)

    chunks = [c async for c in wrapper.get_llm_stream_response("ctx", "usr", [])]
    assert chunks == ["ok-openai-chunk"]
    assert call_efforts == ["low", None]
    assert wrapped.reasoning_effort is None
