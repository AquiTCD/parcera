import os
import logging
from aiavatar.sts.vad.standard import StandardSpeechDetector
from aiavatar.sts.llm.chatgpt import ChatGPTService # Fixed import
from aiavatar.sts.llm.context_manager import SQLiteContextManager
from aiavatar.sts.stt.google import GoogleSpeechRecognizer
from aiavatar.sts.stt.azure import AzureSpeechRecognizer
from aiavatar.sts.tts.google import GoogleSpeechSynthesizer # Fixed import
from core.config import ParceraConfig
from core.stt import KotobaWhisperRecognizer, NoOpRecognizer, MoonshineRecognizer
from core.tts import FineTunedVoicevoxTTS
from core.gemini import FixedGeminiService
from core.wrappers import ParceraLLMWrapper, ParceraSTTWrapper
from core.filters import ResponseWeightFilter

logger = logging.getLogger(__name__)

class ParceraComponentFactory:
    def __init__(self, config: ParceraConfig):
        self.config = config

    def build_llm(self):
        llm_cfg = self.config.get("llm", {})
        provider = llm_cfg.get("provider", "gemini")
        providers = llm_cfg.get("providers", {})

        service_instance = None

        if provider == "gemini":
            gemini_cfg = providers.get("gemini", {})
            api_key = gemini_cfg.get("api_key")
            if not api_key:
                logger.warning("Gemini API key is missing. Set it in Settings -> LLM.")

            db_path = os.path.join(self.config.app_data_dir, "aiavatar.db")
            context_manager = SQLiteContextManager(db_path=db_path)

            service_instance = FixedGeminiService(
                gemini_api_key=api_key,
                context_manager=context_manager,
                model=gemini_cfg.get("model", "gemini-2.0-flash"),
                temperature=float(gemini_cfg.get("temperature", 1.0)),
                option_split_threshold=int(gemini_cfg.get("option_split_threshold", 15)),
                system_prompt=self.config.full_system_prompt,
                profile_mode=self.config.profile_mode,
                debug=self.config.verbose
            )
        elif provider == "openai":
            openai_cfg = providers.get("openai", {})
            api_key = openai_cfg.get("api_key")
            if not api_key:
                logger.warning("OpenAI API key is missing. Set it in Settings -> LLM.")

            db_path = os.path.join(self.config.app_data_dir, "aiavatar.db")
            context_manager = SQLiteContextManager(db_path=db_path)

            # NOTE: ChatGPTService arguments differ from ChatGPT
            service_instance = ChatGPTService(
                openai_api_key=api_key,
                context_manager=context_manager,
                model=openai_cfg.get("model", "gpt-4o"),
                temperature=float(openai_cfg.get("temperature", 1.0)),
                system_prompt=self.config.full_system_prompt,
            )
            return ParceraLLMWrapper(service_instance, profile_mode=self.config.profile_mode)

        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")

        return service_instance

    def build_stt(self, on_recognized_callback=None, is_busy_handler=None, set_busy_handler=None):
        stt_cfg = self.config.get("stt", {})
        provider = stt_cfg.get("provider", "faster_whisper")
        providers = stt_cfg.get("providers", {})

        # Filters setup
        force_keywords = self.config.get("force_keywords", ["パルセラ", "Parcera", "教えて"])
        sensitivity = self.config.get("response_sensitivity", "medium")
        ignore_sentences = stt_cfg.get("ignore_sentences", ["うん", "はい", "ごめん"])
        response_filter = ResponseWeightFilter(
            force_keywords=force_keywords,
            ignore_sentences=ignore_sentences,
            sensitivity=sensitivity,
            presets=self.config.get("sensitivity_presets")
        )

        recognizer_instance = None

        if provider == "faster_whisper":
            fw_cfg = providers.get("faster_whisper", {})
            vad_cfg = self.config.get("vad", {})
            whisper_vad_filter = fw_cfg.get("whisper_vad_filter", False)
            device = fw_cfg.get("device", "cpu")
            compute_type = fw_cfg.get("compute_type", "int8")

            # CTranslate2 (faster-whisper backend) does not support 'mps'.
            # Force to 'cpu' if someone has it set from an older config.
            # Also reset compute_type since float16 (often paired with mps) is not supported on CPU.
            if device == "mps":
                logger.info("STT: 'mps' is not supported by CTranslate2. Using 'cpu' with 'int8' instead.")
                device = "cpu"
                compute_type = "int8"

            try:
                recognizer_instance = KotobaWhisperRecognizer(
                    model_name=fw_cfg.get("model", "longisland3/kotoba-whisper-v2.2-faster"),
                    device=device,
                    compute_type=compute_type,
                    initial_prompt=self.config.full_stt_prompt,
                    whisper_vad_filter=whisper_vad_filter,
                    on_recognized_callback=on_recognized_callback,
                    debug=self.config.verbose
                )
            except Exception as e:
                logger.warning(f"STT: Failed to load model (not downloaded yet?). STT disabled until model is downloaded via Settings. Error: {e}")
                recognizer_instance = NoOpRecognizer(debug=self.config.verbose)

        elif provider == "moonshine":
            ms_cfg = providers.get("moonshine", {})
            try:
                recognizer_instance = MoonshineRecognizer(
                    model_name=ms_cfg.get("model", "base-ja"),
                    flags=int(ms_cfg.get("flags", 0)),
                    on_recognized_callback=on_recognized_callback,
                    debug=self.config.verbose
                )
            except Exception as e:
                logger.error(f"STT: Failed to load Moonshine model: {e}")
                recognizer_instance = NoOpRecognizer(debug=self.config.verbose)

        elif provider == "google":
            google_cfg = providers.get("google", {})
            api_key = google_cfg.get("api_key")
            if not api_key:
                 logger.warning("Google STT API key is missing. Set it in Settings -> STT.")
            recognizer_instance = GoogleSpeechRecognizer(
                google_api_key=api_key,
                language=google_cfg.get("language", "ja-JP"),
            )

            return ParceraSTTWrapper(
                wrapped_recognizer=recognizer_instance,
                is_busy_handler=is_busy_handler,
                set_busy_handler=set_busy_handler,
                response_filter=response_filter,
                on_recognized_callback=on_recognized_callback
            )

        elif provider == "azure":
            azure_cfg = providers.get("azure", {})
            api_key = azure_cfg.get("api_key")
            region = azure_cfg.get("region")
            if not api_key or not region:
                logger.warning("Azure Speech API key or Region is missing. Set it in Settings -> STT.")

            recognizer_instance = AzureSpeechRecognizer(
                azure_api_key=api_key,
                azure_region=region,
                language=azure_cfg.get("language", "ja-JP")
            )

        else:
             raise ValueError(f"Unsupported STT provider: {provider}")

        # Wrap the selected recognizer to provide consistent busy/filter logic
        return ParceraSTTWrapper(
            recognizer_instance,
            is_busy_handler=is_busy_handler,
            set_busy_handler=set_busy_handler,
            response_filter=response_filter,
            on_recognized_callback=on_recognized_callback
        )

    def build_tts(self):
        tts_cfg = self.config.get("tts", {})
        provider = tts_cfg.get("provider", "voicevox")
        providers = tts_cfg.get("providers", {})

        # Common settings applied to compatible engines (Voicevox-based)
        tts_settings = tts_cfg.get("settings", {})

        if provider in ["voicevox", "aivisspeech"]:
            vv_cfg = providers.get(provider, {})
            base_url = vv_cfg.get("api_url", "http://127.0.0.1:50021")
            speaker_id = int(vv_cfg.get("speaker_id") or vv_cfg.get("style_id") or 3)

            return FineTunedVoicevoxTTS(
                base_url=base_url,
                speaker_id=speaker_id,
                settings=tts_settings
            )

        elif provider == "google":
            google_cfg = providers.get("google", {})
            api_key = google_cfg.get("api_key")
            if not api_key:
                 logger.warning("Google TTS API key is missing. Set it in Settings -> TTS.")

            return GoogleSpeechSynthesizer(
                google_api_key=api_key,
                speaker=google_cfg.get("voice", "ja-JP-Neural2-B"),
                default_language=google_cfg.get("language", "ja-JP"),
            )

        else:
             raise ValueError(f"Unsupported TTS provider: {provider}")

    def build_vad(self, volume_db_threshold=None):
        vad_cfg = self.config.get("vad", {})
        threshold = volume_db_threshold if volume_db_threshold is not None else vad_cfg.get("volume_db_threshold", -20.0)

        silence_duration = vad_cfg.get("silence_duration_threshold", 0.4)
        logger.info(f"VAD Config: Threshold={threshold}dB, Silence={silence_duration}s, MaxDur={vad_cfg.get('max_duration', 15.0)}")

        return StandardSpeechDetector(
            volume_db_threshold=threshold,
            silence_duration_threshold=silence_duration,
            max_duration=vad_cfg.get("max_duration", 15.0),
            debug=self.config.verbose
        )
