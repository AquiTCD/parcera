import os
import asyncio
import numpy as np
import logging
from faster_whisper import WhisperModel
import moonshine_voice
from moonshine_voice.moonshine_api import ModelArch
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
        whisper_vad_filter=False,
        on_recognized_callback=None,
        download_root=None,
        debug=False
    ):
        super().__init__(debug=debug)
        self.on_recognized_callback = on_recognized_callback
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
        self._transcribe_lock = asyncio.Lock()

    async def recognize(self, session_id: str, data: bytes) -> SpeechRecognitionResult:
        text = ""
        try:
            text = await self.transcribe(data, session_id)
        except Exception as e:
            logger.error(f"STT: Transcription error: {e}")
            return SpeechRecognitionResult(text="")

        if text:
            logger.info(f"STT: Recognized (Raw): {text}")
            return SpeechRecognitionResult(text=text)
        else:
            return SpeechRecognitionResult(text="")

    async def transcribe(self, data: bytes, session_id: str = None) -> str:
        audio_int16 = np.frombuffer(data, dtype=np.int16)
        audio_float32 = audio_int16.astype(np.float32) / 32768.0

        # Diagnostics: Sample Rate Check
        duration_internal = len(audio_float32) / 16000
        logger.debug(f"STT: Received {len(data)} bytes. Internal duration assuming 16kHz: {duration_internal:.2f}s")

        async with self._transcribe_lock:
            # 🌙 Note: We removed the busy check here to prevent self-blocking
            # when recognize sets the busy flag right before calling transcribe.
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
                return [s.text for s in segments_iter]

            collected_texts = await loop.run_in_executor(None, _execute_transcribe)

        for t in collected_texts:
            logger.debug(f"STT: Segment: {t}")

        text = "".join(collected_texts).strip()
        return text


class MoonshineRecognizer(SpeechRecognizer):
    def __init__(
        self,
        model_name="base-ja",
        flags=0,
        response_filter=None,
        on_recognized_callback=None,
        debug=False
    ):
        super().__init__(debug=debug)
        self.on_recognized_callback = on_recognized_callback
        self.model_name = model_name
        
        # Map string model name to enum if available
        arch = ModelArch.TINY
        if "base" in model_name.lower():
            arch = ModelArch.BASE
        
        logger.info(f"Loading Moonshine model: {arch.name}...")

        # In Parcera, we strictly separate download and load.
        # But for Moonshine, get_model_for_language is fast if files exist.
        model_path, model_arch = moonshine_voice.get_model_for_language("ja", wanted_model_arch=arch)
        
        # Verify it actually exists (avoiding automatic download if not intended,
        # though get_model_for_language might trigger it if not careful.
        # Let's check it manually like in check_model_cached)
        if not os.path.exists(model_path):
             raise FileNotFoundError(f"Moonshine model not found at {model_path}. Download it in Settings.")

        self.transcriber = moonshine_voice.Transcriber(model_path, model_arch)
        
        self.flags = flags
        self._transcribe_lock = asyncio.Lock()

    async def recognize(self, session_id: str, data: bytes) -> SpeechRecognitionResult:
        logger.info(f"STT (Moonshine): Starting recognition for session {session_id} (data length: {len(data)} bytes)")

        text = ""
        try:
            text = await self.transcribe(data, session_id)
        except Exception as e:
            logger.error(f"STT (Moonshine): Transcription error: {e}")
            return SpeechRecognitionResult(text="")

        if text:
            logger.info(f"STT (Moonshine): Recognized (Raw): {text}")
            return SpeechRecognitionResult(text=text)
        else:
            return SpeechRecognitionResult(text="")

    async def transcribe(self, data: bytes, session_id: str = None) -> str:
        audio_int16 = np.frombuffer(data, dtype=np.int16)
        audio_float32 = audio_int16.astype(np.float32) / 32768.0

        # Diagnostics
        duration = len(audio_float32) / 16000
        logger.debug(f"STT (Moonshine): Transcribing {duration:.2f}s of audio with flags={self.flags}")

        async with self._transcribe_lock:
            loop = asyncio.get_event_loop()
            def _execute_transcribe():
                transcript = self.transcriber.transcribe_without_streaming(audio_float32, flags=self.flags)
                return "".join([l.text for l in transcript.lines])

            text = await loop.run_in_executor(None, _execute_transcribe)

        # Post-processing: Moonshine (and sometimes Whisper) adds spaces between Japanese characters.
        if text:
            import re
            # 1. Remove spaces between Japanese characters (Hiragana, Katakana, CJK Ideographs)
            jp_regex = r'([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF])\s+([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF])'
            while re.search(jp_regex, text):
                text = re.sub(jp_regex, r'\1\2', text)
            
            # 2. Remove spaces between Japanese and Latin characters
            text = re.sub(r'([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF])\s+([a-zA-Z0-9])', r'\1\2', text)
            text = re.sub(r'([a-zA-Z0-9])\s+([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF])', r'\1\2', text)

            # 3. Remove spaces between single Latin characters (e.g. "L L M" -> "LLM")
            single_latin_regex = r'(^|\s)([a-zA-Z0-9])\s+([a-zA-Z0-9])(\s|$)'
            while re.search(single_latin_regex, text):
                text = re.sub(single_latin_regex, r'\1\2\3\4', text)
            
            text = text.strip()

        return text
