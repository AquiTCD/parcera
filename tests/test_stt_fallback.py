import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from aiavatar.sts.stt.base import SpeechRecognitionResult
from core.wrappers import ParceraSTTWrapper
from core.factory import ParceraComponentFactory


def _make_recognizer(text="", error=None):
    rec = MagicMock()
    if error is not None:
        rec.recognize = AsyncMock(side_effect=error)
    else:
        rec.recognize = AsyncMock(return_value=SpeechRecognitionResult(text=text))
    return rec


@pytest.mark.asyncio
async def test_stt_wrapper_fallback_on_429_and_cooldown():
    now = [1000.0]
    primary = _make_recognizer(error=RuntimeError("429 RESOURCE_EXHAUSTED"))
    secondary = _make_recognizer(text="サブ認識")
    busy = {"s1": False}

    wrapper = ParceraSTTWrapper(
        primary,
        set_busy_handler=lambda sid, val: busy.__setitem__(sid, val),
        secondary=secondary,
        cooldown_seconds=10800,
        clock=lambda: now[0],
    )

    # 3 consecutive failures trip cooldown
    for i in range(3):
        res = await wrapper.recognize("s1", f"audio{i}".encode())
        assert res.text == "サブ認識"
    assert primary.recognize.await_count == 3
    assert secondary.recognize.await_count == 3

    # Inside cooldown -> skips primary completely
    now[0] += 3600.0
    res2 = await wrapper.recognize("s1", b"audio_skip")
    assert res2.text == "サブ認識"
    assert primary.recognize.await_count == 3
    assert secondary.recognize.await_count == 4


@pytest.mark.asyncio
async def test_stt_wrapper_recovers_after_cooldown():
    now = [1000.0]
    fail_first = [True]
    primary = MagicMock()

    async def dynamic_recognize(sid, data):
        if fail_first[0]:
            raise TimeoutError("stt timed out")
        return SpeechRecognitionResult(text="メイン復活")

    primary.recognize = AsyncMock(side_effect=dynamic_recognize)
    secondary = _make_recognizer(text="サブ")

    wrapper = ParceraSTTWrapper(
        primary,
        secondary=secondary,
        cooldown_seconds=10800,
        clock=lambda: now[0],
    )

    for i in range(3):
        assert (await wrapper.recognize("s1", f"a{i}".encode())).text == "サブ"

    now[0] += 10800.1
    fail_first[0] = False
    assert (await wrapper.recognize("s1", b"b")).text == "メイン復活"
    assert secondary.recognize.await_count == 3


@pytest.mark.asyncio
async def test_stt_wrapper_lazy_loads_secondary_and_clears_busy_on_double_failure():
    primary = _make_recognizer(error=RuntimeError("429 quota"))
    secondary = _make_recognizer(error=RuntimeError("secondary failed"))
    factory_fn = MagicMock(return_value=secondary)
    busy = {"s1": False}

    wrapper = ParceraSTTWrapper(
        primary,
        set_busy_handler=lambda sid, val: busy.__setitem__(sid, val),
        secondary_factory=factory_fn,
    )
    factory_fn.assert_not_called()

    res = await wrapper.recognize("s1", b"a")
    assert res.text == ""
    assert busy["s1"] is False
    factory_fn.assert_called_once()


def test_factory_builds_stt_with_and_without_lazy_fallback(tmp_path):
    cfg = MagicMock()
    cfg.get.side_effect = lambda k, d=None: {
        "stt": {
            "provider": "google",
            "providers": {"google": {"api_key": "g-key", "language": "ja-JP"}},
            "fallback": {
                "provider": "azure",
                "cooldown_seconds": 10800,
                "providers": {"azure": {"api_key": "a-key", "region": "japaneast", "language": "ja-JP"}},
            },
        }
    }.get(k, d)
    cfg.verbose = False

    with patch("core.factory.GoogleSpeechRecognizer") as mock_g, patch("core.factory.AzureSpeechRecognizer") as mock_a:
        factory = ParceraComponentFactory(cfg)
        stt = factory.build_stt()
        assert isinstance(stt, ParceraSTTWrapper)
        assert stt.has_secondary
        assert stt.cooldown_seconds == 10800
        mock_g.assert_called_once()
        mock_a.assert_not_called()
        _ = stt.secondary
        mock_a.assert_called_once()
