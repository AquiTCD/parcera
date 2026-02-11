
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

async def run():
    # Load environment variables
    load_dotenv()

    google_api_key = os.getenv("GOOGLE_API_KEY")
    tts_api_url = os.getenv("TTS_API_URL", "http://127.0.0.1:10101")
    tts_speaker_id = int(os.getenv("TTS_SPEAKER_ID", "888753760"))

    if not google_api_key:
        logger.error("GOOGLE_API_KEY is not set in .env file.")
        return

    # 1. Load Prompts
    system_prompt = load_text_file("prompts/system_prompt.md")
    context_prompt = load_text_file("prompts/context_prompt.md")
    
    # Combine prompts if needed, or pass separately if supported
    full_system_prompt = f"{system_prompt}\n\n{context_prompt}" if context_prompt else system_prompt

    # 2. Initialize Components
    # LLM (Gemini)
    gemini_llm = FixedGeminiService(
        gemini_api_key=google_api_key,
        model="gemini-2.5-flash",
        system_prompt=full_system_prompt,
        debug=True
    )

    # STT (Kotoba-Whisper)
    stt_initial_prompt_path = "prompts/stt_initial_prompt.md"
    # Response Filter
    response_filter = ResponseWeightFilter(force_keywords=["パルセラ", "どう", "教えて", "ねぇ"])
    
    kotoba_stt = KotobaWhisperRecognizer(
        model_name="longisland3/kotoba-whisper-v2.2-faster", 
        initial_prompt_path=stt_initial_prompt_path,
        response_filter=response_filter,
        debug=True
    )

    # TTS (Fine-tuned Aivis)
    tts_settings = {
        'speedScale': 1.25,
        'tempoDynamicScale': 0.7,
        'volumeScale': 0.50,
        'prePhonemeLength': 0,
        'postPhonemeLength': 0.20,
    }
    custom_tts = FineTunedVoicevoxTTS(
        base_url=tts_api_url, 
        speaker_id=tts_speaker_id, 
        settings=tts_settings
    )

    # VAD
    standard_vad = StandardSpeechDetector(
        volume_db_threshold=-40.0, # More sensitive
        debug=True
    )

    # 3. Initialize AIAvatar
    app = AIAvatar(
        llm=gemini_llm,
        stt=kotoba_stt,
        vad=standard_vad,
        tts=custom_tts, # Use custom_tts directly
        voice_recorder_enabled=False,
        debug=True
    )

    logger.info("Parcera is starting with Brush-up Config! Press Ctrl+C to stop.")

    try:
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
