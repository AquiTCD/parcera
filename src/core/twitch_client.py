import logging
from twitchAPI.twitch import Twitch
from twitchAPI.type import AuthScope

logger = logging.getLogger(__name__)

class TwitchClient:
    def __init__(self, client_id: str, client_secret: str, callback_on_refresh=None):
        self.client_id = client_id
        self.client_secret = client_secret
        self.callback_on_refresh = callback_on_refresh
        self.twitch: Twitch = None
        self.access_token = None
        self.refresh_token = None
        self.scopes = [
            AuthScope.CHAT_READ,
            AuthScope.CHAT_EDIT,
            AuthScope.CHANNEL_READ_SUBSCRIPTIONS,
            AuthScope.MODERATION_READ
        ]

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

            # Optional: Hook into token refresh to save updated tokens in Electron
            # twitchAPI v4 has user_auth_refresh_callback
            self.twitch.user_auth_refresh_callback = self._on_token_refresh

            logger.info("Twitch client initialized successfully with user authentication.")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Twitch client: {e}")
            return False

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

    async def close(self):
        if self.twitch:
            await self.twitch.close()
            self.twitch = None
