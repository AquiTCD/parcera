import os
import asyncio
import numpy as np
import logging
from faster_whisper import WhisperModel
from aiavatar.sts.stt import SpeechRecognizer
from aiavatar.sts.stt.base import SpeechRecognitionResult

logger = logging.getLogger(__name__)

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
        debug=False
    ):
        super().__init__(debug=debug)
        self.on_recognized_callback = on_recognized_callback
        self.is_busy_handler = is_busy_handler
        self.model_name = model_name
        self.whisper_vad_filter = whisper_vad_filter
        logger.info(f"Loading Faster-Whisper model: {model_name} on {device}... (VAD Filter: {self.whisper_vad_filter})")
        self.model = WhisperModel(model_name, device=device, compute_type=compute_type)
        self.initial_prompt = initial_prompt or ""
        logger.info(f"Initialized STT with prompt: {self.initial_prompt}")
        self.response_filter = response_filter

    async def recognize(self, session_id: str, data: bytes) -> SpeechRecognitionResult:
        if self.is_busy_handler and self.is_busy_handler(session_id):
            logger.info(f"STT: AI is busy. Ignoring input for session {session_id} (First-Wins).")
            return SpeechRecognitionResult(text="")

        text = await self.transcribe(data, session_id)
        if text:
            logger.info(f"STT: Recognized: {text}")
            if self.on_recognized_callback:
                asyncio.create_task(self.on_recognized_callback(session_id, text))
        return SpeechRecognitionResult(text=text)

    async def transcribe(self, data: bytes, session_id: str = None) -> str:
        audio_int16 = np.frombuffer(data, dtype=np.int16)
        audio_float32 = audio_int16.astype(np.float32) / 32768.0

        duration = len(audio_float32) / 16000
        max_vol = np.max(np.abs(audio_float32))
        logger.debug(f"STT: Transcribing {duration:.2f}s, Max Vol: {max_vol:.4f}")

        loop = asyncio.get_event_loop()
        segments, info = await loop.run_in_executor(
            None,
            lambda: self.model.transcribe(
                audio_float32,
                language="ja",
                initial_prompt=self.initial_prompt if self.initial_prompt else None,
                beam_size=5,
                vad_filter=self.whisper_vad_filter,
                temperature=0.0,
                # vad_parameters=dict(min_silence_duration_ms=500)
            )
        )

        collected_segments = []
        for s in segments:
            collected_segments.append(s.text)
            logger.debug(f"STT: Segment: {s.text} (prob: {s.avg_logprob:.2f})")

        text = "".join(collected_segments).strip()

        if self.response_filter and text:
            if not self.response_filter.should_respond(text):
                logger.info(f"STT: Ignored by filter: {text}")
                return ""

        return text
