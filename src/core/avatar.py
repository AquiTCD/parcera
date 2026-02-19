import logging
import os
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
