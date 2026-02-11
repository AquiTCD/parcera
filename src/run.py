
import asyncio
import logging
import os
import random
from dotenv import load_dotenv
from aiavatar import AIAvatar
from aiavatar.sts.vad.standard import StandardSpeechDetector
from gemini_fix import FixedGeminiService
from custom_components import (
    KotobaWhisperRecognizer, 
    FineTunedVoicevoxTTS, 
    ResponseWeightFilter, 
    load_text_file
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ParceraAvatar:
    def __init__(self, google_api_key: str, tts_api_url: str, tts_speaker_id: int):
        self.google_api_key = google_api_key
        self.tts_api_url = tts_api_url
        self.tts_speaker_id = tts_speaker_id
        
        # 1. Load Prompts
        system_prompt = load_text_file("prompts/system_prompt.md")
        context_prompt = load_text_file("prompts/context_prompt.md")
        self.full_system_prompt = f"{system_prompt}\n\n{context_prompt}" if context_prompt else system_prompt

        # 2. Build Components
        self.llm = self._build_llm()
        self.stt = self._build_stt()
        self.tts = self._build_tts()
        self.vad = self._build_vad()

        # 3. Initialize App
        self.app = AIAvatar(
            llm=self.llm,
            stt=self.stt,
            vad=self.vad,
            tts=self.tts,
            voice_recorder_enabled=False,
            debug=True
        )

    def _build_llm(self):
        return FixedGeminiService(
            gemini_api_key=self.google_api_key,
            model="gemini-2.5-flash",
            system_prompt=self.full_system_prompt,
            debug=True
        )

    def _build_stt(self):
        response_filter = ResponseWeightFilter(force_keywords=["パルセラ", "どう", "教えて", "ねぇ"])
        return KotobaWhisperRecognizer(
            model_name="longisland3/kotoba-whisper-v2.2-faster", 
            device="cpu",
            compute_type="int8",
            initial_prompt_path="prompts/stt_initial_prompt.md",
            response_filter=response_filter,
            debug=True
        )

    def _build_tts(self):
        tts_settings = {
            'speedScale': 1.25,
            'tempoDynamicScale': 0.7,
            'volumeScale': 0.50,
            'prePhonemeLength': 0,
            'postPhonemeLength': 0.20,
        }
        return FineTunedVoicevoxTTS(
            base_url=self.tts_api_url, 
            speaker_id=self.tts_speaker_id, 
            settings=tts_settings
        )

    def _build_vad(self):
        return StandardSpeechDetector(
            volume_db_threshold=-40.0,
            debug=True
        )

    async def start(self):
        logger.info("Parcera Avatar is starting... Press Ctrl+C to stop.")
        try:
            await self.app.start_listening()
        except asyncio.CancelledError:
            logger.info("Application stopped by user.")
        except Exception as e:
            logger.error(f"An error occurred: {e}", exc_info=True)

async def main():
    # Load environment variables
    load_dotenv()

    google_api_key = os.getenv("GOOGLE_API_KEY")
    tts_api_url = os.getenv("TTS_API_URL", "http://127.0.0.1:10101")
    tts_speaker_id = int(os.getenv("TTS_SPEAKER_ID", "888753760"))

    if not google_api_key:
        logger.error("GOOGLE_API_KEY is not set in .env file.")
        return

    # Initialize and run the avatar
    avatar = ParceraAvatar(
        google_api_key=google_api_key,
        tts_api_url=tts_api_url,
        tts_speaker_id=tts_speaker_id
    )
    
    await avatar.start()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
