import asyncio
import logging
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from aiavatar.adapter.websocket.server import AIAvatarWebSocketServer
from core.avatar import ParceraAvatarBase
from core.engine import TTSEngineManager
from core.config import load_config_file
from routers.config_router import create_config_router
from routers.tts_router import create_tts_router

logger = logging.getLogger(__name__)


class ParceraServer(ParceraAvatarBase):
    def __init__(self):
        super().__init__()
        self.config.setup_logging()
        self.tts_engine_manager = None

        # Track current providers for hot-swapping
        self.current_stt_provider = self.config.get("stt", {}).get("provider", "faster_whisper")
        self.current_tts_provider = self.config.get("tts", {}).get("provider", "aivisspeech")

        self.aiavatar_server = AIAvatarWebSocketServer(
            llm=self.llm,
            stt=self.stt,
            vad=self.vad,
            tts=self.tts,
            merge_request_threshold=self.config.get("merge_request_threshold", 3.0),
            debug=self.config.verbose,
            voice_recorder_enabled=False
        )

        # Attach callbacks (One-time)
        if hasattr(self.stt, "on_recognized_callback"):
            self.stt.on_recognized_callback = self.on_recognized
        self.aiavatar_server.on_response(self.on_response)

        # Initial sync
        self._sync_to_server()

    def _sync_to_server(self):
        """Update components and specific settings on the server instance (useful after hot-swapping)."""
        if hasattr(self.stt, "on_recognized_callback"):
            self.stt.on_recognized_callback = self.on_recognized

        self.aiavatar_server.llm = self.llm
        self.aiavatar_server.stt = self.stt
        self.aiavatar_server.tts = self.tts
        self.aiavatar_server.vad = self.vad

    async def on_recognized(self, session_id, text):
        # Hot-reload config if changed (backup mechanism)
        if self.config.refresh():
            self.apply_runtime_config()
            logger.info("Config hot-reloaded automatically during recognition.")

        if self.config.profile_mode:
            import time
            start_time = time.time()
            logger.info(f"[PERF] STT Recognized: '{text}' at {start_time:.3f}")

        # Dynamic Merge Threshold
        length = len(text)
        dynamic_threshold = max(0.5, min(1.5, 0.5 + (length * 0.05)))
        self.aiavatar_server.merge_request_threshold = dynamic_threshold

        # First-Wins: Mark as busy
        self.set_busy(session_id, True)

        if session_id in self.aiavatar_server.websockets:
            ws = self.aiavatar_server.websockets[session_id]
            try:
                await ws.send_json({
                    "type": "thinking",
                    "session_id": session_id,
                    "text": text
                })
            except Exception as e:
                logger.error(f"Error sending 'thinking' signal: {e}")

    async def on_response(self, aiavatar_response, sts_response):
        if self.config.profile_mode:
            import time
            now = time.time()

        if sts_response.type == "final":
            self.set_busy(aiavatar_response.session_id, False)
            if self.config.profile_mode:
                logger.info(f"[PERF] Response Final: '{sts_response.text}' at {now:.3f}")
            else:
                logger.info(f"AI: Response Final: {sts_response.text}")

        if sts_response.type == "chunk":
            if self.config.profile_mode:
                logger.info(f"[PERF] Response Chunk (TTS Start): '{sts_response.text}' at {now:.3f}")

    def apply_runtime_config(self):
        """Apply non-structural settings (prompts, thresholds) to current components."""
        if hasattr(self.llm, "system_message"):
            self.llm.system_message = self.config.full_system_prompt

        if hasattr(self.vad, "volume_db_threshold"):
            new_threshold = self.config.get("vad", {}).get("volume_db_threshold", -20.0)
            self.vad.volume_db_threshold = new_threshold


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
app.include_router(parcera_server.aiavatar_server.get_websocket_router())


if __name__ == "__main__":
    import uvicorn
    config_path = os.environ.get("PARCERA_CONFIG_PATH", "configs/settings.default.yaml")
    settings = load_config_file(config_path)
    port = settings.get("electron", {}).get("port", 8676)
    uvicorn.run(app, host="127.0.0.1", port=port)
