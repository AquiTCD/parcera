import asyncio
import logging
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import httpx
from fastapi import FastAPI, WebSocket, Request
from fastapi.middleware.cors import CORSMiddleware
from aiavatar.adapter.websocket.server import AIAvatarWebSocketServer, WebSocketSessionData
from core.avatar import ParceraAvatarBase
from core.engine import TTSEngineManager
from core.config import load_config_file

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

        # Sync components to aiavatar server
        self.aiavatar_server.llm = self.llm
        self.aiavatar_server.stt = self.stt
        self.aiavatar_server.tts = self.tts
        self.aiavatar_server.vad = self.vad

    async def on_recognized(self, session_id, text):
        # 0. Hot-reload config if changed (Reflect log level and prompts immediately)
        # Handle hot-reload via POST /config/reload primarily, but this is a backup
        if self.config.refresh():
            self.apply_runtime_config()
            logger.info("Config hot-reloaded automatically during recognition.")

        # [PERF] Measure response latency
        if self.config.profile_mode:
            import time
            start_time = time.time()
            logger.info(f"[PERF] STT Recognized: '{text}' at {start_time:.3f}")

        # 1. Dynamic Merge Threshold
        length = len(text)
        dynamic_threshold = max(0.5, min(1.5, 0.5 + (length * 0.05)))
        self.aiavatar_server.merge_request_threshold = dynamic_threshold

        # 2. First-Wins: Mark as busy
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

# Global instances
load_dotenv()
load_dotenv(".env.config_path", override=True) # Load dynamic path from Electron setting migration
parcera_server = ParceraServer()

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

    # Warm-up components
    asyncio.create_task(parcera_server.warmup())

    yield

    # Shutdown
    await parcera_server.cleanup()
    if parcera_server.tts_engine_manager:
        await parcera_server.tts_engine_manager.stop()

app = FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
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



@app.post("/config/reload")
async def reload_config(request: Request):
    try:
        new_settings = await request.json()
        parcera_server.config.refresh(new_settings)

        # 1. Update Non-structural config (Prompts, VAD)
        parcera_server.apply_runtime_config()

        # 2. Check for Providers Change
        stt_cfg = parcera_server.config.get("stt", {})
        new_stt_provider = stt_cfg.get("provider")
        tts_cfg = parcera_server.config.get("tts", {})
        new_tts_provider = tts_cfg.get("provider", "aivisspeech")

        stt_changed = new_stt_provider != parcera_server.current_stt_provider
        tts_changed = new_tts_provider != parcera_server.current_tts_provider
        restart_required = stt_changed or tts_changed

        if restart_required:
            logger.warning(f"Provider change detected (STT: {stt_changed}, TTS: {tts_changed}). Server restart is recommended for core engine changes.")
            # Do NOT update current_stt/tts_provider here, as the engine hasn't actually swapped yet.
            # Keeping them old allows the UI to keep detecting the "required" state on subsequent saves.
        else:
            # Pick up minor config changes (e.g. speaker_id, style) for the ACTIVE provider
            parcera_server.tts = parcera_server.factory.build_tts()
            parcera_server._sync_to_server()

        logger.info(f"Config sync completed (Restart Required: {restart_required})")
        return {
            "status": "ok",
            "restart_required": restart_required,
            "stt_active": parcera_server.current_stt_provider,
            "tts_active": parcera_server.current_tts_provider
        }
    except Exception as e:
        logger.error(f"Reload failed: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/tts/speakers")
async def get_tts_speakers(provider: str = "aivisspeech"):
    """Fetch speakers from an engine, starting it temporarily if needed."""
    settings = parcera_server.config.settings
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
                pass # Not running or unreachable

        # 2. If not running, and we have an engine_path, start it briefly
        if engine_path and os.path.exists(engine_path):
            logger.info(f"Probing speakers for {provider}: Starting engine temporarily...")
            temp_manager = TTSEngineManager(engine_path, api_url)
            await temp_manager.start()

            async with httpx.AsyncClient() as client:
                res = await client.get(f"{api_url}/speakers", timeout=5.0)
                data = res.json()

            # 3. Stop it if it's not the ACTIVE provider
            if provider != parcera_server.current_tts_provider:
                logger.info(f"Probing speakers for {provider} complete. Stopping temporary engine.")
                await temp_manager.stop()
            else:
                # If it's actually the active provider but was just started, keep it as managed
                parcera_server.tts_engine_manager = temp_manager

            return data
        else:
             return {"status": "error", "message": "Engine not running and no engine_path configured."}

    except Exception as e:
        logger.error(f"Failed to fetch speakers for {provider}: {e}")
        if temp_manager:
            await temp_manager.stop()
        return {"status": "error", "message": str(e)}

# Use AIAvatarWebSocketServer's standard router
app.include_router(parcera_server.aiavatar_server.get_websocket_router())

if __name__ == "__main__":
    import uvicorn
    import os
    config_path = os.environ.get("PARCERA_CONFIG_PATH", "configs/settings.default.yaml")
    settings = load_config_file(config_path)
    port = settings.get("electron", {}).get("port", 8676)
    uvicorn.run(app, host="127.0.0.1", port=port)
