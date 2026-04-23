import asyncio
import logging
import os

# Suppress transformers "PyTorch was not found" warning (we use MLX, not PyTorch)
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from typing import Optional
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from aiavatar.adapter.websocket.server import AIAvatarWebSocketServer
from aiavatar.sts.session_state_manager import SQLiteSessionStateManager
from aiavatar.sts.performance_recorder.sqlite import SQLitePerformanceRecorder
from core.avatar import ParceraAvatarBase
from core.engine import TTSEngineManager
from core.config import load_config_file
from routers.config_router import create_config_router
from routers.tts_router import create_tts_router
from routers.twitch_router import create_twitch_router
from routers.model_router import create_model_router
from routers.training_router import create_training_router
from routers.optional_packages_router import create_optional_packages_router
from services.twitch_service import TwitchService
from services.training_service import TrainingService

from core.interaction import InteractionController
from core.constants import TWITCH_SESSION_ID, DEFAULT_UVICORN_PORT, DEFAULT_UVICORN_HOST

logger = logging.getLogger(__name__)

class InternalWebSocket:
    """A virtual WebSocket bridge that satisfies aiavatar's requirements and broadcasts responses to the UI."""
    def __init__(self, server):
        self.server = server

    async def send_text(self, text: str):
        # Forward text messages to all real UI sockets
        for sid, ws in getattr(self.server, "websockets", {}).items():
            if sid != TWITCH_SESSION_ID:
                try: await ws.send_text(text)
                except Exception: pass

    async def send_json(self, data: dict):
        # Forward JSON messages (thinking, commands) to all real UI sockets
        for sid, ws in getattr(self.server, "websockets", {}).items():
            if sid != TWITCH_SESSION_ID:
                try: await ws.send_json(data)
                except Exception: pass

    async def send_bytes(self, data: bytes):
        # Forward binary messages (audio) to all real UI sockets
        for sid, ws in getattr(self.server, "websockets", {}).items():
            if sid != TWITCH_SESSION_ID:
                try: await ws.send_bytes(data)
                except Exception: pass

    async def close(self, code: int = 1000, reason: str = ""):
        pass

class ParceraServer(ParceraAvatarBase):
    def __init__(self):
        super().__init__()
        self.config.setup_logging()
        self.tts_engine_manager = None
        self._warmup_task: Optional[asyncio.Task] = None
        self._twitch_task: Optional[asyncio.Task] = None

        # Interaction Controller (Orchestrates the pipeline)
        self.controller = InteractionController(self, self.config)
        self.twitch_service = TwitchService(self)

        # Teacher LLM for Training
        class TeacherLLM:
            def __init__(self, server):
                self.server = server
            async def generate(self, prompt: str) -> str:
                # Use a universal way to get response from any aiavatar LLM component
                logger.info(f"TeacherLLM: Processing knowledge using {self.server.llm.__class__.__name__}")
                full_text = ""
                try:
                    messages = [{"role": "user", "content": prompt}]
                    # Note: context_id='teacher_internal' to separate from main chat if needed
                    # We pass max_tokens=2048 to ensure long JSON doesn't get truncated
                    async for response in self.server.llm.get_llm_stream_response(
                        "teacher_internal", "system", messages, max_tokens=2048
                    ):
                        if hasattr(response, "text"):
                            full_text += response.text
                        else:
                            # Fallback for providers that yield raw strings
                            full_text += str(response)
                    
                    if not full_text:
                        logger.warning("TeacherLLM: Empty response generated.")
                    else:
                        logger.debug(f"TeacherLLM: Generated context ({len(full_text)} chars)")
                        
                    return full_text
                except Exception as e:
                    logger.error(f"TeacherLLM generation failed: {e}", exc_info=True)
                    raise ValueError(f"Knowledge processing failed: {e}. Make sure a model is loaded if using LocalBrain.")

        self.training_service = TrainingService(self.config, teacher_llm=TeacherLLM(self))

        # Track current providers for hot-swapping
        self.current_stt_provider = self.config.get("stt", {}).get("provider", "faster_whisper")
        self.current_tts_provider = self.config.get("tts", {}).get("provider", "aivisspeech")
        self.current_llm_provider = self.config.get("llm", {}).get("provider", "gemini")

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

    async def reload_llm(self):
        """Re-initialize LLM component and update avatar references."""
        new_provider = self.config.llm.provider
        logger.info(f"Reloading LLM component (New provider: {new_provider})...")
        
        # Refresh factory config and rebuild LLM
        self.config.refresh()
        self.llm = self.factory.build_llm()
        
        self.current_llm_provider = new_provider
        self._sync_to_server()
        
        # Trigger warmup for local LLM
        if hasattr(self.llm, "warmup"):
            asyncio.create_task(self.llm.warmup())
            
        logger.info(f"LLM reloaded: {type(self.llm).__name__}")

    def _sync_to_server(self):
        """Update components and specific settings on the server instance (useful after hot-swapping)."""
        if hasattr(self.stt, "on_recognized_callback"):
            self.stt.on_recognized_callback = self.controller.on_recognized

        # Register/Ensure an internal bridge for Twitch responses
        self.aiavatar_server.websockets[TWITCH_SESSION_ID] = InternalWebSocket(self.aiavatar_server)

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
            asyncio.get_running_loop().create_task(self.twitch_service.sync_client())
        except RuntimeError:
            # Skip if no loop is running
            pass


# ─── Initialization ─────────────────────────────────────────

load_dotenv()
load_dotenv(".env.config_path", override=True)

from core.optional_packages import patch_sys_path
patch_sys_path()  # Prepend optional-package dirs to sys.path before components are built

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

    logger.info("LIFESPAN: Applying final runtime configuration and syncing Twitch...")
    parcera_server.apply_runtime_config()

    parcera_server._warmup_task = asyncio.create_task(parcera_server.warmup())
    parcera_server._twitch_task = asyncio.create_task(parcera_server.twitch_service.process_queue())

    yield

    # Shutdown
    if hasattr(parcera_server, '_warmup_task'): parcera_server._warmup_task.cancel()
    if hasattr(parcera_server, '_twitch_task'): parcera_server._twitch_task.cancel()
    await parcera_server.cleanup()
    if parcera_server.tts_engine_manager:
        await parcera_server.tts_engine_manager.stop()



# ─── FastAPI App ─────────────────────────────────────────────

app = FastAPI(lifespan=lifespan)

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


# Register routers
app.include_router(create_config_router(_get_server))
app.include_router(create_tts_router(_get_server))
app.include_router(create_twitch_router(_get_server))
app.include_router(create_model_router(_get_server))
app.include_router(create_training_router(_get_server))
app.include_router(create_optional_packages_router())
app.include_router(parcera_server.aiavatar_server.get_websocket_router())


if __name__ == "__main__":
    import uvicorn
    config_path = os.environ.get("PARCERA_CONFIG_PATH", "configs/settings.default.yaml")
    settings = load_config_file(config_path)
    port = settings.get("electron", {}).get("port", DEFAULT_UVICORN_PORT)
    uvicorn.run(app, host=DEFAULT_UVICORN_HOST, port=port)
