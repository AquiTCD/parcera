import os
import logging
from aiavatar.sts.vad.standard import StandardSpeechDetector
from .config import ParceraConfig
from .stt import KotobaWhisperRecognizer
from .tts import FineTunedVoicevoxTTS
from .filters import ResponseWeightFilter
from .gemini import FixedGeminiService

logger = logging.getLogger(__name__)

class ParceraComponentFactory:
    def __init__(self, config: ParceraConfig, google_api_key: str):
        self.config = config
        self.google_api_key = google_api_key

    def build_llm(self):
        return FixedGeminiService(
            gemini_api_key=self.google_api_key,
            model=self.config.get("llm_model", "gemini-2.0-flash"),
            temperature=float(self.config.get("llm_temperature", 0.7)),
            option_split_threshold=int(self.config.get("option_split_threshold", 20)),
            system_prompt=self.config.full_system_prompt,
            debug=self.config.verbose
        )

    def build_stt(self, on_recognized_callback=None, is_busy_handler=None):
        force_keywords = self.config.get("force_keywords", ["パルセラ"])
        sensitivity = self.config.get("response_sensitivity", "medium")
        response_filter = ResponseWeightFilter(force_keywords=force_keywords, sensitivity=sensitivity)

        vad_cfg = self.config.get("vad", {})
        whisper_vad_filter = vad_cfg.get("whisper_vad_filter", False)

        return KotobaWhisperRecognizer(
            model_name="longisland3/kotoba-whisper-v2.2-faster",
            device="cpu",
            compute_type="int8",
            initial_prompt_path="prompts/stt_initial_prompt.md",
            response_filter=response_filter,
            whisper_vad_filter=whisper_vad_filter,
            on_recognized_callback=on_recognized_callback,
            is_busy_handler=is_busy_handler,
            debug=self.config.verbose
        )

    def build_tts(self):
        active_engine = self.config.get("active_engine", "voicevox")
        engine_cfg = self.config.get("engines", {}).get(active_engine, {})

        default_url = "http://127.0.0.1:50021" if active_engine == "voicevox" else "http://127.0.0.1:10101"
        base_url = engine_cfg.get("api_url", default_url)

        default_speaker = 3 if active_engine == "voicevox" else 888753760
        speaker_id = int(engine_cfg.get("speaker_id") or engine_cfg.get("style_id") or default_speaker)

        tts_settings = self.config.get("tts_settings", {
            'speedScale': 1.25,
            'tempoDynamicScale': 0.7,
            'volumeScale': 0.50,
            'prePhonemeLength': 0,
            'postPhonemeLength': 0.20,
        })
        return FineTunedVoicevoxTTS(
            base_url=base_url,
            speaker_id=speaker_id,
            settings=tts_settings
        )

    def build_vad(self, volume_db_threshold=None):
        vad_cfg = self.config.get("vad", {})
        threshold = volume_db_threshold if volume_db_threshold is not None else vad_cfg.get("volume_db_threshold", -20.0)

        silence_duration = vad_cfg.get("silence_duration_threshold", 0.6)
        logger.info(f"VAD Config: Threshold={threshold}dB, Silence={silence_duration}s, MaxDur={vad_cfg.get('max_duration', 15.0)}")

        return StandardSpeechDetector(
            volume_db_threshold=threshold,
            silence_duration_threshold=silence_duration,
            max_duration=vad_cfg.get("max_duration", 15.0),
            debug=self.config.verbose
        )
