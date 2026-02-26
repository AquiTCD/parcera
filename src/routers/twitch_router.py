from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class TwitchInitRequest(BaseModel):
    access_token: str
    refresh_token: str

def create_twitch_router(get_server):
    router = APIRouter(prefix="/twitch", tags=["twitch"])

    @router.post("/init")
    async def init_twitch(req: TwitchInitRequest):
        server = get_server()
        settings = server.config.settings.get("twitch", {})
        client_id = settings.get("client_id")
        client_secret = settings.get("client_secret")

        if not client_id or not client_secret:
            raise HTTPException(status_code=400, detail="Twitch Client ID or Secret missing in server config.")

        # Lazy initialization of twitch_client on the server instance
        if not hasattr(server, "twitch_client") or server.twitch_client is None:
            from core.twitch_client import TwitchClient

            async def on_refresh(at, rt):
                # Optionally notify Electron back (TBD in Phase 2/3)
                logger.info("Twitch tokens refreshed in background.")

            server.twitch_client = TwitchClient(client_id, client_secret, callback_on_refresh=on_refresh)

        success = await server.twitch_client.initialize(req.access_token, req.refresh_token)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to initialize Twitch client.")

        user = await server.twitch_client.get_me()
        return {
            "success": True,
            "user": {
                "display_name": user.display_name if user else "Unknown",
                "login": user.login if user else "unknown"
            }
        }

    @router.get("/status")
    async def get_status():
        server = get_server()
        is_initialized = hasattr(server, "twitch_client") and server.twitch_client is not None and server.twitch_client.twitch is not None

        user_info = None
        if is_initialized:
            user = await server.twitch_client.get_me()
            if user:
                user_info = {"display_name": user.display_name, "login": user.login}

        return {
            "initialized": is_initialized,
            "user": user_info
        }

    return router
