from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import asyncio
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

        # Lazy initialization of twitch_client
        if not hasattr(server, "twitch_client") or server.twitch_client is None:
            from core.twitch_client import TwitchClient

            async def on_refresh(at, rt):
                logger.info("Twitch tokens refreshed in background.")

            server.twitch_client = TwitchClient(client_id, client_secret, callback_on_refresh=on_refresh)

        success = await server.twitch_client.initialize(req.access_token, req.refresh_token)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to initialize Twitch client.")

        # Rebuild prompt and start chat (apply_runtime_config calls sync_twitch_client)
        server.config.refresh()
        server.apply_runtime_config()

        try:
            user = await server.twitch_client.get_me()
            return {
                "success": True,
                "user": {
                    "display_name": user.display_name if user else "Unknown",
                    "login": user.login if user else "unknown"
                }
            }
        except Exception as e:
            logger.error(f"Failed to fetch user info during Twitch init: {e}")
            raise HTTPException(status_code=500, detail="Failed to connect to Twitch API.")

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

    @router.post("/stop")
    async def stop_twitch():
        server = get_server()
        if hasattr(server, "twitch_client") and server.twitch_client:
            await server.twitch_client.close()
            server.twitch_client = None
            logger.info("Twitch client stopped and cleared.")
        return {"success": True}

    @router.post("/test-event")
    async def test_event(event_type: str = "raid"):
        server = get_server()
        if not hasattr(server, "twitch_service") or server.twitch_service is None:
            raise HTTPException(status_code=400, detail="Twitch service not active or initialized.")

        # Simulate event data and trigger enqueue
        detail = "Simulated Event"
        if event_type == "raid":
            detail = "Raid: 100 viewers"
        elif event_type == "subscribe":
            detail = "Subscription: Tier 1000"
        elif event_type == "follow":
            detail = "Follow"
            
        # Use unique names for testing to bypass user cooldown
        test_user = f"Test_{event_type}_{int(asyncio.get_event_loop().time()) % 1000}"
        await server.twitch_service.enqueue(test_user, detail, event_type=event_type)
        logger.info(f"Triggered simulated Twitch event: {event_type} (as {test_user})")
        return {"success": True, "event_type": event_type}

    return router
