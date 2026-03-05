import os
import asyncio
import numpy as np
import logging
import abc
from faster_whisper import WhisperModel
import moonshine_voice
from typing import Optional
from moonshine_voice.moonshine_api import ModelArch
from aiavatar.sts.stt import SpeechRecognizer
from aiavatar.sts.stt.base import SpeechRecognitionResult
from services.training_service import TrainingService

logger = logging.getLogger(__name__)

class LocalSpeechRecognizer(SpeechRecognizer, abc.ABC):
    """Base class for local STT providers handling locking, audio conversion, and Japanese text cleaning."""
    def __init__(self, debug=False):
        super().__init__(debug=debug)
        self._transcribe_lock = asyncio.Lock()

    async def recognize(self, session_id: str, data: bytes) -> SpeechRecognitionResult:
        logger.info(f"STT ({self.__class__.__name__}): Starting recognition for session {session_id} (data length: {len(data)} bytes)")
        text = ""
        try:
            text = await self.transcribe(data, session_id)
        except Exception as e:
            logger.error(f"STT ({self.__class__.__name__}): Transcription error: {e}")
            return SpeechRecognitionResult(text="")

        if text:
            logger.info(f"STT ({self.__class__.__name__}): Recognized (Raw): {text}")
            return SpeechRecognitionResult(text=text)
        else:
            return SpeechRecognitionResult(text="")

    async def transcribe(self, data: bytes, session_id: Optional[str] = None) -> str:
        audio_int16 = np.frombuffer(data, dtype=np.int16)
        audio_float32 = audio_int16.astype(np.float32) / 32768.0

        duration = len(audio_float32) / 16000
        logger.debug(f"STT ({self.__class__.__name__}): Transcribing {duration:.2f}s of audio")

        async with self._transcribe_lock:
            loop = asyncio.get_event_loop()
            text = await loop.run_in_executor(None, self._do_transcribe, audio_float32)

        # Post-processing: Clean up spaces commonly added by models like Moonshine when outputting Japanese
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

    @abc.abstractmethod
    def _do_transcribe(self, audio_float32) -> str:
        """Process audio numpy array and return transcribed text string."""
        pass


class NoOpRecognizer(SpeechRecognizer):
    """Placeholder STT that silently ignores all input. Used when the model is not yet downloaded."""

    def __init__(self, debug=False):
        super().__init__(debug=debug)
        self.on_recognized_callback = None
        logger.info("STT: NoOpRecognizer active. Download the model from Settings to enable speech recognition.")

    async def recognize(self, session_id: str, data: bytes) -> SpeechRecognitionResult:
        return SpeechRecognitionResult(text="")

    async def transcribe(self, data: bytes, session_id: Optional[str] = None) -> str:
        return ""


class KotobaWhisperRecognizer(LocalSpeechRecognizer):
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

    def _do_transcribe(self, audio_float32):
        segments_iter, info = self.model.transcribe(
            audio_float32,
            language="ja",
            initial_prompt=self.initial_prompt if self.initial_prompt else None,
            beam_size=5,
            vad_filter=self.whisper_vad_filter,
            temperature=0.0,
        )
        return "".join([s.text for s in segments_iter]).strip()


class MoonshineRecognizer(LocalSpeechRecognizer):
    def __init__(
        self,
        model_name="base-ja",
        flags=0,
        on_recognized_callback=None,
        active_profile="default",
        adapter_enabled=True,
        debug=False
    ):
        super().__init__(debug=debug)
        self.on_recognized_callback = on_recognized_callback
        self.model_name = model_name
        self.active_profile = active_profile
        self.adapter_enabled = adapter_enabled
        
        # Map string model name to enum if available
        arch = ModelArch.TINY
        if "base" in model_name.lower():
            arch = ModelArch.BASE
        
        logger.info(f"Loading Moonshine model: {arch.name}...")

        model_path, model_arch = moonshine_voice.get_model_for_language("ja", wanted_model_arch=arch)
        
        if not os.path.exists(model_path):
             raise FileNotFoundError(f"Moonshine model not found at {model_path}. Download it in Settings.")

        # Check for LoRA adapters if enabled
        options = {}
        if adapter_enabled:
            try:
                training_service = TrainingService(profile_id=active_profile)
                adapter_path = training_service.get_active_adapter()
                if adapter_path:
                    logger.info(f"Moonshine: LoRA adapter ENABLED using profile '{active_profile}' at {adapter_path}")
                    options["adapter_path"] = adapter_path
                else:
                    logger.info(f"Moonshine: No adapter found for profile '{active_profile}'. Using standard model.")
            except Exception as e:
                logger.warning(f"Moonshine: Failed to check for adapters: {e}")
        else:
            logger.info("Moonshine: LoRA adapter DISABLED by settings.")

        self.transcriber = moonshine_voice.Transcriber(model_path, model_arch, options=options)
        self.flags = flags

    def _do_transcribe(self, audio_float32):
        transcript = self.transcriber.transcribe_without_streaming(audio_float32, flags=self.flags)
        return "".join([l.text for l in transcript.lines])

    def reload(self):
        """Hot-reload the transcriber to apply/remove LoRA adapters without restarting the engine."""
        arch = ModelArch.TINY
        if "base" in self.model_name.lower():
            arch = ModelArch.BASE
        
        model_path, model_arch = moonshine_voice.get_model_for_language("ja", wanted_model_arch=arch)
        
        # We need the original parameters. Since they are simple values, let's assume we can use self.model_name
        # But we need adapter_enabled and active_profile. 
        # For simplicity, we'll re-run the logic with the current state if we had it, but for now
        # let's just make sure this method exists and tries to reload based on disk state.
        
        # Improved: let's store these in __init__
        options = {}
        if getattr(self, "adapter_enabled", True):
            try:
                training_service = TrainingService(profile_id=getattr(self, "active_profile", "default"))
                adapter_path = training_service.get_active_adapter()
                if adapter_path:
                    logger.info(f"Moonshine Reload: LoRA adapter ENABLED at {adapter_path}")
                    options["adapter_path"] = adapter_path
            except Exception as e:
                logger.warning(f"Moonshine Reload: Failed to check for adapters: {e}")

        self.transcriber = moonshine_voice.Transcriber(model_path, model_arch, options=options)
        logger.info("Moonshine: Transcriber reloaded successfully.")
