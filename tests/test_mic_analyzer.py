"""Unit tests for MicAnalyzer VAD state machine."""
import asyncio
import numpy as np
import pytest
from unittest.mock import MagicMock, patch

from core.mic_analyzer import MicAnalyzer, MAX_SPEECH_CHUNKS, MIN_SPEECH_CHUNKS, CHUNK_FRAMES, SAMPLE_RATE


def _make_chunk(db: float) -> np.ndarray:
    """Return a mono int16 chunk with the given RMS level (dBFS)."""
    rms = 10.0 ** (db / 20.0)
    amplitude = int(min(rms * 32767, 32767))
    return np.full(CHUNK_FRAMES, amplitude, dtype=np.int16).reshape(-1, 1)


@pytest.fixture
def mic():
    loop = asyncio.new_event_loop()
    m = MicAnalyzer(loop)
    m._threshold_db = -35.0
    from unittest.mock import MagicMock
    m.set_stt_callback(MagicMock())
    yield m
    loop.close()


def drive(mic: MicAnalyzer, chunk: np.ndarray, count: int) -> None:
    """Feed `count` identical chunks into the audio callback."""
    with patch("core.mic_analyzer.asyncio.run_coroutine_threadsafe") as mock_rct:
        mock_rct.return_value = MagicMock()
        for _ in range(count):
            mic._audio_callback(chunk, CHUNK_FRAMES, None, None)


class TestEarlyFlush:
    def test_early_flush_resets_is_speaking(self, mic):
        """_is_speaking must be False after MAX_SPEECH_CHUNKS triggers an early flush."""
        loud = _make_chunk(-20)
        drive(mic, loud, MAX_SPEECH_CHUNKS)

        assert mic._is_speaking is False, "_is_speaking must be reset after early flush"

    def test_early_flush_clears_vad_buffer(self, mic):
        """_vad_buffer must be empty after early flush."""
        loud = _make_chunk(-20)
        drive(mic, loud, MAX_SPEECH_CHUNKS)

        assert mic._vad_buffer == []

    def test_early_flush_resets_speech_chunk_count(self, mic):
        """_speech_chunk_count must be zero after early flush."""
        loud = _make_chunk(-20)
        drive(mic, loud, MAX_SPEECH_CHUNKS)

        assert mic._speech_chunk_count == 0

    def test_next_utterance_not_discarded_after_early_flush(self, mic):
        """Silence after an early flush must not trigger a spurious MIN_SPEECH_CHUNKS rejection."""
        loud = _make_chunk(-20)
        silent = _make_chunk(-70)

        drive(mic, loud, MAX_SPEECH_CHUNKS)
        drive(mic, silent, 1)

        assert mic._is_speaking is False


class TestNormalVADFlow:
    def test_speaking_sets_is_speaking(self, mic):
        loud = _make_chunk(-20)
        drive(mic, loud, 1)
        assert mic._is_speaking is True

    def test_silence_after_speech_flushes_if_long_enough(self, mic):
        loud = _make_chunk(-20)
        silent = _make_chunk(-70)
        from core.mic_analyzer import SILENCE_CHUNKS_TO_FLUSH

        drive(mic, loud, MIN_SPEECH_CHUNKS + 1)
        drive(mic, silent, SILENCE_CHUNKS_TO_FLUSH)

        assert mic._is_speaking is False
        assert mic._vad_buffer == []

    def test_short_noise_spike_below_min_chunks_not_flushed(self, mic):
        loud = _make_chunk(-20)
        silent = _make_chunk(-70)
        from core.mic_analyzer import SILENCE_CHUNKS_TO_FLUSH

        drive(mic, loud, MIN_SPEECH_CHUNKS - 1)
        drive(mic, silent, SILENCE_CHUNKS_TO_FLUSH)

        assert mic._is_speaking is False
        assert mic._vad_buffer == []
