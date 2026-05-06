import logging
import time
from core.chat_logger import chat_logger
from core.filters import ResponseWeightFilter
from core.constants import TWITCH_SESSION_ID

logger = logging.getLogger(__name__)

class InteractionController:
    """
    Orchestrates the AI interaction pipeline:
    STT Recognized -> Filter Decisions -> Thinking Signals -> TTS Duration Estimation
    """
    def __init__(self, avatar, config):
        self.avatar = avatar
        self.config = config

    async def on_recognized(self, session_id: str, text: str, is_filtered: bool = False) -> bool:
        """Callback handled after STT processing.

        Returns True if the utterance was accepted and the STS pipeline should
        be invoked, False if it was dropped (busy guard, filtered, etc.).
        """
        # Hot-reload check (Always check, even if filtered, so settings stay fresh)
        if self.config.refresh():
            self.avatar.apply_runtime_config()
            logger.info("Config hot-reloaded automatically during recognition.")

        # Check if AI is occupied with high-priority Twitch response or Training
        if self.avatar.is_busy(source="twitch"):
            logger.info(f"Dropping user input because AI is busy with Twitch: {text}")
            self.avatar.set_busy(session_id, False)
            return False

        if self.avatar.is_busy(source="training"):
            logger.info(f"Dropping user input because AI is busy with Training: {text}")
            self.avatar.set_busy(session_id, False)
            return False

        # 1. Ignored Speech
        if is_filtered:
            chat_logger.log_user(text, ignored=True)
            self.avatar.set_busy(session_id, False)
            return False

        # 2. Approved Speech
        chat_logger.log_user(text)

        if self.config.profile_mode:
            logger.info(f"[PERF] STT Recognized: '{text}' at {time.time():.3f}")

        # Update Dynamic Merge Threshold
        weight = ResponseWeightFilter.calculate_weight(text)
        dynamic_threshold = max(0.5, min(1.5, 0.5 + (weight * 0.05)))

        if hasattr(self.avatar, "aiavatar_server"):
            self.avatar.aiavatar_server.merge_request_threshold = dynamic_threshold

            # Send 'thinking' signal to WebSocket clients
            if session_id in self.avatar.aiavatar_server.websockets:
                ws = self.avatar.aiavatar_server.websockets[session_id]
                try:
                    await ws.send_json({
                        "type": "thinking",
                        "session_id": session_id,
                        "text": text
                    })
                except Exception as e:
                    logger.error(f"Error sending 'thinking' signal: {e}")

        return True

    async def on_response(self, aiavatar_response, sts_response):
        """Callback handled when AI starts generating a response."""
        now = time.time()

        if sts_response.type == "final":
            # Estimate TTS duration
            timing_cfg = self.config.get("tts_timing", {})
            cps = timing_cfg.get("chars_per_second", 6.0)
            buffer = timing_cfg.get("buffer_latency", 2.5) # Increased for stability

            weight = ResponseWeightFilter.calculate_weight(sts_response.text)
            estimated_duration = (weight / cps) + buffer

            # Determine source: Twitch uses a specific session_id
            source = "twitch" if aiavatar_response.session_id == TWITCH_SESSION_ID else "user"

            logger.info(f"Response Final ({source}): Weight={weight}, CPS={cps}, BusyTimeout={estimated_duration:.2f}s")
            self.avatar.set_busy(aiavatar_response.session_id, True, timeout=estimated_duration, source=source)

            if self.config.profile_mode:
                logger.info(f"[PERF] Response Final: '{sts_response.text}' at {now:.3f}")

            chat_logger.log_ai(sts_response.text)

        elif sts_response.type == "chunk":
            if self.config.profile_mode:
                logger.info(f"[PERF] Response Chunk (TTS Start): '{sts_response.text}' at {now:.3f}")
