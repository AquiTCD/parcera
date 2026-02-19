import logging
import os
import asyncio
from .config import ParceraConfig
from .factory import ParceraComponentFactory

logger = logging.getLogger(__name__)

class ParceraAvatarBase:
    def __init__(self, google_api_key: str = None):
        self.google_api_key = google_api_key or os.getenv("GOOGLE_API_KEY")
        if not self.google_api_key:
            raise ValueError("GOOGLE_API_KEY is required.")

        self.config = ParceraConfig()

        # Reset conversation history on startup unless persistence is enabled
        persist_history = self.config.get("llm_persist_history", False)
        if not persist_history and os.path.exists("aiavatar.db"):
            try:
                os.remove("aiavatar.db")
                logger.info("Deleted aiavatar.db (History reset)")
            except Exception as e:
                logger.warning(f"Failed to delete aiavatar.db: {e}")

        self.factory = ParceraComponentFactory(self.config, self.google_api_key)
        self._busy_sessions = set()

        self.llm = self.factory.build_llm()
        self.stt = self.factory.build_stt(is_busy_handler=self._is_ai_busy_check)
        self.tts = self.factory.build_tts()
        self.vad = self.factory.build_vad()

    def _is_ai_busy_check(self, session_id: str) -> bool:
        return session_id in self._busy_sessions

    def set_busy(self, session_id: str, busy: bool):
        if busy:
            self._busy_sessions.add(session_id)
        else:
            self._busy_sessions.discard(session_id)

    async def warmup(self):
        """
        Initialize components to reduce latency on first user interaction.
        """
        logger.info("Initializing components (Warm-up)...")
        tasks = []

        # 1. Warm-up LLM (Connection establishment)
        if hasattr(self.llm, "warmup"):
            tasks.append(self.llm.warmup())

        # 2. Warm-up TTS (Engine startup)
        # Synthesize a tiny silent character to wake up the engine/audio device
        try:
            # Using asyncio.to_thread if synchronous, but most TTS clients are async-capable (or wrapped)
            # Assuming self.tts.synthesize is async or fast enough
            if asyncio.iscoroutinefunction(self.tts.voice_text_to_wav):
                tasks.append(self.tts.voice_text_to_wav("。"))
            else:
                # If sync, run in executor
                loop = asyncio.get_running_loop()
                tasks.append(loop.run_in_executor(None, self.tts.voice_text_to_wav, "。"))
        except Exception as e:
             logger.warning(f"TTS Warm-up setup failed: {e}")

        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for res in results:
                if isinstance(res, Exception):
                     logger.warning(f"Warm-up task failed: {res}")

        logger.info("Warm-up complete.")

    async def cleanup(self):
        if hasattr(self.tts, "close"):
            await self.tts.close()

    def get_components(self):
        return {
            "llm": self.llm,
            "stt": self.stt,
            "tts": self.tts,
            "vad": self.vad
        }
