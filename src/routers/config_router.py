"""
Parcera: Configuration API Router

Handles /config/reload endpoint for hot-reloading settings.
"""
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse

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


def _find_bundled_assets(avatar_type: str) -> Path | None:
    """Find bundled avatar assets directory for dev or production builds."""
    candidates = [
        # Development: project root / ui / public / assets / {type}
        Path(__file__).parent.parent.parent / "ui" / "public" / "assets" / avatar_type,
        # Production (macOS bundle): Contents/Resources/dist/assets/{type}
        Path(__file__).parent.parent.parent.parent / "Resources" / "dist" / "assets" / avatar_type,
    ]
    for p in candidates:
        if p.is_dir():
            return p
    return None


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

    @router.get("/obs-html-path")
    async def obs_html_path():
        """
        Return the file:// URI for obs.html.

        The Tauri settings UI uses this to display a browser-source URL that
        always resolves from the local filesystem — so OBS can load the page
        even before Parcera's HTTP server is running.  The JS retry loops then
        handle connecting to the WebSocket once Parcera starts.
        """
        path = _find_obs_html()
        return {"file_uri": path.as_uri()}

    @router.get("/obs-asset/{avatar_type}/{filename}")
    async def serve_obs_asset(avatar_type: str, filename: str):
        """
        Serve avatar sprite images for the OBS browser source.

        Proxies local filesystem images through HTTP so obs.html (served via
        http://) can load them without hitting the file:// mixed-content block.
        Only serves files within the configured assets_dir or bundled assets.
        """
        _VALID_AVATAR_TYPES = frozenset({"user", "ai"})
        if avatar_type not in _VALID_AVATAR_TYPES:
            raise HTTPException(status_code=404, detail="Unknown avatar type")

        server = get_server()
        avatar_cfg = server.config.get("avatars", {}).get(avatar_type)
        assets_dir = None
        if isinstance(avatar_cfg, dict) and avatar_cfg.get("assets_dir"):
            candidate = Path(avatar_cfg["assets_dir"])
            # Only use the configured path if it's a real filesystem directory.
            # The default config stores Tauri-relative paths like "/assets/user"
            # which are not valid on the filesystem.
            if candidate.is_dir():
                assets_dir = candidate
        if assets_dir is None:
            assets_dir = _find_bundled_assets(avatar_type)

        if assets_dir is None:
            raise HTTPException(status_code=404, detail="Assets directory not found")

        # Prevent path traversal
        try:
            file_path = (assets_dir / filename).resolve()
            file_path.relative_to(assets_dir.resolve())
        except ValueError:
            raise HTTPException(status_code=403, detail="Access denied")

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Asset not found")

        return FileResponse(file_path)

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
