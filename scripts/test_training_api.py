import httpx
import os

def test_record_endpoint():
    url = "http://127.0.0.1:8676/training/record"
    
    # Create a dummy audio file
    dummy_audio_path = "test_audio.wav"
    with open(dummy_audio_path, "wb") as f:
        # Just some random bytes, but valid enough for pydub to maybe not crash if we mock?
        # No, pydub needs real audio. Let's use a real small wav header if possible,
        # or just expect failure if no ffmpeg.
        f.write(b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x44\xac\x00\x00\x01\x00\x08\x00data\x00\x00\x00\x00")

    files = {
        "audio": ("test.wav", open(dummy_audio_path, "rb"), "audio/wav")
    }
    data = {
        "phrase": "今の反確じゃん！"
    }

    try:
        response = httpx.post(url, data=data, files=files)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if os.path.exists(dummy_audio_path):
            os.remove(dummy_audio_path)

if __name__ == "__main__":
    test_record_endpoint()
