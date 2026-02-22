"""
Parcera: TTS API Router

Handles /tts/speakers endpoint for discovering available TTS speakers.
"""
import logging
import os
import httpx
from fastapi import APIRouter

from core.engine import TTSEngineManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tts", tags=["TTS"])


def create_tts_router(get_server):
    """Create the TTS router with a server accessor to avoid circular imports."""

    @router.get("/speakers")
    async def get_tts_speakers(provider: str = "aivisspeech"):
        """Fetch speakers from an engine, starting it temporarily if needed."""
        server = get_server()
        settings = server.config.settings
        provider_cfg = settings.get("tts", {}).get("providers", {}).get(provider, {})
        api_url = provider_cfg.get("api_url")
        engine_path = provider_cfg.get("engine_path")

        if not api_url:
            return {"status": "error", "message": f"No api_url for {provider}"}

        temp_manager = None
        try:
            # 1. Check if it's already running
            async with httpx.AsyncClient() as client:
                try:
                    res = await client.get(f"{api_url}/speakers", timeout=2.0)
                    if res.status_code == 200:
                        return res.json()
                except Exception:
                    pass  # Not running or unreachable

            # 2. If not running, and we have an engine_path, start it briefly
            if engine_path and os.path.exists(engine_path):
                logger.info(f"Probing speakers for {provider}: Starting engine temporarily...")
                temp_manager = TTSEngineManager(engine_path, api_url)
                await temp_manager.start()

                async with httpx.AsyncClient() as client:
                    res = await client.get(f"{api_url}/speakers", timeout=5.0)
                    data = res.json()

                # 3. Stop it if it's not the ACTIVE provider
                if provider != server.current_tts_provider:
                    logger.info(f"Probing speakers for {provider} complete. Stopping temporary engine.")
                    await temp_manager.stop()
                else:
                    # If it's actually the active provider but was just started, keep it as managed
                    server.tts_engine_manager = temp_manager

                return data
            else:
                return {"status": "error", "message": "Engine not running and no engine_path configured."}

        except Exception as e:
            logger.error(f"Failed to fetch speakers for {provider}: {e}")
            if temp_manager:
                await temp_manager.stop()
            return {"status": "error", "message": str(e)}

    return router
