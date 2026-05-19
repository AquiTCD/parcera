import logging
import asyncio
import re
from typing import List, Optional, Callable
from twitchAPI.twitch import Twitch
from twitchAPI.type import AuthScope, ChatEvent
from twitchAPI.chat import Chat, ChatMessage, EventData
from twitchAPI.eventsub.websocket import EventSubWebsocket
from twitchAPI.object.eventsub import ChannelRaidEvent, ChannelFollowEvent, ChannelSubscribeEvent

logger = logging.getLogger(__name__)

class TwitchClient:
    EVENTSUB_RETRIES = 20
    EVENTSUB_RETRY_INTERVAL = 0.5
    
    DEFAULT_SCOPES = [
        AuthScope.CHAT_READ,
        AuthScope.CHAT_EDIT,
        AuthScope.CHANNEL_READ_SUBSCRIPTIONS,
        AuthScope.MODERATION_READ,
        AuthScope.MODERATOR_READ_FOLLOWERS,
        AuthScope.BITS_READ,
        AuthScope.CHANNEL_READ_REDEMPTIONS
    ]

    def __init__(self, client_id: str, client_secret: str, callback_on_refresh=None):
        self._lock = asyncio.Lock()
        self.client_id = client_id
        self.client_secret = client_secret
        self.callback_on_refresh = callback_on_refresh
        self.twitch: Optional[Twitch] = None
        self.chat: Optional[Chat] = None
        self.eventsub: Optional[EventSubWebsocket] = None
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None

        # Callbacks
        self.on_message_callback: Optional[Callable] = None
        self.on_event_callback: Optional[Callable] = None

        # State and Filtering
        self.is_chat_started = False
        self.is_eventsub_started = False
        self.session_id: Optional[str] = None  # Explicitly store for UI
        self.wake_word_pattern: Optional[re.Pattern] = None
        self.ignored_users: set[str] = set()
        self.ng_words_patterns: List[re.Pattern] = []

    def _compile_regex(self, pattern_str: str, desc: str) -> Optional[re.Pattern]:
        try:
            return re.compile(pattern_str, re.IGNORECASE)
        except re.error as e:
            logger.error(f"Invalid {desc} regex '{pattern_str}': {e}")
            return None

    def update_settings(self, wake_word: Optional[str] = None, ignored_users: Optional[List[str]] = None, ng_words: Optional[List[str]] = None):
        """Update filtering settings dynamically."""
        if wake_word:
            compiled = self._compile_regex(wake_word, "wake word")
            if compiled:
                self.wake_word_pattern = compiled
                logger.info(f"Twitch wake word updated: {wake_word}")

        if ng_words is not None:
            self.ng_words_patterns = []
            for word in ng_words:
                compiled = self._compile_regex(word, "NG word")
                if compiled:
                    self.ng_words_patterns.append(compiled)
            logger.info(f"Twitch NG words updated: {ng_words}")

        if ignored_users is not None:
            self.ignored_users = {u.lower() for u in ignored_users}
            logger.info(f"Twitch ignored users updated: {self.ignored_users}")

    async def initialize(self, access_token: str, refresh_token: str):
        self.access_token = access_token
        self.refresh_token = refresh_token

        try:
            if self.twitch:
                await self.twitch.close()

            self.twitch = await Twitch(self.client_id, self.client_secret)

            # set_user_authentication will automatically handle refresh if refresh_token is provided
            await self.twitch.set_user_authentication(
                token=self.access_token,
                scope=self.DEFAULT_SCOPES,
                refresh_token=self.refresh_token,
                validate=True
            )

            # Hook into token refresh
            self.twitch.user_auth_refresh_callback = self._on_token_refresh

            logger.info("Twitch client initialized successfully with user authentication.")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Twitch client: {e}")
            return False

    async def start_chat(self, on_message: Callable):
        """Connect to Twitch IRC and start listening for messages."""
        if not self.twitch:
            logger.error("Twitch client not initialized. Cannot start chat.")
            return False

        self.on_message_callback = on_message

        try:
            if self.chat:
                self.chat.stop()

            self.chat = await Chat(self.twitch)

            # Register events
            self.chat.register_event(ChatEvent.READY, self._on_chat_ready)
            self.chat.register_event(ChatEvent.MESSAGE, self._on_chat_message)

            self.chat.start()
            self.is_chat_started = True
            logger.info(f"Twitch Chat listener started.")
            return True
        except Exception as e:
            logger.error(f"Failed to start Twitch chat: {e}")
            return False

    async def start_eventsub(self, on_event: Callable):
        """Connect to Twitch EventSub via WebSocket."""
        async with self._lock:
            if not self.twitch:
                logger.error("Twitch client not initialized. Cannot start EventSub.")
                return False

            self.on_event_callback = on_event

            try:
                if self.is_eventsub_started:
                    logger.debug("Twitch EventSub is already started. Skipping.")
                    return True

                if self.eventsub:
                    await self.eventsub.stop()

                # Enable twitchAPI logs at INFO level for production
                logging.getLogger('twitchAPI').setLevel(logging.INFO)
                
                self.eventsub = EventSubWebsocket(self.twitch)
                
                # Diagnostic callbacks
                self.eventsub.on_ready = self._on_eventsub_ready
                self.eventsub.on_error = self._on_eventsub_error
                
                logger.debug("Twitch: Fetching user details for EventSub...")
                user_obj = await self.get_me()
                logger.debug(f"Twitch: get_me returned: {user_obj}")
                
                if user_obj is None:
                    logger.error("Failed to get user info for EventSub subscription (returned None).")
                    return False

                # 2. START THE WEBSOCKET
                logger.debug("Twitch: Starting EventSub Websocket...")
                self.eventsub.start()

                # 3. BACKGROUND WORKER: Establish subscriptions once session is ready
                self._worker_task = asyncio.create_task(self._subscription_worker())
                
                logger.info("Twitch: EventSub setup initiated. Waiting for session ID...")
                return True
                
            except Exception as e:
                logger.error(f"EventSub setup error: {e}")
                return False

    async def _subscription_worker(self):
        """Background worker to establish EventSub subscriptions once session ID is ready."""
        logger.debug("Twitch: Subscription worker started.")
        for i in range(self.EVENTSUB_RETRIES): 
            try:
                user = await self.get_me()
                if not user:
                    await asyncio.sleep(self.EVENTSUB_RETRY_INTERVAL)
                    continue

                # Attempt a probe subscription. This will succeed once the websocket session is initialized.
                # In twitchAPI 4.5.0, this handles the underlying session/ID check.
                await self.eventsub.listen_channel_follow_v2(user.id, user.id, self._on_follow)
                
                # Success! Capture the Session ID for the UI
                sid = getattr(self.eventsub, "session_id", None)
                if not sid and hasattr(self.eventsub, 'active_session') and self.eventsub.active_session:
                    sid = getattr(self.eventsub.active_session, 'id', None) or getattr(self.eventsub.active_session, 'session_id', None)
                
                self.session_id = sid
                logger.info(f"Twitch EventSub session established (ID: {self.session_id})")

                # Fast-track remaining subscriptions
                await self.eventsub.listen_channel_raid(self._on_raid, to_broadcaster_user_id=user.id)
                await self.eventsub.listen_channel_subscribe(user.id, self._on_subscribe)
                
                logger.info("Twitch: All EventSub subscriptions registered successfully.")
                self.is_eventsub_started = True 
                return
            except Exception as e:
                # Expected error while socket is still warming up
                if "NoneType" in str(e) or "attribute 'id'" in str(e):
                    logger.debug(f"Twitch: Connection warming up (attempt {i+1}/{self.EVENTSUB_RETRIES})...")
                else:
                    logger.warning(f"Twitch: Unexpected subscription error (attempt {i+1}): {e}")
            
            await asyncio.sleep(self.EVENTSUB_RETRY_INTERVAL)
        else:
            logger.error("Twitch: Failed to establish EventSub subscriptions within 10s timeout.")

    async def _on_eventsub_ready(self, *args, **kwargs):
        """Called when EventSub websocket is connected and session_id is available."""
        # Some versions pass the session object as first arg
        session_id = getattr(self.eventsub, "session_id", "Unknown")
        if session_id == "Unknown" and args:
            session_id = getattr(args[0], "session_id", "Unknown")

        logger.info(f"Twitch EventSub Connection Ready! Session ID: {session_id}")

    async def _on_eventsub_error(self, event_id: str, message: str):
        """Called when EventSub encountered an error."""
        logger.error(f"Twitch EventSub Error: [{event_id}] {message}")

    async def _dispatch_event(self, event_type: str, data: dict):
        if self.on_event_callback:
            await self.on_event_callback(event_type, data)

    async def _on_raid(self, data: ChannelRaidEvent):
        logger.info(f"Twitch Event: Raid from {data.event.from_broadcaster_user_name} ({data.event.viewers} viewers)")
        await self._dispatch_event("raid", {
            "user_name": data.event.from_broadcaster_user_name,
            "viewers": data.event.viewers
        })

    async def _on_follow(self, data: ChannelFollowEvent):
        logger.info(f"Twitch Event: New Follow from {data.event.user_name}")
        await self._dispatch_event("follow", {
            "user_name": data.event.user_name
        })

    async def _on_subscribe(self, data: ChannelSubscribeEvent):
        logger.info(f"Twitch Event: New Subscription from {data.event.user_name} (Tier {data.event.tier})")
        await self._dispatch_event("subscribe", {
            "user_name": data.event.user_name,
            "tier": data.event.tier,
            "is_gift": data.event.is_gift
        })

    async def _on_chat_ready(self, ready_event: EventData):
        logger.info(f"Twitch Chat Connected.")
        user = await self.get_me()
        if user:
            await ready_event.chat.join_room(user.login)
            logger.info(f"Joined Twitch channel: {user.login}")

    async def _on_chat_message(self, msg: ChatMessage):
        if msg.user.name.lower() in self.ignored_users:
            return

        for pattern in self.ng_words_patterns:
            if pattern.search(msg.text):
                return

        text = msg.text
        if self.wake_word_pattern:
            if not self.wake_word_pattern.search(text):
                return

        logger.info(f"Twitch Message matched: {msg.user.name}: {text}")

        if self.on_message_callback:
            await self.on_message_callback(msg.user.display_name, text)

    async def _on_token_refresh(self, access_token: str, refresh_token: str):
        logger.info("Twitch access token refreshed.")
        self.access_token = access_token
        self.refresh_token = refresh_token
        if self.callback_on_refresh:
            await self.callback_on_refresh(access_token, refresh_token)

    async def get_me(self, retries=3):
        if not self.twitch:
            return None
        
        for i in range(retries):
            try:
                async for user in self.twitch.get_users():
                    return user
            except Exception as e:
                logger.debug(f"Twitch get_me attempt {i+1} failed: {e}")
            
            if i < retries - 1:
                await asyncio.sleep(1)
        
        return None

    async def stop_chat(self):
        if self.chat:
            self.chat.stop()
            self.chat = None
            self.is_chat_started = False
            logger.info("Twitch Chat listener stopped.")

    async def stop_eventsub(self):
        if self.eventsub:
            await self.eventsub.stop()
            self.eventsub = None
            self.is_eventsub_started = False
            logger.info("Twitch EventSub listener stopped.")

    async def close(self):
        await self.stop_chat()
        await self.stop_eventsub()
        if self.twitch:
            await self.twitch.close()
            self.twitch = None
