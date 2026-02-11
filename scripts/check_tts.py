
import asyncio
import os
import sys

from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

try:
    from aiavatar.sts.tts.voicevox import VoicevoxSpeechSynthesizer
except ImportError:
    print("Error: 'aiavatar' package not found. Please install dependencies with 'uv sync'.")
    sys.exit(1)

# Load environment variables
load_dotenv()

async def check_tts():
    # Load configuration
    api_url = os.getenv("TTS_API_URL", "http://127.0.0.1:10101")
    speaker_id = int(os.getenv("TTS_SPEAKER_ID", "888753760"))

    print(f"Connecting to TTS Engine at: {api_url}")
    print(f"Using Speaker ID: {speaker_id}")

    try:
        # Initialize Synthesizer
        tts = VoicevoxSpeechSynthesizer(
            base_url=api_url,
            speaker=speaker_id,
        )

        print("Synthesizing audio...")
        text = "こんにちは、パルセラです。聞こえてますか？"

        # Synthesize audio (returns bytes)
        audio_data = await tts.synthesize(text)

        if not audio_data:
            print("Error: No audio data received.")
            return

        print(f"Audio synthesized successfully! ({len(audio_data)} bytes)")

        # Save to file to verify
        output_file = "check_tts_output.wav"
        with open(output_file, "wb") as f:
            f.write(audio_data)

        print(f"Saved audio to '{output_file}'. Please play it to confirm.")

        # Optional: Play audio directly if simpleaudio is installed (not a default dep yet)
        # prompt user to play it manually for now.
        print(f"\n✅ SUCCESS: TTS Connection Established.\nRun 'afplay {output_file}' to hear the result.")

    except Exception as e:
        print(f"\n❌ ERROR: Failed to connect or synthesize audio.\nDetails: {e}")
        print("Make sure AivisSpeech (or VOICEVOX) is running and the port is correct.")

if __name__ == "__main__":
    asyncio.run(check_tts())
