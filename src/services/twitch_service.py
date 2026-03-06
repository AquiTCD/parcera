import asyncio
import logging
import re
from aiavatar.sts.models import STSRequest
from core.constants import TWITCH_SESSION_ID
from core.chat_logger import chat_logger

logger = logging.getLogger(__name__)

class TwitchService:
    CLEAN_TEXT_RE = re.compile(r"[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]")
    MAX_QUEUE_SIZE = 3
    QUEUE_EXPIRY = 120  # 2 minutes

    def __init__(self, server):
        self.server = server
        self.queue = asyncio.Queue()
        self.last_user_response_times: dict[str, float] = {}
        self.last_global_response_time: float = 0.0

    def _calculate_wait_time(self, text: str) -> float:
        twitch_cfg = self.server.config.get("twitch", {})
        speed = twitch_cfg.get("response_speed", "natural")

        presets = {
            "instant": [0.0, 0.0],
            "fast":    [0.1, 0.12],
            "natural": [0.2, 0.16],
            "slow":    [0.3, 0.20],
        }
        base, spw = presets.get(speed, presets["natural"])

        if speed == "instant":
            return base

        clean_text = self.CLEAN_TEXT_RE.sub("", text)
        weight = sum(2 if "\u4e00" <= c <= "\u9fff" else 1 for c in clean_text)
        return base + (weight * spw)

    async def should_process(self, user_name: str) -> bool:
        now = asyncio.get_event_loop().time()
        
        # Per-user cooldown: 60s
        last_user_time = self.last_user_response_times.get(user_name.lower(), 0.0)
        if now - last_user_time < 60.0:
            logger.debug(f"Twitch: User {user_name} is on cooldown.")
            return False
            
        # Global cooldown: 10s
        if now - self.last_global_response_time < 10.0:
            logger.debug(f"Twitch: Global response cooldown active.")
            return False
            
        return True

    async def enqueue(self, user_name: str, text: str, event_type: str = "chat"):
        if not await self.should_process(user_name):
            return

        # If queue is full, discard the oldest
        if self.queue.qsize() >= self.MAX_QUEUE_SIZE:
            try:
                self.queue.get_nowait()
                self.queue.task_done()
                logger.debug("Twitch Queue: Discarded oldest message (Max size reached)")
            except asyncio.QueueEmpty:
                pass

        timestamp = asyncio.get_event_loop().time()
        await self.queue.put((user_name, text, event_type, timestamp))
        logger.debug(f"Twitch Queue: Enqueued {event_type} from {user_name}")

    async def process_queue(self):
        logger.info("Twitch queue processor started.")
        while True:
            try:
                user_name, text, event_type, timestamp = await self.queue.get()
                now = asyncio.get_event_loop().time()
                
                # Check expiry
                if now - timestamp > self.QUEUE_EXPIRY:
                    logger.info(f"Twitch Queue: Discarding expired message from <{user_name}>")
                    self.queue.task_done()
                    continue

                # Prepare context
                is_delayed = (now - timestamp > 15.0) # If more than 15s late
                
                wait_time = self._calculate_wait_time(text)
                logger.info(f"Twitch Queue: Processing <{user_name}> (type: {event_type}, delay: {now - timestamp:.1f}s)")

                # Update cooldown trackers BEFORE starting to talk to avoid overlaps
                self.last_user_response_times[user_name.lower()] = now
                self.last_global_response_time = now

                await self._invoke_response(user_name, text, event_type, audio_delay=wait_time, is_delayed=is_delayed)

                self.queue.task_done()
                # Ensure spacing between even if LLM was slow
                await asyncio.sleep(0.5) 
            except Exception as e:
                logger.error(f"Error in Twitch queue processor: {e}", exc_info=True)
                await asyncio.sleep(1.0)

    async def _invoke_response(self, user_name: str, text: str, event_type: str = "chat", audio_delay: float = 0.0, is_delayed: bool = False):
        context_prefix = f"[Twitch {event_type.capitalize()}]"
        full_text = f"{context_prefix} {user_name}: {text}"
        
        instructions = ""
        if is_delayed:
            instructions = "\n\n指示: 返答が少し遅れたことを考慮し、不自然にならないように「そういえば」などの言葉を混ぜて自然に切り出してください。"

        logger.info(f"Invoking Twitch Response (Thinking) for <{user_name}>")

        from core.constants import TWITCH_SESSION_ID

        # Mock a WebSocket object that AIAvatar expects for its chat() method
        class DummyWS:
            async def send_json(self, data): pass
            async def send_text(self, text): pass

        try:
            # We call chat() which is the entry point for AIAvatarWebSocketServer
            # It handles the LLM -> TTS pipeline and calls on_response callbacks
            await self.server.aiavatar_server.chat(
                DummyWS(), 
                {
                    "type": "chat",
                    "session_id": TWITCH_SESSION_ID,
                    "text": full_text + instructions
                }
            )
        except Exception as e:
            logger.error(f"Error invoking AI from Twitch: {e}")
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
        
        async def chat_callback(user_name, text):
            # In a real app, you might want to log this to a file
            await self.enqueue(user_name, text, event_type="chat")

        async def event_callback(event_type, data):
            user_name = data.get("user_name", "Unknown")
            detail = ""
            if event_type == "raid":
                detail = f"Raid: {data.get('viewers')} viewers"
            elif event_type == "subscribe":
                detail = f"Subscription: Tier {data.get('tier')}"
            elif event_type == "follow":
                detail = "Follow"
            
            await self.enqueue(user_name, detail, event_type=event_type)

        if enabled:
            if not self.server.twitch_client.is_chat_started:
                await self.server.twitch_client.start_chat(on_message=chat_callback)
            else:
                self.server.twitch_client.on_message_callback = chat_callback
                
            if not self.server.twitch_client.is_eventsub_started:
                await self.server.twitch_client.start_eventsub(on_event=event_callback)
            else:
                self.server.twitch_client.on_event_callback = event_callback
        else:
            if self.server.twitch_client.is_chat_started:
                await self.server.twitch_client.stop_chat()
            if self.server.twitch_client.is_eventsub_started:
                await self.server.twitch_client.stop_eventsub()
