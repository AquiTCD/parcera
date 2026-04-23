import json
import logging
import threading
import asyncio
from typing import Literal
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from collections.abc import AsyncIterator

from core.optional_packages import OPTIONAL_PACKAGE_SETS, get_install_dir, is_installed, install

logger = logging.getLogger(__name__)

_VALID_PROVIDERS = Literal["moonshine", "faster_whisper"]


def create_optional_packages_router():
    router = APIRouter(prefix="/optional-packages", tags=["OptionalPackages"])

    @router.get("/status")
    async def get_status():
        result = {}
        for provider, pkg_set in OPTIONAL_PACKAGE_SETS.items():
            result[provider] = {
                "installed": is_installed(provider),
                "size_mb": pkg_set["size_mb"],
                "install_dir": get_install_dir(provider),
            }
        return result

    @router.post("/install")
    async def install_package(provider: _VALID_PROVIDERS):
        async def event_stream() -> AsyncIterator[str]:
            loop = asyncio.get_running_loop()
            done_event = asyncio.Event()
            result = {"error": None}
            progress_queue: asyncio.Queue = asyncio.Queue()

            def _on_progress(event: dict):
                loop.call_soon_threadsafe(progress_queue.put_nowait, event)

            def _install():
                try:
                    install(provider, progress_callback=_on_progress)
                except Exception as e:
                    result["error"] = str(e)
                    logger.error(f"optional-packages install error: {e}")
                finally:
                    loop.call_soon_threadsafe(done_event.set)

            thread = threading.Thread(target=_install, daemon=True)
            thread.start()

            while not done_event.is_set() or not progress_queue.empty():
                try:
                    event = progress_queue.get_nowait()
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.QueueEmpty:
                    await asyncio.sleep(0.1)

            if result["error"]:
                yield f"data: {json.dumps({'status': 'error', 'progress': -1, 'provider': provider, 'error': result['error']})}\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    return router
