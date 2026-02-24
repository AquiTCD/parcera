import logging
import os
import asyncio
from core.config import ParceraConfig
from core.factory import ParceraComponentFactory

logger = logging.getLogger(__name__)

class ParceraAvatarBase:
    def __init__(self):
        self.config = ParceraConfig()

        # Reset conversation history on startup unless persistence is enabled
        llm_cfg = self.config.get("llm", {})
        provider = llm_cfg.get("provider", "gemini")
        provider_cfg = llm_cfg.get("providers", {}).get(provider, {})
        persist_history = provider_cfg.get("persist_history", False)

        db_path = os.path.join(self.config.app_data_dir, "aiavatar.db")
        if not persist_history and os.path.exists(db_path):
            try:
                os.remove(db_path)
                logger.info(f"Deleted {db_path} (History reset)")
            except Exception as e:
                logger.warning(f"Failed to delete {db_path}: {e}")

        self.factory = ParceraComponentFactory(self.config)
        self._busy_sessions = {}  # session_id -> Timer task

        self.llm = self.factory.build_llm()
        self.stt = self.factory.build_stt(is_busy_handler=self._is_ai_busy_check)
        self.tts = self.factory.build_tts()
        self.vad = self.factory.build_vad()

    def _is_ai_busy_check(self, session_id: str) -> bool:
        return session_id in self._busy_sessions

    def set_busy(self, session_id: str, busy: bool, timeout: float = 60.0):
        # Cancel existing timer if any
        if session_id in self._busy_sessions:
            self._busy_sessions[session_id].cancel()
            del self._busy_sessions[session_id]

        if busy:
            logger.debug(f"Setting busy flag for {session_id} (Timeout: {timeout}s)")

            def clear_busy():
                if session_id in self._busy_sessions:
                    logger.warning(f"Busy flag timeout reached for {session_id}. Forcing reset.")
                    del self._busy_sessions[session_id]

            loop = asyncio.get_event_loop()
            self._busy_sessions[session_id] = loop.call_later(timeout, clear_busy)
        else:
            logger.debug(f"Clearing busy flag for {session_id}")

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
