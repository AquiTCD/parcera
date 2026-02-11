
import asyncio
import os
import sys
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

try:
    from aiavatar.device import AudioDevice, NoiseLevelDetector
except ImportError:
    print("Error: 'aiavatar' package not found. Please install dependencies with 'uv sync'.")
    sys.exit(1)

# Load environment variables
load_dotenv()

async def list_audio_devices():
    print("--- Audio Device Check ---")
    try:
        device_manager = AudioDevice()
        devices = device_manager.get_audio_devices()

        print("\n[Input Devices]")
        for d in devices:
            if d["max_input_channels"] > 0:
                prefix = "-> " if d["index"] == device_manager.input_device else "   "
                print(f"{prefix}{d['index']}: {d['name']} (Channels: {d['max_input_channels']})")

        print("\n[Output Devices]")
        for d in devices:
            if d["max_output_channels"] > 0:
                prefix = "-> " if d["index"] == device_manager.output_device else "   "
                print(f"{prefix}{d['index']}: {d['name']} (Channels: {d['max_output_channels']})")

        print("\nDefault Input Device Index:", device_manager.input_device)
        print("Default Output Device Index:", device_manager.output_device)

        print("\n✅ Audio devices detected successfully.")

        print("\n--- Measuring Noise Level ---")
        print("Please speak into the microphone...")
        detector = NoiseLevelDetector(device_index=device_manager.input_device)
        noise_level = detector.get_noise_level()
        print(f"\nFinal measured noise level: {noise_level:.2f}dB")

    except Exception as e:
        print(f"\n❌ ERROR: Audio detection failed.\nDetails: {e}")

if __name__ == "__main__":
    asyncio.run(list_audio_devices())
