import asyncio
import logging
import re
from aiavatar.sts.models import STSRequest
from core.constants import TWITCH_SESSION_ID
from core.chat_logger import chat_logger

logger = logging.getLogger(__name__)

class TwitchService:
    CLEAN_TEXT_RE = re.compile(r"[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]")

    def __init__(self, server):
        self.server = server
        self.queue = asyncio.Queue()

    def _calculate_wait_time(self, text: str) -> float:
        twitch_cfg = self.server.config.get("twitch", {})
        speed = twitch_cfg.get("response_speed", "natural")

        presets = {
            "instant": [0.0, 0.0],
            "fast":    [0.1, 0.03],
            "natural": [0.2, 0.07],
            "slow":    [0.5, 0.12],
        }
        base, spw = presets.get(speed, presets["natural"])

        if speed == "instant":
            return base

        clean_text = self.CLEAN_TEXT_RE.sub("", text)
        weight = sum(2 if "\u4e00" <= c <= "\u9fff" else 1 for c in clean_text)
        return base + (weight * spw)

    async def process_queue(self):
        logger.info("Twitch queue processor started.")
        while True:
            try:
                user_name, text = await self.queue.get()
                logger.debug(f"Twitch Queue: Processing message from <{user_name}>")

                wait_time = self._calculate_wait_time(text)
                logger.info(f"Twitch Queue: Starting LLM background thinking for <{user_name}> (reading wait: {wait_time:.2f}s)")

                await self._invoke_response(user_name, text, audio_delay=wait_time)

                self.queue.task_done()
                await asyncio.sleep(0.5)
            except Exception as e:
                logger.error(f"Error in Twitch queue processor: {e}", exc_info=True)
                await asyncio.sleep(1.0)

    async def _invoke_response(self, user_name, text, audio_delay: float = 0.0):
        full_text = f"[Twitch Viewer] {user_name}: {text}"
        logger.info(f"Invoking Twitch Response (Thinking) for <{user_name}>: {text}")

        start_time = asyncio.get_event_loop().time()
        first_chunk = True

        try:
            async for r in self.server.aiavatar_server.sts.invoke(STSRequest(
                type="invoke",
                session_id=TWITCH_SESSION_ID,
                text=full_text
            )):
                if first_chunk:
                    while self.server.is_busy(exclude_session=TWITCH_SESSION_ID):
                        await asyncio.sleep(0.2)

                    self.server.set_busy(TWITCH_SESSION_ID, True, timeout=20.0, source="twitch")

                    if audio_delay > 0:
                        elapsed = asyncio.get_event_loop().time() - start_time
                        remaining = audio_delay - elapsed
                        if remaining > 0:
                            logger.debug(f"Twitch: LLM was fast ({elapsed:.2f}s), waiting {remaining:.2f}s more.")
                            await asyncio.sleep(remaining)

                    first_chunk = False

                await self.server.aiavatar_server.handle_response(r)
        except Exception as e:
            logger.error(f"Error invoking AI from Twitch Chat: {e}")
            self.server.set_busy(TWITCH_SESSION_ID, False)

    async def sync_client(self):
        """Synchronize twitch client state with current config."""
        if not hasattr(self.server, "twitch_client") or self.server.twitch_client is None:
            return

        settings = self.server.config.settings.get("twitch", {})

        self.server.twitch_client.update_settings(
            wake_word=settings.get("wake_word"),
            ignored_users=settings.get("ignored_users"),
            ng_words=settings.get("ng_words")
        )

        enabled = settings.get("enabled", False)
        main_loop = asyncio.get_running_loop()

        if enabled:
            async def chat_callback(user_name, text):
                chat_logger.log_twitch(user_name, text)

                async def enqueue():
                    await self.queue.put((user_name, text))

                asyncio.run_coroutine_threadsafe(enqueue(), main_loop)

            if not self.server.twitch_client.is_chat_started:
                await self.server.twitch_client.start_chat(on_message=chat_callback)
            else:
                self.server.twitch_client.on_message_callback = chat_callback
        else:
            if self.server.twitch_client.is_chat_started:
                await self.server.twitch_client.stop_chat()
