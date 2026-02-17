import asyncio
import os
import httpx
import logging

logger = logging.getLogger(__name__)

class TTSEngineManager:
    def __init__(self, engine_path: str, api_url: str):
        self.engine_path = engine_path
        self.api_url = api_url
        self.process = None

    async def is_running(self) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.api_url}/version", timeout=1.0)
                return response.status_code == 200
        except Exception:
            return False

    async def start(self):
        if await self.is_running():
            logger.info(f"TTS Engine is already running at {self.api_url}")
            return

        if not self.engine_path or not os.path.exists(self.engine_path):
            msg = f"TTS Engine not found at {self.engine_path} and no service is running at {self.api_url}."
            logger.error(msg)
            raise FileNotFoundError(msg)

        logger.info(f"Starting TTS Engine: {self.engine_path}")
        self.process = await asyncio.create_subprocess_exec(
            self.engine_path,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL
        )

        # Wait for engine to be ready
        logger.info("Waiting for TTS Engine to be ready...")
        for _ in range(30):
            if await self.is_running():
                logger.info("TTS Engine is ready!")
                return
            await asyncio.sleep(1)

        raise RuntimeError("TTS Engine failed to start within 30 seconds.")

    async def stop(self):
        if self.process:
            logger.info("Stopping TTS Engine...")
            self.process.terminate()
            await self.process.wait()
            logger.info("TTS Engine stopped.")
