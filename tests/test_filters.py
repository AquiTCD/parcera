import pytest
import math
from unittest.mock import patch
from src.core.filters import ResponseWeightFilter

def test_centralized_weight_calculation():
    # Weight = len(text) + kanji_count
    # "こんにちは" -> len=5, kanji=0 -> weight=5
    assert ResponseWeightFilter.calculate_weight("こんにちは") == 5.0
    # "パルセラ、こんにちは" -> len=10, kanji=2 (パ,ル,セ,ラ,、,こ,ん,に,ち,は - wait, Kanji counts are different)
    # Actually: "パルセラ" is Katakana. "こんにちは" is Hiragana.
    # Kanji test: "天気" (len=2, kanji=2) -> weight = 2 + 2 = 4.0
    assert ResponseWeightFilter.calculate_weight("天気") == 4.0
    # "今日はいい天気ですね" -> 今日(2) + は(1) + いい(2) + 天気(2) + ですね(3)
    # len=10. Kanji=今日, 天気 (4 chars) -> weight = 10 + 4 = 14.0
    assert ResponseWeightFilter.calculate_weight("今日はいい天気ですね") == 14.0

def test_should_respond_with_weight_threshold():
    # Medium sensitivity midpoint=18.0. Weight 4.0 should likely be ignored.
    f = ResponseWeightFilter(sensitivity="medium")
    # Wrap in monkeypatch to ensure it's not a lucky roll
    import random
    import math

    # We expect a weight of 4.0 ("天気") to have a low probability
    # P = 0.6 / (1 + exp(-0.10 * (4.0 - 18.0)))
    # P = 0.6 / (1 + exp(1.4)) = 0.6 / (1 + 4.05) = 0.6 / 5.05 = 0.118...
    # So with a 0.2 roll, it should be False.
    with patch("random.random", return_value=0.2):
        assert f.should_respond("天気") is False
    # Setup filter with ignore sentences
    ignore = ["無視して", "スキップ"]
    f = ResponseWeightFilter(ignore_sentences=ignore)

    with patch("random.random", return_value=0.0):
        # Should ignore exact match
        assert f.should_respond("無視して") is False
        # Should ignore normalized match (whitespace/punctuation)
        assert f.should_respond("無視して！ ") is False
        # Should not ignore unrelated text
        # Note: Very short text might be ignored by length logic, so use a longer sentence
        assert f.should_respond("こんにちは、パルセラさん！今日もいい天気ですね。") is True

def test_filter_force_keywords():
    f = ResponseWeightFilter(force_keywords=["絶対返信"])
    # Any length text with keyword should return True
    assert f.should_respond("絶対返信") is True
    assert f.should_respond("あ、絶対返信してね") is True

def test_filter_length_probability():
    # Testing the sigmoid logic.
    # With 'medium' sensitivity, midpoint is 21.0.
    f = ResponseWeightFilter(sensitivity="medium")

    # Very short text (len <= 1) should always be False
    assert f.should_respond("あ") is False

    # Text significantly longer than midpoint should have high probability.
    # We'll mock random to be predictable.
    import random
    with pytest.MonkeyPatch.context() as m:
        m.setattr(random, "random", lambda: 0.1) # Always low roll
        # Long text should pass
        assert f.should_respond("これはかなり長い文章なので、きっと返信してくれるはずだよね？") is True

        m.setattr(random, "random", lambda: 0.99) # Always high roll
        # Even long text might be capped by max_prob (0.90 for medium)
        assert f.should_respond("これはかなり長い文章なので、きっと返信してくれるはずだよね？") is False

def test_filter_sensitivity_presets():
    # High sensitivity should be more chatty (lower midpoint)
    f_high = ResponseWeightFilter(sensitivity="high")
    assert f_high.midpoint == 12.0

    # Low sensitivity should be quiet (higher midpoint)
    f_low = ResponseWeightFilter(sensitivity="low")
    assert f_low.midpoint == 20.0

    # Unknown sensitivity should fallback
    f_unknown = ResponseWeightFilter(sensitivity="super-chatty")
    assert f_unknown.sensitivity == "super-chatty"
    assert f_unknown.midpoint == 18.0 # default medium
