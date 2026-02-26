import asyncio
import json
import logging
import os
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from aiavatar.adapter.websocket.server import AIAvatarWebSocketServer
from aiavatar.sts.session_state_manager import SQLiteSessionStateManager
from aiavatar.sts.performance_recorder.sqlite import SQLitePerformanceRecorder
from core.avatar import ParceraAvatarBase
from core.download import LoggingTqdm, check_model_cached, download_model_with_progress
from core.engine import TTSEngineManager
from core.config import load_config_file
from routers.config_router import create_config_router
from routers.tts_router import create_tts_router
from routers.twitch_router import create_twitch_router

logger = logging.getLogger(__name__)
from core.chat_logger import chat_logger

from core.interaction import InteractionController

class ParceraServer(ParceraAvatarBase):
    def __init__(self):
        super().__init__()
        self.config.setup_logging()
        self.tts_engine_manager = None

        # Interaction Controller (Orchestrates the pipeline)
        self.controller = InteractionController(self, self.config)

        # Track current providers for hot-swapping
        self.current_stt_provider = self.config.get("stt", {}).get("provider", "faster_whisper")
        self.current_tts_provider = self.config.get("tts", {}).get("provider", "aivisspeech")

        # Redirect all side-effect databases and files to writable directory
        db_path = os.path.join(self.config.app_data_dir, "aiavatar.db")
        voices_dir = os.path.join(self.config.app_data_dir, "voices")
        os.makedirs(voices_dir, exist_ok=True)

        session_state_manager = SQLiteSessionStateManager(db_path=db_path)
        performance_recorder = SQLitePerformanceRecorder(db_path=db_path)

        self.aiavatar_server = AIAvatarWebSocketServer(
            llm=self.llm,
            stt=self.stt,
            vad=self.vad,
            tts=self.tts,
            session_state_manager=session_state_manager,
            performance_recorder=performance_recorder,
            voice_recorder_dir=voices_dir,
            merge_request_threshold=self.config.get("merge_request_threshold", 3.0),
            debug=self.config.verbose,
            voice_recorder_enabled=False
        )

        # Attach callbacks to controller
        if hasattr(self.stt, "on_recognized_callback"):
            self.stt.on_recognized_callback = self.controller.on_recognized
        self.aiavatar_server.on_response(self.controller.on_response)

        # Initial sync
        self._sync_to_server()

    async def on_recognized(self, session_id, text, is_filtered=False):
        """Legacy delegate for backward compatibility or direct calls."""
        await self.controller.on_recognized(session_id, text, is_filtered)

    async def on_response(self, aiavatar_response, sts_response):
        """Legacy delegate for backward compatibility or direct calls."""
        await self.controller.on_response(aiavatar_response, sts_response)

    def reload_stt(self):
        """Re-initialize STT component. Useful after a model is downloaded."""
        logger.info("Reloading STT component...")
        # Refresh config to pick up any changes
        self.config.refresh()
        self.stt = self.factory.build_stt(is_busy_handler=self._is_ai_busy_check)
        self._sync_to_server()
        logger.info(f"STT reloaded. New type: {type(self.stt).__name__}")

    def _sync_to_server(self):
        """Update components and specific settings on the server instance (useful after hot-swapping)."""
        if hasattr(self.stt, "on_recognized_callback"):
            self.stt.on_recognized_callback = self.controller.on_recognized

        self.aiavatar_server.llm = self.llm
        self.aiavatar_server.stt = self.stt
        self.aiavatar_server.tts = self.tts
        self.aiavatar_server.vad = self.vad

    def apply_runtime_config(self):
        """Apply non-structural settings (prompts, thresholds) to current components."""
        if hasattr(self.llm, "system_message"):
            self.llm.system_message = self.config.full_system_prompt

        if hasattr(self.vad, "volume_db_threshold"):
            new_threshold = self.config.get("vad", {}).get("volume_db_threshold", -20.0)
            self.vad.volume_db_threshold = new_threshold

        # Update STT filters
        if hasattr(self.stt, "response_filter") and self.stt.response_filter:
            stt_cfg = self.config.get("stt", {})
            self.stt.response_filter.update_config(
                force_keywords=self.config.get("force_keywords"),
                ignore_sentences=stt_cfg.get("ignore_sentences"),
                sensitivity=self.config.get("response_sensitivity"),
                presets=self.config.get("sensitivity_presets")
            )

        # Sync Twitch Client
        asyncio.create_task(self.sync_twitch_client())

    async def sync_twitch_client(self):
        """Synchronize twitch client state with current config."""
        if not hasattr(self, "twitch_client") or self.twitch_client is None:
            return

        settings = self.config.settings.get("twitch", {})

        # 1. Update filters
        self.twitch_client.update_settings(
            wake_word=settings.get("wake_word"),
            ignored_users=settings.get("ignored_users"),
            ng_words=settings.get("ng_words")
        )

        # 2. Control Chat Listener
        if settings.get("enabled"):
            if not self.twitch_client.is_chat_started:
                async def chat_callback(user_name, text):
                    logger.info(f"Twitch Chat -> AI: [{user_name}] {text}")
                    full_text = f"[Twitch Chat] {user_name}: {text}"
                    asyncio.create_task(self.aiavatar_server.chat(full_text))

                await self.twitch_client.start_chat(on_message=chat_callback)
        else:
            if self.twitch_client.is_chat_started:
                await self.twitch_client.stop_chat()


# ─── Initialization ─────────────────────────────────────────

load_dotenv()
load_dotenv(".env.config_path", override=True)
parcera_server = ParceraServer()


def _get_server():
    """Accessor for routers to reference the global server instance."""
    return parcera_server


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Server is ready and warming up Gemini...")

    settings = parcera_server.config.settings
    tts_cfg = settings.get("tts", {})
    provider = tts_cfg.get("provider", "aivisspeech")
    provider_cfg = tts_cfg.get("providers", {}).get(provider, {})

    tts_api_url = provider_cfg.get("api_url", "http://127.0.0.1:10101")
    tts_engine_path = provider_cfg.get("engine_path")

    if tts_engine_path:
        parcera_server.tts_engine_manager = TTSEngineManager(tts_engine_path, tts_api_url)
        await parcera_server.tts_engine_manager.start()
        parcera_server.current_tts_provider = provider

    asyncio.create_task(parcera_server.warmup())

    yield

    # Shutdown
    await parcera_server.cleanup()
    if parcera_server.tts_engine_manager:
        await parcera_server.tts_engine_manager.stop()


# ─── FastAPI App ─────────────────────────────────────────────

app = FastAPI(lifespan=lifespan)


# Middleware to gracefully handle WebSocketDisconnect that aiavatar library doesn't catch.
# Without this, normal client disconnections (page reloads, reconnects) log as ERROR in uvicorn.
from starlette.websockets import WebSocketDisconnect

class WebSocketDisconnectMiddleware:
    """ASGI middleware that catches WebSocketDisconnect to prevent noisy ERROR logs."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "websocket":
            try:
                await self.app(scope, receive, send)
            except WebSocketDisconnect as e:
                logger.info(f"WebSocket disconnected: code={e.code}, reason='{e.reason or ''}'")
        else:
            await self.app(scope, receive, send)

app.add_middleware(WebSocketDisconnectMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    tts_ok = False
    try:
        settings = parcera_server.config.settings
        tts_cfg = settings.get("tts", {})
        provider = tts_cfg.get("provider", "aivisspeech")
        provider_cfg = tts_cfg.get("providers", {}).get(provider, {})
        api_url = provider_cfg.get("api_url", "http://127.0.0.1:10101")

        async with httpx.AsyncClient() as client:
            res = await client.get(f"{api_url}/version", timeout=1.0)
            tts_ok = res.status_code == 200
    except Exception:
        pass
    return {"status": "ok", "tts_engine": tts_ok}


# --- Model Management Endpoints ---


@app.get("/models/check")
async def check_model(name: str):
    """Check if a Whisper model is already cached."""
    cached = check_model_cached(name)
    return {"cached": cached, "model": name}


@app.get("/models/download")
async def download_model_sse(name: str):
    """Download a Whisper model with SSE progress streaming."""

    async def event_stream() -> AsyncIterator[str]:
        loop = asyncio.get_running_loop()
        done_event = asyncio.Event()
        result = {"error": None}

        def _download():
            try:
                download_model_with_progress(name)
            except Exception as e:
                result["error"] = str(e)
                logger.error(f"Download thread error: {e}")
            finally:
                loop.call_soon_threadsafe(done_event.set)

        # Start download in a thread (it's blocking I/O)
        thread = threading.Thread(target=_download, daemon=True)
        thread.start()

        last_pct = -1
        try:
            while not done_event.is_set():
                progress = LoggingTqdm.get_progress()
                if progress and progress["progress"] != last_pct:
                    last_pct = progress["progress"]
                    yield f"data: {json.dumps(progress)}\n\n"
                await asyncio.sleep(0.5)

            # Final event
            if result["error"]:
                yield f"data: {json.dumps({'progress': -1, 'status': 'error', 'error': result['error']})}\n\n"
            else:
                yield f"data: {json.dumps({'progress': 100, 'status': 'complete'})}\n\n"

        finally:
            LoggingTqdm.reset_progress()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/models/reload")
async def reload_model():
    """Trigger a reload of the STT component."""
    try:
        parcera_server.reload_stt()
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to reload STT: {e}")
        return {"success": False, "error": str(e)}


# Register routers
app.include_router(create_config_router(_get_server))
app.include_router(create_tts_router(_get_server))
app.include_router(create_twitch_router(_get_server))
app.include_router(parcera_server.aiavatar_server.get_websocket_router())


if __name__ == "__main__":
    import uvicorn
    config_path = os.environ.get("PARCERA_CONFIG_PATH", "configs/settings.default.yaml")
    settings = load_config_file(config_path)
    port = settings.get("electron", {}).get("port", 8676)
    uvicorn.run(app, host="127.0.0.1", port=port)
