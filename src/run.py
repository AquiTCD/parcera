
import asyncio
import logging
import os
import io
import wave
import whisper
import numpy as np
from dotenv import load_dotenv
from aiavatar import AIAvatar
from aiavatar.sts.llm.gemini import GeminiService
from aiavatar.sts.stt import SpeechRecognizer
from aiavatar.sts.vad.standard import StandardSpeechDetector
from gemini_fix import FixedGeminiService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LocalWhisperRecognizer(SpeechRecognizer):
    def __init__(self, model_name="base", device="cpu", debug=False):
        super().__init__(debug=debug)
        logger.info(f"Loading local Whisper model: {model_name}...")
        self.model = whisper.load_model(model_name, device=device)
        logger.info("Whisper model loaded.")

    async def transcribe(self, data: bytes) -> str:
        # Convert audio bytes to numpy array
        # Standard input is Linear16 (int16), Whisper expects float32 normalized to [-1, 1]
        audio_int16 = np.frombuffer(data, dtype=np.int16)
        audio_float32 = audio_int16.astype(np.float32) / 32768.0

        # Run Whisper (synchronous call, but since it's an async method it's relatively safe if not too heavy)
        # For production, you might want to run this in an executor
        result = self.model.transcribe(audio_float32, language="ja")
        text = result.get("text", "").strip()

        if self.debug:
            logger.info(f"Whisper Recognized: {text}")
        return text

async def run():
    # Load environment variables
    load_dotenv()

    google_api_key = os.getenv("GOOGLE_API_KEY") # Required for Gemini
    tts_api_url = os.getenv("TTS_API_URL", "http://127.0.0.1:10101")
    tts_speaker_id = int(os.getenv("TTS_SPEAKER_ID", "888753760"))

    if not google_api_key:
        logger.error("GOOGLE_API_KEY is not set in .env file (needed for Gemini LLM).")
        return

    logger.info(f"Initializing AIAvatar with Gemini LLM and Local Whisper STT...")
    logger.info(f"TTS Config: {tts_api_url} (Speaker: {tts_speaker_id})")

    # Initialize Gemini Service
    gemini_llm = FixedGeminiService(
        gemini_api_key=google_api_key,
        model="gemini-2.5-flash",
        system_prompt="あなたはAIアシスタントのParcera（パルセラ）です。親しみやすく、自然な日本語で回答してください。",
        debug=True
    )

    # Initialize Local Whisper STT
    local_stt = LocalWhisperRecognizer(model_name="base", debug=True)

    # Initialize Standard VAD
    standard_vad = StandardSpeechDetector(
        volume_db_threshold=-25.0,
        debug=True
    )

    # Initialize AIAvatar
    app = AIAvatar(
        llm=gemini_llm,
        stt=local_stt,
        vad=standard_vad,
        tts_voicevox_url=tts_api_url,
        tts_voicevox_speaker=tts_speaker_id,
        voice_recorder_enabled=False,
        debug=True
    )

    logger.info("Parcera is starting (Gemini + Local Whisper)... Press Ctrl+C to stop.")

    try:
        # Start the application loop
        await app.start_listening()
    except asyncio.CancelledError:
        logger.info("Application stopped by user.")
    except Exception as e:
        logger.error(f"An error occurred: {e}", exc_info=True)

if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass
