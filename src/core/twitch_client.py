import logging
import re
from typing import List, Optional, Callable
from twitchAPI.twitch import Twitch
from twitchAPI.type import AuthScope, ChatEvent
from twitchAPI.chat import Chat, ChatMessage, EventData

logger = logging.getLogger(__name__)

class TwitchClient:
    def __init__(self, client_id: str, client_secret: str, callback_on_refresh=None):
        self.client_id = client_id
        self.client_secret = client_secret
        self.callback_on_refresh = callback_on_refresh
        self.twitch: Twitch = None
        self.chat: Chat = None
        self.access_token = None
        self.refresh_token = None
        self.scopes = [
            AuthScope.CHAT_READ,
            AuthScope.CHAT_EDIT,
            AuthScope.CHANNEL_READ_SUBSCRIPTIONS,
            AuthScope.MODERATION_READ
        ]

        # Callbacks
        self.on_message_callback: Optional[Callable] = None

        # State and Filtering
        self.is_chat_started = False
        self.wake_word_pattern: Optional[re.Pattern] = None
        self.ignored_users = set()
        self.ng_words_patterns: List[re.Pattern] = []

    def update_settings(self, wake_word: str = None, ignored_users: List[str] = None, ng_words: List[str] = None):
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
                await self.chat.stop()

            self.chat = await Chat(self.twitch)

            # Register events
            self.chat.register_event(ChatEvent.READY, self._on_chat_ready)
            self.chat.register_event(ChatEvent.MESSAGE, self._on_chat_message)

            self.chat.start()
            self.is_chat_started = True
            logger.info(f"Twitch Chat listener started for broadcaster: {self.client_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to start Twitch chat: {e}")
            return False

    async def _on_chat_ready(self, ready_event: EventData):
        logger.info(f"Twitch Chat Connected (Ready Event). Channel: {ready_event.channel_name if hasattr(ready_event, 'channel_name') else 'unknown'}")
        # Join the broadcaster's own channel
        user = await self.get_me()
        if user:
            await ready_event.chat.join_room(user.login)
            logger.info(f"Joined Twitch channel: {user.login}")
        else:
            logger.error("Failed to get broadcaster user info in _on_chat_ready. Cannot join room.")

    async def _on_chat_message(self, msg: ChatMessage):
        logger.info(f"Twitch Chat Received: <{msg.user.name}> {msg.text}")

        # 1. Ignore messages from the bot/broadcaster itself (optional, but usually desired for wake words)
        # Actually, let's just use the ignored_users list.

        # 2. Filter by ignored users
        if msg.user.name.lower() in self.ignored_users:
            return

        # 2.5 Filter by NG words
        for pattern in self.ng_words_patterns:
            if pattern.search(msg.text):
                return

        # 3. Check Wake Word
        text = msg.text
        if self.wake_word_pattern:
            if not self.wake_word_pattern.search(text):
                return

        logger.info(f"Twitch Message matched: {msg.user.name}: {text}")

        # 4. Callback
        if self.on_message_callback:
            # We pass a clean version of the message for the LLM
            # Maybe prefix with [Twitch] to give context to the LLM
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

    async def close(self):
        await self.stop_chat()
        if self.twitch:
            await self.twitch.close()
            self.twitch = None
