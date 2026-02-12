import os
import random
import logging
import asyncio
import numpy as np
import httpx
import yaml
from faster_whisper import WhisperModel

from aiavatar.sts.stt import SpeechRecognizer
from aiavatar.sts.tts.voicevox import VoicevoxSpeechSynthesizer

logger = logging.getLogger(__name__)

class KotobaWhisperRecognizer(SpeechRecognizer):
    def __init__(self, model_name="longisland3/kotoba-whisper-v2.2-faster", device="auto", compute_type="default", initial_prompt_path=None, response_filter=None, debug=False):
        super().__init__(debug=debug)
        self.model_name = model_name
        logger.info(f"Loading Faster-Whisper model: {model_name} on {device}...")
        self.model = WhisperModel(model_name, device=device, compute_type=compute_type)
        self.initial_prompt = ""
        if initial_prompt_path and os.path.exists(initial_prompt_path):
            with open(initial_prompt_path, "r", encoding="utf-8") as f:
                content = f.read()
                # Extract only lines starting with '-' and remove the hyphen
                words = [line.strip("- ").strip() for line in content.splitlines() if line.startswith("-")]
                self.initial_prompt = ", ".join(words)
            logger.info(f"Loaded STT initial prompt words: {self.initial_prompt}")
        self.response_filter = response_filter

    async def transcribe(self, data: bytes) -> str:
        # Convert audio bytes to float32
        audio_int16 = np.frombuffer(data, dtype=np.int16)
        audio_float32 = audio_int16.astype(np.float32) / 32768.0

        duration = len(audio_float32) / 16000
        max_vol = np.max(np.abs(audio_float32))
        if self.debug:
            logger.info(f"Transcribing audio: {len(audio_float32)} samples ({duration:.2f}s), Max Vol: {max_vol:.4f}")

        # Run transcription in executor to avoid blocking
        loop = asyncio.get_event_loop()
        segments, info = await loop.run_in_executor(
            None,
            lambda: self.model.transcribe(
                audio_float32,
                language="ja",
                initial_prompt=self.initial_prompt if self.initial_prompt else None,
                beam_size=5,
                vad_filter=True,
                temperature=0.0,
                vad_parameters=dict(min_silence_duration_ms=500) # Slightly more aggressive VAD
            )
        )

        collected_segments = []
        for s in segments:
            collected_segments.append(s.text)
            if self.debug:
                logger.info(f"Segment: {s.text} (prob: {s.avg_logprob:.2f})")

        text = "".join(collected_segments).strip()

        if self.debug:
            logger.info(f"Kotoba-Whisper Recognized: {text}")

        # Apply Response Filter
        if self.response_filter and text:
            if not self.response_filter.should_respond(text):
                logger.info(f"Ignored by filter: {text}")
                return "" # Return empty string to silence the response

        return text

class FineTunedVoicevoxTTS(VoicevoxSpeechSynthesizer):
    def __init__(self, base_url: str, speaker_id: int, settings: dict):
        super().__init__(base_url=base_url, speaker=speaker_id)
        self.settings = settings

    async def synthesize(self, text: str, style_info: dict = None, language: str = None) -> bytes:
        # Override synthesize to apply fine-tuned parameters
        async with httpx.AsyncClient() as client:
            # 1. Create Audio Query
            query_res = await client.post(
                f"{self.base_url}/audio_query",
                params={"text": text, "speaker": self.speaker}
            )
            query_res.raise_for_status()
            query_data = query_res.json()

            # 2. Apply Custom Settings
            for key, value in self.settings.items():
                query_data[key] = value

            # 3. Synthesis
            synth_res = await client.post(
                f"{self.base_url}/synthesis",
                params={"speaker": self.speaker},
                json=query_data,
                timeout=None
            )
            synth_res.raise_for_status()

            return synth_res.content

class ResponseWeightFilter:
    def __init__(self, force_keywords=None):
        self.force_keywords = force_keywords or ["パルセラ", "だね", "どう", "教えて"]

    def should_respond(self, text: str) -> bool:
        if not text:
            return False

        # 1. Check Force Keywords
        for kw in self.force_keywords:
            if kw in text:
                logger.info(f"Force respond keyword detected: {kw}")
                return True

        # 2. Probability by Length
        # Example: 1 char = 10%, 10 chars = 50%, 20+ chars = 90%
        length = len(text)
        probability = min(0.95, 0.3 + (length * 0.05))


        rolled = random.random()
        decision = rolled < probability
        logger.info(f"Response decision: {decision} (Prob: {probability:.2f}, Roll: {rolled:.2f}, Len: {length})")

        return decision

def load_text_file(path: str) -> str:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    return ""

def load_config_file(path: str) -> dict:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    return {}
