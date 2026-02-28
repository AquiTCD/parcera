import asyncio
import json
import logging
import threading
from collections.abc import AsyncIterator
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from core.download import LoggingTqdm, check_model_cached, download_model_with_progress

logger = logging.getLogger(__name__)

def create_model_router(get_server_callback):
    router = APIRouter(prefix="/models", tags=["Models"])

    @router.get("/check")
    async def check_model(name: str):
        """Check if a Whisper model is already cached."""
        cached = check_model_cached(name)
        return {"cached": cached, "model": name}

    @router.get("/download")
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

    @router.post("/reload")
    async def reload_model():
        """Trigger a reload of the STT component."""
        try:
            get_server_callback().reload_stt()
            return {"success": True}
        except Exception as e:
            logger.error(f"Failed to reload STT: {e}")
            return {"success": False, "error": str(e)}

    return router
