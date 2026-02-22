import asyncio
import logging
import os
from dotenv import load_dotenv
from aiavatar import AIAvatar
from core.avatar import ParceraAvatarBase
from core.engine import TTSEngineManager
from core.config import load_config_file

logger = logging.getLogger(__name__)

class ParceraAvatarLocal(ParceraAvatarBase):
    def __init__(self):
        super().__init__()
        self.config.setup_logging()

        # Initialize App for local use
        self.app = AIAvatar(
            llm=self.llm,
            stt=self.stt,
            vad=self.vad,
            tts=self.tts,
            voice_recorder_enabled=False,
            debug=True
        )

    async def start(self):
        logger.info("Parcera Avatar (Local) is starting... Press Ctrl+C to stop.")
        try:
            await self.app.start_listening()
        except asyncio.CancelledError:
            logger.info("Application stopped by user.")
        except Exception as e:
            logger.error(f"An error occurred: {e}", exc_info=True)

async def main():
    load_dotenv()
    load_dotenv(".env.config_path", override=True)

    # Load settings for engine management
    config_path = os.environ.get("PARCERA_CONFIG_PATH", "configs/settings.default.yaml")
    settings = load_config_file(config_path)
    active_engine = settings.get("active_engine", "voicevox")
    engine_cfg = settings.get("engines", {}).get(active_engine, {})

    tts_api_url = engine_cfg.get("api_url", "http://127.0.0.1:50021" if active_engine == "voicevox" else "http://127.0.0.1:10101")
    tts_engine_path = engine_cfg.get("engine_path")

    # 1. Manage TTS Engine
    engine_manager = TTSEngineManager(tts_engine_path, tts_api_url)
    try:
        await engine_manager.start()

        # 2. Initialize and run the avatar
        avatar = ParceraAvatarLocal()
        await avatar.start()

    finally:
        if 'avatar' in locals():
            await avatar.cleanup()
        await engine_manager.stop()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
