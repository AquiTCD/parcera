"""
MicAnalyzer: sounddevice-based microphone capture for OBS Browser Source support.

Captures audio from the system microphone, then:
1. Broadcasts user_lipsync events (vowel + amplitude) to all WS clients
2. Feeds audio to the STT pipeline via a simple energy-based VAD
"""

import asyncio
import logging
from typing import Optional, Callable, Awaitable

import numpy as np

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16000
CHUNK_FRAMES = 512  # ~32ms per callback at 16kHz
SILENCE_CHUNKS_TO_FLUSH = 15  # ~480ms of post-speech silence before STT trigger
MIN_SPEECH_CHUNKS = 5         # ~160ms minimum speech to reject brief noise spikes

# Spectral centroid boundaries (Hz) for Japanese vowel classification.
# Matches the thresholds used in ui/renderer/lib/audio.ts VOWEL_BOUNDARIES_HZ.
_VOWEL_BOUNDARIES_HZ = {'u': 600, 'o': 1500, 'a': 3000, 'e': 5000}


class _SoftwareAGC:
    """
    Peak-hold AGC that normalises raw mic RMS to a consistent target level.

    Mimics the browser's WebRTC Automatic Gain Control: speech is boosted to
    TARGET_RMS regardless of the physical microphone gain, while a noise gate
    (NOISE_FLOOR) prevents amplifying silence into false positives.

    Algorithm:
      - If current RMS > tracked peak  → update peak, reset hold counter
      - While hold counter > 0         → keep peak stable (prevents pumping)
      - After hold expires             → peak decays slowly (handles level drops)
      - Gain = TARGET_RMS / peak, capped at MAX_GAIN
    """

    TARGET_RMS = 0.12       # Normalise speech to ~-18 dBFS (matches browser AGC)
    MAX_GAIN = 40.0         # Cap at +32 dB to avoid amplifying deep silence
    NOISE_FLOOR = 0.0005    # Below this RMS, apply no gain (pure silence / noise gate)
    HOLD_CHUNKS = 30        # Hold peak for ~1 s before allowing decay
    DECAY_PER_CHUNK = 0.995 # ~0.5 dB/s decay — slow enough to avoid pumping artefacts

    def __init__(self) -> None:
        self._peak: float = 0.001
        self._hold: int = 0

    def process(self, rms: float) -> float:
        """Return the AGC-normalised RMS for *rms*; also updates internal state."""
        # Update peak tracker
        if rms > self._peak:
            self._peak = rms
            self._hold = self.HOLD_CHUNKS
        elif self._hold > 0:
            self._hold -= 1
        else:
            self._peak = max(self._peak * self.DECAY_PER_CHUNK, 0.001)

        # Noise gate: don't boost near-silence
        if rms < self.NOISE_FLOOR:
            return rms

        gain = min(self.TARGET_RMS / self._peak, self.MAX_GAIN)
        return float(np.clip(rms * gain, 0.0, 1.0))


class MicAnalyzer:
    """
    Captures microphone audio via sounddevice and performs two duties:
    - Broadcasts ``user_lipsync`` JSON events to all connected WebSocket clients
      (used by OBS Browser Source user avatar).
    - Runs a lightweight energy-based VAD and feeds detected utterances to the
      STT pipeline so that STT no longer depends on browser PCM streaming.
    """

    def __init__(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop
        self._stream = None
        self._mic_device: Optional[str] = None
        # With software AGC normalising to ~-18 dBFS, a -25 dB threshold gives
        # comfortable headroom for detecting speech while ignoring residual noise.
        self._threshold_db: float = -25.0
        self._agc = _SoftwareAGC()

        # VAD state
        self._vad_buffer: list[bytes] = []
        self._is_speaking: bool = False
        self._silence_count: int = 0
        self._speech_chunk_count: int = 0

        # Callbacks (set before calling start())
        self._stt_callback: Optional[Callable[[bytes], Awaitable[None]]] = None
        self._broadcast_callback: Optional[Callable[[dict], Awaitable[None]]] = None

    # ── Configuration ─────────────────────────────────────────────────────────

    def set_stt_callback(self, callback: Callable[[bytes], Awaitable[None]]) -> None:
        self._stt_callback = callback

    def set_broadcast_callback(self, callback: Callable[[dict], Awaitable[None]]) -> None:
        self._broadcast_callback = callback

    def set_threshold_db(self, db: float) -> None:
        self._threshold_db = db

    def set_mic_device(self, device: Optional[str]) -> None:
        self._mic_device = None if (not device or device == 'default') else device

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self) -> None:
        try:
            import sounddevice as sd  # lazy import — optional dependency
            self._stream = sd.InputStream(
                samplerate=SAMPLE_RATE,
                channels=1,
                dtype='int16',
                blocksize=CHUNK_FRAMES,
                device=self._mic_device,
                callback=self._audio_callback,
            )
            self._stream.start()
            logger.info(
                f"MicAnalyzer started (device={self._mic_device or 'default'}, "
                f"threshold={self._threshold_db}dB, AGC target={_SoftwareAGC.TARGET_RMS})"
            )
        except Exception as e:
            logger.error(f"MicAnalyzer failed to start: {e}")

    def stop(self) -> None:
        if self._stream:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception as e:
                logger.warning(f"MicAnalyzer stop error: {e}")
            self._stream = None
            logger.info("MicAnalyzer stopped")

    # ── Audio Processing (sounddevice callback — runs in a C thread) ──────────

    def _audio_callback(self, indata, frames, time, status) -> None:
        audio_int16 = indata[:, 0].copy()  # mono, shape (frames,), dtype int16
        audio_float = audio_int16.astype(np.float32) / 32768.0

        raw_rms = float(np.sqrt(np.mean(audio_float ** 2)))
        boosted_rms = self._agc.process(raw_rms)

        # --- Lipsync broadcast (AGC-normalised amplitude) ---
        vowel = self._estimate_vowel(audio_float, raw_rms)
        if self._broadcast_callback:
            asyncio.run_coroutine_threadsafe(
                self._broadcast_callback({
                    "type": "user_lipsync",
                    "vowel": vowel,
                    "amplitude": boosted_rms,
                }),
                self._loop,
            )

        # --- Energy VAD for STT (using AGC-normalised dB) ---
        if self._stt_callback:
            db = 20.0 * np.log10(max(boosted_rms, 1e-10))
            if db > self._threshold_db:
                self._is_speaking = True
                self._silence_count = 0
                self._speech_chunk_count += 1
                self._vad_buffer.append(audio_int16.tobytes())
            elif self._is_speaking:
                self._vad_buffer.append(audio_int16.tobytes())
                self._silence_count += 1
                if self._silence_count >= SILENCE_CHUNKS_TO_FLUSH:
                    if self._speech_chunk_count >= MIN_SPEECH_CHUNKS:
                        audio_data = b''.join(self._vad_buffer)
                        logger.debug(
                            f"VAD flush: {self._speech_chunk_count} speech chunks "
                            f"({len(audio_data) // 2 / SAMPLE_RATE:.2f}s)"
                        )
                        asyncio.run_coroutine_threadsafe(
                            self._stt_callback(audio_data),
                            self._loop,
                        )
                    else:
                        logger.debug(
                            f"VAD: skipped flush — only {self._speech_chunk_count} "
                            f"speech chunks (min={MIN_SPEECH_CHUNKS})"
                        )
                    self._vad_buffer = []
                    self._is_speaking = False
                    self._silence_count = 0
                    self._speech_chunk_count = 0

    # ── Vowel Estimation ──────────────────────────────────────────────────────

    def _estimate_vowel(self, audio: np.ndarray, rms: float) -> str:
        if rms < 0.005:
            return 'n'

        fft = np.abs(np.fft.rfft(audio))
        freqs = np.fft.rfftfreq(len(audio), d=1.0 / SAMPLE_RATE)
        total = float(np.sum(fft))
        if total < 1e-10:
            return 'n'

        centroid = float(np.dot(freqs, fft)) / total

        if centroid < _VOWEL_BOUNDARIES_HZ['u']:
            return 'u'
        if centroid < _VOWEL_BOUNDARIES_HZ['o']:
            return 'o'
        if centroid < _VOWEL_BOUNDARIES_HZ['a']:
            return 'a'
        if centroid < _VOWEL_BOUNDARIES_HZ['e']:
            return 'e'
        return 'i'
