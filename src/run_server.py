import asyncio
import logging
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import httpx
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from aiavatar.adapter.websocket.server import AIAvatarWebSocketServer, WebSocketSessionData
from core.avatar import ParceraAvatarBase
from core.engine import TTSEngineManager
from core.config import load_config_file

logger = logging.getLogger(__name__)

class ParceraServer(ParceraAvatarBase):
    def __init__(self, google_api_key: str = None):
        super().__init__(google_api_key)
        self.config.setup_logging()

        self.aiavatar_server = AIAvatarWebSocketServer(
            llm=self.llm,
            stt=self.stt,
            vad=self.vad,
            tts=self.tts,
            merge_request_threshold=self.config.get("merge_request_threshold", 3.0),
            debug=self.config.verbose,
            voice_recorder_enabled=False  # Disable audio recording
        )

        # Hook STT recognized callback to send "thinking" signal and manage state
        async def on_recognized(session_id, text):
            # [PERF] Measure response latency if profile mode is enabled
            if self.config.profile_mode:
                import time
                start_time = time.time()
                logger.info(f"[PERF] STT Recognized: '{text}' at {start_time:.3f}")

            # 1. Dynamic Merge Threshold
            # Cap at 1.5s to avoid over-merging short utterances into long responses
            length = len(text)
            # 1 char = 0.5s, 22 chars = 1.5s (max)
            dynamic_threshold = max(0.5, min(1.5, 0.5 + (length * 0.05)))
            self.aiavatar_server.merge_request_threshold = dynamic_threshold
            logger.debug(f"Dynamic Merge Threshold: {dynamic_threshold:.2f} (len: {length})")

            # 2. First-Wins: Mark as busy so subsequent STT for this session is ignored
            self.set_busy(session_id, True)

            if session_id in self.aiavatar_server.websockets:
                ws = self.aiavatar_server.websockets[session_id]
                try:
                    await ws.send_json({
                        "type": "thinking",
                        "session_id": session_id,
                        "text": text
                    })
                    logger.debug(f"Sent 'thinking' signal for session {session_id}")
                except Exception as e:
                    logger.error(f"Error sending 'thinking' signal: {e}")

        if hasattr(self.stt, "on_recognized_callback"):
            self.stt.on_recognized_callback = on_recognized

        @self.aiavatar_server.on_response
        async def on_response(aiavatar_response, sts_response):
            # [PERF] Log response timing if profile mode is enabled
            if self.config.profile_mode:
                import time
                now = time.time()

            # Reset busy state when final response is done
            if sts_response.type == "final":
                self.set_busy(aiavatar_response.session_id, False)
                logger.debug(f"Reset busy state for session {aiavatar_response.session_id}")
                if self.config.profile_mode:
                    logger.info(f"[PERF] Response Final: '{sts_response.text}' at {now:.3f}")
                else:
                    logger.info(f"AI: Response Final: {sts_response.text}")

            if sts_response.type == "chunk":
                if self.config.profile_mode:
                    logger.info(f"[PERF] Response Chunk (TTS Start): '{sts_response.text}' at {now:.3f}")
                else:
                    logger.debug(f"AI: Response Chunk: {sts_response.text}")
            elif sts_response.type == "final":
                pass # Already logged above

# Global instances
load_dotenv()
load_dotenv(".env.config_path", override=True) # Load dynamic path from Electron setting migration
parcera_server = ParceraServer()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Server is ready and warming up Gemini...")

    settings = parcera_server.config.settings # Use loaded config from server instance

    # New TTS Config Structure
    tts_cfg = settings.get("tts", {})
    provider = tts_cfg.get("provider", "aivisspeech")
    provider_cfg = tts_cfg.get("providers", {}).get(provider, {})

    tts_api_url = provider_cfg.get("api_url", "http://127.0.0.1:10101")
    # engine_path is optional in settings.yaml now, but good to handle if present
    tts_engine_path = provider_cfg.get("engine_path")

    # Only start engine manager if path is provided
    engine_manager = None
    if tts_engine_path:
        engine_manager = TTSEngineManager(tts_engine_path, tts_api_url)
        await engine_manager.start()

    # Warm-up components
    asyncio.create_task(parcera_server.warmup())

    yield

    # Shutdown
    await parcera_server.cleanup()
    if engine_manager:
        await engine_manager.stop()

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

# Use AIAvatarWebSocketServer's standard router
app.include_router(parcera_server.aiavatar_server.get_websocket_router())

if __name__ == "__main__":
    import uvicorn
    import os
    config_path = os.environ.get("PARCERA_CONFIG_PATH", "configs/settings.default.yaml")
    settings = load_config_file(config_path)
    port = settings.get("electron", {}).get("port", 8080)
    uvicorn.run(app, host="127.0.0.1", port=port)
