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

import re
from aiavatar.sts.models import STSRequest
from core.chat_logger import chat_logger
from core.interaction import InteractionController

logger = logging.getLogger(__name__)

# Constants
TWITCH_SESSION_ID = "twitch-session"

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

        self.twitch_queue = asyncio.Queue()

        # Attach callbacks to controller
        if hasattr(self.stt, "on_recognized_callback"):
            self.stt.on_recognized_callback = self.controller.on_recognized
        self.aiavatar_server.on_response(self.controller.on_response)

        # Initial sync
        self._sync_to_server()
        self.apply_runtime_config()

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
        if hasattr(self.llm, "system_prompt"):
            self.llm.system_prompt = self.config.full_system_prompt

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
        try:
            asyncio.get_running_loop().create_task(self.sync_twitch_client())
        except RuntimeError:
            # Skip if no loop is running (e.g. during test import or CLI initialization)
            pass

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
        enabled = settings.get("enabled", False)

        main_loop = asyncio.get_running_loop()

        if enabled:
            async def chat_callback(user_name, text):
                chat_logger.log_twitch(user_name, text)

                async def enqueue():
                    await self.twitch_queue.put((user_name, text))

                asyncio.run_coroutine_threadsafe(enqueue(), main_loop)

            if not self.twitch_client.is_chat_started:
                await self.twitch_client.start_chat(on_message=chat_callback)
            else:
                self.twitch_client.on_message_callback = chat_callback
        else:
            if self.twitch_client.is_chat_started:
                await self.twitch_client.stop_chat()

    CLEAN_TEXT_RE = re.compile(r"[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]")

    def _calculate_twitch_wait_time(self, text: str) -> float:
        twitch_cfg = self.config.get("twitch", {})
        speed = twitch_cfg.get("response_speed", "natural")

        presets = {
            "instant": [0.1, 0.0],
            "fast":    [0.3, 0.05],
            "natural": [0.5, 0.12],
            "slow":    [1.0, 0.25],
        }
        base, spw = presets.get(speed, presets["natural"])

        if speed == "instant":
            return base

        # Weight: Kanji=2, others=1. Ignore symbols.
        clean_text = self.CLEAN_TEXT_RE.sub("", text)
        weight = sum(2 if "\u4e00" <= c <= "\u9fff" else 1 for c in clean_text)

        return base + (weight * spw)

    async def _process_twitch_queue(self):
        logger.info("Twitch queue processor started.")
        while True:
            try:
                user_name, text = await self.twitch_queue.get()
                logger.debug(f"Twitch Queue: Processing message from <{user_name}>")

                # 1. Wait while AI is busy with anything
                while self.is_busy():
                    await asyncio.sleep(0.5)

                wait_time = self._calculate_twitch_wait_time(text)
                logger.debug(f"Twitch Queue: Waiting {wait_time:.2f}s (emulated reading)...")
                await asyncio.sleep(wait_time)

                # 3. Check again if busy (priority to user)
                while self.is_busy():
                    await asyncio.sleep(0.5)

                # 4. Invoke AI with specific session ID
                await self._invoke_twitch_response(user_name, text)

                self.twitch_queue.task_done()

                # Space out consecutive queued messages
                await asyncio.sleep(0.5)
            except Exception as e:
                logger.error(f"Error in Twitch queue processor: {e}", exc_info=True)
                await asyncio.sleep(1.0)

    async def _invoke_twitch_response(self, user_name, text):
        full_text = f"[Twitch] {user_name}: {text}"
        logger.info(f"Invoking Twitch Response for <{user_name}>: {text}")

        # Set Twitch as busy immediately to lock out user priority drops
        # Use a generous 20s timeout for LLM thinking + TTS start
        self.set_busy(TWITCH_SESSION_ID, True, timeout=20.0, source="twitch")

        try:
            async for r in self.aiavatar_server.sts.invoke(STSRequest(
                type="invoke",
                session_id=TWITCH_SESSION_ID,
                text=full_text
            )):
                await self.aiavatar_server.handle_response(r)
        except Exception as e:
            logger.error(f"Error invoking AI from Twitch Chat: {e}")
            self.set_busy(TWITCH_SESSION_ID, False)


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
    asyncio.create_task(parcera_server._process_twitch_queue())

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
