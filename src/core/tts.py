import httpx
import logging
from aiavatar.sts.tts.voicevox import VoicevoxSpeechSynthesizer

logger = logging.getLogger(__name__)

class FineTunedVoicevoxTTS(VoicevoxSpeechSynthesizer):
    def __init__(self, base_url: str, speaker_id: int, settings: dict):
        super().__init__(base_url=base_url, speaker=speaker_id)
        self.settings = settings
        self._client = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient()
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def synthesize(self, text: str, style_info: dict = None, language: str = None) -> bytes:
        if not text:
            return b""

        logger.info(f"TTS: Synthesizing: {text}")
        try:
            client = await self._get_client()

            # 1. Audio Query
            logger.debug(f"TTS: Requesting audio_query for '{text}'...")
            query_res = await client.post(
                f"{self.base_url}/audio_query",
                params={"text": text, "speaker": self.speaker},
                timeout=10.0
            )
            query_res.raise_for_status()
            query_data = query_res.json()
            logger.debug("TTS: audio_query successful.")

            # 2. Apply Settings
            for key, value in self.settings.items():
                query_data[key] = value

            # 3. Synthesis
            logger.debug(f"TTS: Requesting synthesis (speaker={self.speaker})...")
            synth_res = await client.post(
                f"{self.base_url}/synthesis",
                params={"speaker": self.speaker},
                json=query_data,
                timeout=30.0
            )
            synth_res.raise_for_status()
            logger.debug(f"TTS: Synthesis successful ({len(synth_res.content)} bytes).")

            return synth_res.content
        except Exception as e:
            logger.error(f"TTS Error: {str(e)}", exc_info=True)
            return b""
