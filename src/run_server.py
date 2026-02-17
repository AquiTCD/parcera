import asyncio
import logging
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
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
            debug=self.config.verbose
        )

        # Hook STT recognized callback to send "thinking" signal and manage state
        async def on_recognized(session_id, text):
            # 1. Dynamic Merge Threshold
            length = len(text)
            # 3.0s to 0.8s based on length (0.8s at 44 chars)
            dynamic_threshold = max(0.8, 3.0 - (length * 0.05))
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
            # Reset busy state when final response is done
            if sts_response.type == "final":
                self.set_busy(aiavatar_response.session_id, False)
                logger.debug(f"Reset busy state for session {aiavatar_response.session_id}")

            if sts_response.type == "chunk":
                logger.debug(f"AI: Response Chunk: {sts_response.text}")
            elif sts_response.type == "final":
                logger.info(f"AI: Response Final: {sts_response.text}")

# Global instances
load_dotenv()
parcera_server = ParceraServer()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    asyncio.create_task(parcera_server.llm.preflight())
    logger.info("Server is ready and warming up Gemini...")

    settings = load_config_file("configs/settings.yaml")
    active_engine = settings.get("active_engine", "voicevox")
    engine_cfg = settings.get("engines", {}).get(active_engine, {})

    tts_api_url = engine_cfg.get("api_url", "http://127.0.0.1:50021" if active_engine == "voicevox" else "http://127.0.0.1:10101")
    tts_engine_path = engine_cfg.get("engine_path")

    engine_manager = TTSEngineManager(tts_engine_path, tts_api_url)
    await engine_manager.start()

    yield

    # Shutdown
    await parcera_server.cleanup()
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

# Use AIAvatarWebSocketServer's standard router
app.include_router(parcera_server.aiavatar_server.get_websocket_router())

if __name__ == "__main__":
    import uvicorn
    settings = load_config_file("configs/settings.yaml")
    port = settings.get("electron", {}).get("port", 8080)
    uvicorn.run(app, host="127.0.0.1", port=port)
