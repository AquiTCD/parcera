"""
Parcera: Configuration API Router

Handles /config/reload endpoint for hot-reloading settings.
"""
import logging
from pathlib import Path
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/config", tags=["Config"])


def _find_obs_html() -> Path:
    """Locate obs.html: bundled next to this file (production) or in ui/public (dev)."""
    bundled = Path(__file__).parent.parent / "static" / "obs.html"
    if bundled.exists():
        return bundled
    dev_path = Path(__file__).parent.parent.parent / "ui" / "public" / "obs.html"
    if dev_path.exists():
        return dev_path
    return bundled  # let the caller handle the missing-file error


def create_config_router(get_server):
    """Create the config router with a server accessor to avoid circular imports."""

    @router.get("/obs.html", response_class=HTMLResponse)
    async def obs_page():
        """
        Serve the standalone OBS browser-source page.

        Loaded once by OBS; all subsequent data arrives via WebSocket so the
        page survives Parcera restarts without needing a manual refresh.
        """
        path = _find_obs_html()
        return HTMLResponse(content=path.read_text(encoding="utf-8"))

    @router.get("/settings")
    async def get_settings():
        """Return all settings as JSON. Used by OBS Browser Source (no Tauri IPC available)."""
        server = get_server()
        return server.config.settings

    @router.post("/reload")
    async def reload_config(request: Request):
        server = get_server()
        try:
            new_settings = await request.json()
            server.config.refresh(new_settings)

            # 1. Update Non-structural config (Prompts, VAD)
            server.apply_runtime_config()

            # 2. Check for Providers Change
            stt_cfg = server.config.get("stt", {})
            new_stt_provider = stt_cfg.get("provider")
            tts_cfg = server.config.get("tts", {})
            new_tts_provider = tts_cfg.get("provider", "aivisspeech")
            llm_cfg = server.config.get("llm", {})
            new_llm_provider = llm_cfg.get("provider", "gemini")

            stt_changed = new_stt_provider != server.current_stt_provider
            tts_changed = new_tts_provider != server.current_tts_provider
            llm_changed = new_llm_provider != server.current_llm_provider
            
            # If ONLY LLM changed, we can try hot-reload
            if llm_changed and not (stt_changed or tts_changed):
                await server.reload_llm()
                restart_required = False
            else:
                restart_required = stt_changed or tts_changed or llm_changed

            if restart_required:
                logger.warning(
                    f"Provider change detected (STT: {stt_changed}, TTS: {tts_changed}, LLM: {llm_changed}). "
                    "Server restart is recommended for core engine changes."
                )
            else:
                # Pick up minor config changes (e.g. speaker_id, style) for the ACTIVE provider
                server.tts = server.factory.build_tts()
                server._sync_to_server()

            logger.info(f"Config sync completed (Restart Required: {restart_required})")
            return {
                "status": "ok",
                "restart_required": restart_required,
                "stt_active": server.current_stt_provider,
                "tts_active": server.current_tts_provider,
                "llm_active": server.current_llm_provider,
            }
        except Exception as e:
            logger.error(f"Reload failed: {e}")
            return {"status": "error", "message": str(e)}

    return router
