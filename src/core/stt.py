import os
import asyncio
import numpy as np
import logging
from faster_whisper import WhisperModel
from aiavatar.sts.stt import SpeechRecognizer
from aiavatar.sts.stt.base import SpeechRecognitionResult

logger = logging.getLogger(__name__)


class NoOpRecognizer(SpeechRecognizer):
    """Placeholder STT that silently ignores all input. Used when the model is not yet downloaded."""

    def __init__(self, debug=False):
        super().__init__(debug=debug)
        self.on_recognized_callback = None
        logger.info("STT: NoOpRecognizer active. Download the model from Settings to enable speech recognition.")

    async def recognize(self, session_id: str, data: bytes) -> SpeechRecognitionResult:
        return SpeechRecognitionResult(text="")

    async def transcribe(self, data: bytes, session_id: str = None) -> str:
        return ""


class KotobaWhisperRecognizer(SpeechRecognizer):
    def __init__(
        self,
        model_name="longisland3/kotoba-whisper-v2.2-faster",
        device="auto",
        compute_type="default",
        initial_prompt=None,
        response_filter=None,
        whisper_vad_filter=False,
        on_recognized_callback=None,
        is_busy_handler=None,
        download_root=None,
        debug=False
    ):
        super().__init__(debug=debug)
        self.on_recognized_callback = on_recognized_callback
        self.is_busy_handler = is_busy_handler
        self.model_name = model_name
        self.whisper_vad_filter = whisper_vad_filter
        self.download_root = download_root
        logger.info(f"Loading Faster-Whisper model: {model_name} on {device}... (VAD Filter: {self.whisper_vad_filter})")
        self.model = WhisperModel(
            model_name,
            device=device,
            compute_type=compute_type,
            download_root=self.download_root,
            local_files_only=True
        )
        self.initial_prompt = initial_prompt or ""
        logger.info(f"Initialized STT with prompt: {self.initial_prompt}")
        self.response_filter = response_filter
        self._transcribe_lock = asyncio.Lock()

    async def recognize(self, session_id: str, data: bytes) -> SpeechRecognitionResult:
        if self.is_busy_handler and self.is_busy_handler(session_id):
            logger.info(f"STT: AI is busy. Ignoring input for session {session_id} (First-Wins).")
            return SpeechRecognitionResult(text="")

        text = await self.transcribe(data, session_id)
        if text:
            logger.info(f"STT: Recognized (Raw): {text}")

            # Determine if we should ignore this based on the filter
            is_filtered = False
            if self.response_filter and not self.response_filter.should_respond(text):
                is_filtered = True

            if self.on_recognized_callback:
                asyncio.create_task(self.on_recognized_callback(session_id, text, is_filtered))

            if is_filtered:
                logger.info(f"STT: Ignored by filter (Silence Mode): {text}")
                return SpeechRecognitionResult(text="")

        return SpeechRecognitionResult(text=text)

    async def transcribe(self, data: bytes, session_id: str = None) -> str:
        audio_int16 = np.frombuffer(data, dtype=np.int16)
        audio_float32 = audio_int16.astype(np.float32) / 32768.0

        # Diagnostics: Sample Rate Check
        # We expect 16000Hz. If duration is wildly off from real time, there's a problem.
        duration_internal = len(audio_float32) / 16000
        logger.debug(f"STT: Received {len(data)} bytes. Internal duration assuming 16kHz: {duration_internal:.2f}s")

        async with self._transcribe_lock:
            # Double-check busy status after waiting for the lock
            if self.is_busy_handler and self.is_busy_handler(session_id):
                logger.info(f"STT: AI became busy while waiting for transcription lock ({session_id}). Skipping.")
                return ""

            loop = asyncio.get_event_loop()
            def _execute_transcribe():
                segments_iter, info = self.model.transcribe(
                    audio_float32,
                    language="ja",
                    initial_prompt=self.initial_prompt if self.initial_prompt else None,
                    beam_size=5,
                    vad_filter=self.whisper_vad_filter,
                    temperature=0.0,
                )
                # Crucial: Exhaust the iterator inside the thread!
                return [s.text for s in segments_iter]

            collected_texts = await loop.run_in_executor(None, _execute_transcribe)

        for t in collected_texts:
            logger.debug(f"STT: Segment: {t}")

        text = "".join(collected_texts).strip()

        return text
