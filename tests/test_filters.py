import pytest
import math
from src.core.filters import ResponseWeightFilter

def test_filter_ignore_sentences():
    # Setup filter with ignore sentences
    ignore = ["無視して", "スキップ"]
    f = ResponseWeightFilter(ignore_sentences=ignore)

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
    # With 'medium' sensitivity, midpoint is 18.
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
    assert f_high.midpoint == 10.0

    # Low sensitivity should be quiet (higher midpoint)
    f_low = ResponseWeightFilter(sensitivity="low")
    assert f_low.midpoint == 25.0

    # Unknown sensitivity should fallback
    f_unknown = ResponseWeightFilter(sensitivity="super-chatty")
    assert f_unknown.sensitivity == "super-chatty"
    assert f_unknown.midpoint == 18.0 # default medium
