import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from core.wrappers import ParceraLLMWrapper
from core.factory import ParceraComponentFactory
from core.config import ParceraConfig


def _make_llm_service(chunks=None, error=None, compose_tag="primary"):
    svc = MagicMock()
    svc.system_prompt = f"{compose_tag} prompt"
    svc.reasoning_effort = None

    async def compose(context_id, user_id, text, files=None, system_prompt_params=None):
        return [{"role": "user", "text": text, "tag": compose_tag, "context_id": context_id}]

    svc.compose_messages = AsyncMock(side_effect=compose)
    svc.update_context = AsyncMock()

    async def stream(context_id, user_id, messages, system_prompt_params=None, tools=None, **kwargs):
        if error is not None:
            raise error
        for c in (chunks or []):
            yield c

    svc.get_llm_stream_response = MagicMock(side_effect=stream)
    return svc


@pytest.mark.asyncio
async def test_wrapper_no_secondary_reraises():
    primary = _make_llm_service(error=RuntimeError("429 RESOURCE_EXHAUSTED"))
    wrapper = ParceraLLMWrapper(primary)

    msgs = await wrapper.compose_messages("ctx1", "user1", "hello")
    with pytest.raises(RuntimeError, match="429"):
        async for _ in wrapper.get_llm_stream_response("ctx1", "user1", msgs):
            pass


@pytest.mark.asyncio
async def test_wrapper_fallback_on_429_and_skips_primary_during_cooldown():
    now = [1000.0]
    primary = _make_llm_service(error=RuntimeError("429 RESOURCE_EXHAUSTED"))
    secondary = _make_llm_service(chunks=["こん", "にちは"], compose_tag="secondary")

    wrapper = ParceraLLMWrapper(
        primary,
        secondary=secondary,
        cooldown_seconds=10800,
        clock=lambda: now[0],
    )

    # Turn 1-3: primary fails 3 times -> each turn falls back, and 3rd failure trips cooldown
    for i in range(3):
        msgs = await wrapper.compose_messages("ctx1", "user1", f"やっほー{i}")
        out = [c async for c in wrapper.get_llm_stream_response("ctx1", "user1", msgs)]
        await wrapper.update_context("ctx1", "user1", msgs, "".join(out))
        assert out == ["こん", "にちは"]

    assert primary.get_llm_stream_response.call_count == 3
    assert secondary.compose_messages.call_count == 3
    assert secondary.get_llm_stream_response.call_count == 3
    primary.update_context.assert_not_awaited()
    assert secondary.update_context.await_count == 3

    # Turn 4: 1 hour later (inside 3h cooldown) -> primary is skipped completely
    now[0] += 3600.0
    msgs2 = await wrapper.compose_messages("ctx1", "user1", "元気？")
    out2 = [c async for c in wrapper.get_llm_stream_response("ctx1", "user1", msgs2)]
    await wrapper.update_context("ctx1", "user1", msgs2, "".join(out2))

    assert out2 == ["こん", "にちは"]
    assert primary.compose_messages.call_count == 3  # NOT called again
    assert primary.get_llm_stream_response.call_count == 3
    assert secondary.compose_messages.call_count == 4
    assert secondary.get_llm_stream_response.call_count == 4


@pytest.mark.asyncio
async def test_wrapper_does_not_trip_cooldown_before_three_failures():
    primary = _make_llm_service(error=TimeoutError("transient timeout"))
    secondary = _make_llm_service(chunks=["サブ"], compose_tag="secondary")

    wrapper = ParceraLLMWrapper(primary, secondary=secondary, cooldown_seconds=10800)

    # 2 failures -> falls back each turn, but still retries primary on turn 3
    for i in range(2):
        m = await wrapper.compose_messages("c", "u", str(i))
        assert [c async for c in wrapper.get_llm_stream_response("c", "u", m)] == ["サブ"]

    assert primary.get_llm_stream_response.call_count == 2
    m3 = await wrapper.compose_messages("c", "u", "3")
    assert [c async for c in wrapper.get_llm_stream_response("c", "u", m3)] == ["サブ"]
    assert primary.get_llm_stream_response.call_count == 3


@pytest.mark.asyncio
async def test_wrapper_recovers_to_primary_after_cooldown():
    now = [1000.0]
    fail_first = [True]
    primary = _make_llm_service(compose_tag="primary")

    async def dynamic_primary_stream(*args, **kwargs):
        if fail_first[0]:
            raise RuntimeError("429 quota exceeded")
        yield "復活！"

    primary.get_llm_stream_response = MagicMock(side_effect=dynamic_primary_stream)
    secondary = _make_llm_service(chunks=["サブ応答"], compose_tag="secondary")

    wrapper = ParceraLLMWrapper(
        primary,
        secondary=secondary,
        cooldown_seconds=10800,
        clock=lambda: now[0],
    )

    # Turn 1-3: trips cooldown after 3 failures
    for i in range(3):
        msgs1 = await wrapper.compose_messages("ctx1", "user1", f"hi{i}")
        out1 = [c async for c in wrapper.get_llm_stream_response("ctx1", "user1", msgs1)]
        assert out1 == ["サブ応答"]

    # Turn 4: after 3h+, primary recovers and resets consecutive failure counter
    now[0] += 10800.1
    fail_first[0] = False
    msgs2 = await wrapper.compose_messages("ctx1", "user1", "back?")
    out2 = [c async for c in wrapper.get_llm_stream_response("ctx1", "user1", msgs2)]
    await wrapper.update_context("ctx1", "user1", msgs2, "".join(out2))

    assert out2 == ["復活！"]
    primary.update_context.assert_awaited_once()
    assert secondary.get_llm_stream_response.call_count == 3


@pytest.mark.asyncio
async def test_wrapper_reenters_cooldown_when_recovery_times_out():
    now = [1000.0]
    primary = _make_llm_service(error=TimeoutError("request timed out"))
    secondary = _make_llm_service(chunks=["サブ"], compose_tag="secondary")

    wrapper = ParceraLLMWrapper(
        primary,
        secondary=secondary,
        cooldown_seconds=10800,
        clock=lambda: now[0],
    )

    # Turn 1-3: primary times out 3 times -> cooldown until 11800
    for i in range(3):
        m1 = await wrapper.compose_messages("c", "u", str(i))
        assert [c async for c in wrapper.get_llm_stream_response("c", "u", m1)] == ["サブ"]

    # Turn 4: after 3h -> retries primary once, still times out -> immediately re-enters cooldown
    now[0] += 10801.0
    m2 = await wrapper.compose_messages("c", "u", "retry")
    assert [c async for c in wrapper.get_llm_stream_response("c", "u", m2)] == ["サブ"]
    assert primary.get_llm_stream_response.call_count == 4

    # Turn 5: 100s later -> inside new cooldown -> skips primary
    now[0] += 100.0
    m3 = await wrapper.compose_messages("c", "u", "skip")
    assert [c async for c in wrapper.get_llm_stream_response("c", "u", m3)] == ["サブ"]
    assert primary.get_llm_stream_response.call_count == 4


@pytest.mark.asyncio
async def test_wrapper_reraises_when_secondary_also_fails():
    primary = _make_llm_service(error=RuntimeError("429 RESOURCE_EXHAUSTED"))
    secondary = _make_llm_service(error=ValueError("secondary down"), compose_tag="secondary")
    wrapper = ParceraLLMWrapper(primary, secondary=secondary)

    msgs = await wrapper.compose_messages("c", "u", "hi")
    with pytest.raises(ValueError, match="secondary down"):
        async for _ in wrapper.get_llm_stream_response("c", "u", msgs):
            pass


def test_factory_builds_llm_with_and_without_fallback(tmp_path):
    cfg_no_fb = MagicMock()
    cfg_no_fb.get.side_effect = lambda k, d=None: {
        "llm": {
            "provider": "gemini",
            "providers": {"gemini": {"api_key": "k1", "model": "gemini-4-hydrogen"}},
        }
    }.get(k, d)
    cfg_no_fb.app_data_dir = str(tmp_path)
    cfg_no_fb.full_system_prompt = "sys"
    cfg_no_fb.profile_mode = False
    cfg_no_fb.verbose = False

    with patch("core.factory.FixedGeminiService") as mock_gem, patch("core.factory.ChatGPTService") as mock_oai:
        factory = ParceraComponentFactory(cfg_no_fb)
        llm = factory.build_llm()
        assert isinstance(llm, ParceraLLMWrapper)
        assert not llm.has_secondary
        mock_gem.assert_called_once()
        mock_oai.assert_not_called()

    cfg_with_fb = MagicMock()
    cfg_with_fb.get.side_effect = lambda k, d=None: {
        "llm": {
            "provider": "gemini",
            "providers": {"gemini": {"api_key": "k1", "model": "gemini-4-hydrogen"}},
            "fallback": {
                "provider": "openai",
                "cooldown_seconds": 10800,
                "providers": {"openai": {"api_key": "k2", "model": "gpt-4o"}},
            },
        }
    }.get(k, d)
    cfg_with_fb.app_data_dir = str(tmp_path)
    cfg_with_fb.full_system_prompt = "sys"
    cfg_with_fb.profile_mode = False
    cfg_with_fb.verbose = False

    with patch("core.factory.FixedGeminiService") as mock_gem, patch("core.factory.ChatGPTService") as mock_oai:
        factory = ParceraComponentFactory(cfg_with_fb)
        llm = factory.build_llm()
        assert isinstance(llm, ParceraLLMWrapper)
        assert llm.has_secondary
        assert llm.cooldown_seconds == 10800
        mock_gem.assert_called_once()
        # Secondary must be lazy-loaded, not constructed at build_llm() time
        mock_oai.assert_not_called()
        _ = llm.secondary
        mock_oai.assert_called_once()


@pytest.mark.asyncio
async def test_wrapper_lazy_loads_secondary_only_on_fallback():
    primary = _make_llm_service(error=RuntimeError("429 RESOURCE_EXHAUSTED"))
    secondary = _make_llm_service(chunks=["ローカル応答"], compose_tag="local")
    factory_fn = MagicMock(return_value=secondary)

    wrapper = ParceraLLMWrapper(primary, secondary_factory=factory_fn)
    wrapper.system_prompt = "updated prompt"

    # Not constructed before fallback triggers
    factory_fn.assert_not_called()

    msgs = await wrapper.compose_messages("c", "u", "hi")
    out = [c async for c in wrapper.get_llm_stream_response("c", "u", msgs)]

    assert out == ["ローカル応答"]
    factory_fn.assert_called_once()
    assert secondary.system_prompt == "updated prompt"

