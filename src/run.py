
import asyncio
import logging
import os
import random
import httpx
from dotenv import load_dotenv
from aiavatar import AIAvatar
from aiavatar.sts.vad.standard import StandardSpeechDetector
from gemini_fix import FixedGeminiService
from custom_components import (
    KotobaWhisperRecognizer,
    FineTunedVoicevoxTTS,
    ResponseWeightFilter,
    load_text_file,
    load_config_file
)

class TTSEngineManager:
    def __init__(self, engine_path: str, api_url: str):
        self.engine_path = engine_path
        self.api_url = api_url
        self.process = None

    async def is_running(self) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.api_url}/version", timeout=1.0)
                return response.status_code == 200
        except Exception:
            return False

    async def start(self):
        if await self.is_running():
            logger.info(f"TTS Engine is already running at {self.api_url}")
            return

        if not self.engine_path or not os.path.exists(self.engine_path):
            msg = f"TTS Engine not found at {self.engine_path} and no service is running at {self.api_url}."
            logger.error(msg)
            raise FileNotFoundError(msg)

        logger.info(f"Starting TTS Engine: {self.engine_path}")
        self.process = await asyncio.create_subprocess_exec(
            self.engine_path,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL
        )

        # Wait for engine to be ready
        logger.info("Waiting for TTS Engine to be ready...")
        for _ in range(30):
            if await self.is_running():
                logger.info("TTS Engine is ready!")
                return
            await asyncio.sleep(1)

        raise RuntimeError("TTS Engine failed to start within 30 seconds.")

    async def stop(self):
        if self.process:
            logger.info("Stopping TTS Engine...")
            self.process.terminate()
            await self.process.wait()
            logger.info("TTS Engine stopped.")


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ParceraAvatar:
    def __init__(self, google_api_key: str):
        self.google_api_key = google_api_key
        # Load all settings from YAML
        self.settings = load_config_file("configs/settings.yaml")

        # 1. Load Prompts

        system_prompt = load_text_file("prompts/system_prompt.md")
        context_prompt = load_text_file("prompts/context_prompt.md")
        self.full_system_prompt = f"{system_prompt}\n\n{context_prompt}" if context_prompt else system_prompt

        # 2. Build Components
        self.llm = self._build_llm()
        self.stt = self._build_stt()
        self.tts = self._build_tts()
        self.vad = self._build_vad()

        # 3. Initialize App
        self.app = AIAvatar(
            llm=self.llm,
            stt=self.stt,
            vad=self.vad,
            tts=self.tts,
            voice_recorder_enabled=False,
            debug=True
        )

    def _build_llm(self):
        return FixedGeminiService(
            gemini_api_key=self.google_api_key,
            model="gemini-2.5-flash",
            system_prompt=self.full_system_prompt,
            debug=True
        )

    def _build_stt(self):
        force_keywords = self.settings.get("force_keywords", ["パルセラ"])


        response_filter = ResponseWeightFilter(force_keywords=force_keywords)
        return KotobaWhisperRecognizer(
            model_name="longisland3/kotoba-whisper-v2.2-faster",
            device="cpu",
            compute_type="int8",
            initial_prompt_path="prompts/stt_initial_prompt.md",
            response_filter=response_filter,
            debug=True
        )

    def _build_tts(self):
        # Priority: settings.yaml > Code Default
        active_engine = self.settings.get("active_engine", "voicevox")
        engine_cfg = self.settings.get("engines", {}).get(active_engine, {})
        
        # Determine Base URL
        default_url = "http://127.0.0.1:50021" if active_engine == "voicevox" else "http://127.0.0.1:10101"
        base_url = engine_cfg.get("api_url", default_url)
        
        # Determine Speaker ID (style_id for Aivis)
        default_speaker = 3 if active_engine == "voicevox" else 888753760
        speaker_id_raw = engine_cfg.get("speaker_id") or engine_cfg.get("style_id") or default_speaker
        speaker_id = int(speaker_id_raw)
        
        tts_settings = self.settings.get("tts_settings", {
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


    def _build_vad(self):
        vad_cfg = self.settings.get("vad", {})
        return StandardSpeechDetector(
            volume_db_threshold=vad_cfg.get("volume_db_threshold", -10.0),
            max_duration=vad_cfg.get("max_duration", 15.0),
            debug=True
        )



    async def start(self):
        logger.info("Parcera Avatar is starting... Press Ctrl+C to stop.")
        try:
            await self.app.start_listening()
        except asyncio.CancelledError:
            logger.info("Application stopped by user.")
        except Exception as e:
            logger.error(f"An error occurred: {e}", exc_info=True)

async def main():
    # Load environment variables
    load_dotenv()

    google_api_key = os.getenv("GOOGLE_API_KEY")

    if not google_api_key:
        logger.error("GOOGLE_API_KEY is not set in .env file.")
        return

    # Load settings to get active engine config
    settings = load_config_file("configs/settings.yaml")
    active_engine = settings.get("active_engine", "voicevox")
    engine_cfg = settings.get("engines", {}).get(active_engine, {})

    # Resolve paths (Config > Default)
    # Note: engine_path is also purely from config/default
    default_url = "http://127.0.0.1:50021" if active_engine == "voicevox" else "http://127.0.0.1:10101"
    tts_api_url = engine_cfg.get("api_url", default_url)
    tts_engine_path = engine_cfg.get("engine_path")

    # 1. Manage TTS Engine
    engine_manager = TTSEngineManager(tts_engine_path, tts_api_url)
    try:
        await engine_manager.start()

        # 2. Initialize and run the avatar
        avatar = ParceraAvatar(google_api_key=google_api_key)
        
        await avatar.start()

    finally:
        await engine_manager.stop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
