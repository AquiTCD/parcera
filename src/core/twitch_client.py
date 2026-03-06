import logging
import re
from typing import List, Optional, Callable
from twitchAPI.twitch import Twitch
from twitchAPI.type import AuthScope, ChatEvent
from twitchAPI.chat import Chat, ChatMessage, EventData
from twitchAPI.eventsub.websocket import EventSubWebsocket
from twitchAPI.object.eventsub import ChannelRaidEvent, ChannelFollowEvent, ChannelSubscribeEvent

logger = logging.getLogger(__name__)

class TwitchClient:
    def __init__(self, client_id: str, client_secret: str, callback_on_refresh=None):
        self.client_id = client_id
        self.client_secret = client_secret
        self.callback_on_refresh = callback_on_refresh
        self.twitch: Optional[Twitch] = None
        self.chat: Optional[Chat] = None
        self.eventsub: Optional[EventSubWebsocket] = None
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.scopes = [
            AuthScope.CHAT_READ,
            AuthScope.CHAT_EDIT,
            AuthScope.CHANNEL_READ_SUBSCRIPTIONS,
            AuthScope.MODERATION_READ,
            AuthScope.BITS_READ,
            AuthScope.CHANNEL_READ_REDEMPTIONS
        ]

        # Callbacks
        self.on_message_callback: Optional[Callable] = None
        self.on_event_callback: Optional[Callable] = None

        # State and Filtering
        self.is_chat_started = False
        self.is_eventsub_started = False
        self.wake_word_pattern: Optional[re.Pattern] = None
        self.ignored_users: set[str] = set()
        self.ng_words_patterns: List[re.Pattern] = []

    def update_settings(self, wake_word: Optional[str] = None, ignored_users: Optional[List[str]] = None, ng_words: Optional[List[str]] = None):
        """Update filtering settings dynamically."""
        if wake_word:
            try:
                self.wake_word_pattern = re.compile(wake_word, re.IGNORECASE)
                logger.info(f"Twitch wake word updated: {wake_word}")
            except re.error as e:
                logger.error(f"Invalid wake word regex: {e}")

        if ng_words is not None:
            self.ng_words_patterns = []
            for word in ng_words:
                try:
                    self.ng_words_patterns.append(re.compile(word, re.IGNORECASE))
                except re.error as e:
                    logger.error(f"Invalid NG word regex '{word}': {e}")
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
                scope=self.scopes,
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
        if not self.twitch:
            logger.error("Twitch client not initialized. Cannot start EventSub.")
            return False

        self.on_event_callback = on_event

        try:
            if self.eventsub:
                await self.eventsub.stop()

            self.eventsub = EventSubWebsocket(self.twitch)
            self.eventsub.start()

            user = await self.get_me()
            if not user:
                logger.error("Failed to get user info for EventSub subscription.")
                return False

            # Subscribe to events
            await self.eventsub.listen_channel_raid(user.id, self._on_raid)
            await self.eventsub.listen_channel_follow(user.id, user.id, self._on_follow)
            await self.eventsub.listen_channel_subscribe(user.id, self._on_subscribe)

            self.is_eventsub_started = True
            logger.info(f"Twitch EventSub listener started for user: {user.display_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to start Twitch EventSub: {e}")
            return False

    async def _on_raid(self, data: ChannelRaidEvent):
        logger.info(f"Twitch Event: Raid from {data.event.from_broadcaster_user_name} ({data.event.viewers} viewers)")
        if self.on_event_callback:
            await self.on_event_callback("raid", {
                "user_name": data.event.from_broadcaster_user_name,
                "viewers": data.event.viewers
            })

    async def _on_follow(self, data: ChannelFollowEvent):
        logger.info(f"Twitch Event: New Follow from {data.event.user_name}")
        if self.on_event_callback:
            await self.on_event_callback("follow", {
                "user_name": data.event.user_name
            })

    async def _on_subscribe(self, data: ChannelSubscribeEvent):
        logger.info(f"Twitch Event: New Subscription from {data.event.user_name} (Tier {data.event.tier})")
        if self.on_event_callback:
            await self.on_event_callback("subscribe", {
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

    async def get_me(self):
        if not self.twitch:
            return None
        async for user in self.twitch.get_users():
            return user
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
