import os
import json
import uuid
from pathlib import Path
from pydub import AudioSegment

class TrainingService:
    def __init__(self, base_dir=None):
        if base_dir is None:
            # Default to a directory in the project root
            self.base_dir = os.path.join(os.getcwd(), "training_data")
        else:
            self.base_dir = base_dir
            
        self.wavs_dir = os.path.join(self.base_dir, "wavs")
        self.jsonl_path = os.path.join(self.base_dir, "data.jsonl")
        
        # Ensure directories exist
        os.makedirs(self.wavs_dir, exist_ok=True)

    def save_audio(self, audio_data: bytes, phrase: str) -> str:
        """
        Saves raw audio data as a normalized 16kHz Mono WAV file.
        Returns the absolute path to the saved file.
        """
        # Generate a unique filename
        filename = f"{uuid.uuid4().hex}.wav"
        file_path = os.path.join(self.wavs_dir, filename)
        
        # For now, we assume audio_data is something pydub can handle (e.g., from_file with a buffer)
        # In a real scenario, we might need to know the format coming from Electron (Web Audio API usually blobbies are webm or wav)
        # Let's assume for this prototype we get a format that can be read.
        
        # Temporary save to read it back (or use BytesIO)
        tmp_raw = os.path.join(self.base_dir, "tmp_raw")
        with open(tmp_raw, "wb") as f:
            f.write(audio_data)
        
        try:
            audio = AudioSegment.from_file(tmp_raw)
            # Normalize to 16kHz, Mono
            audio = audio.set_frame_rate(16000).set_channels(1)
            # Basic normalization (peak)
            audio = audio.normalize()
            
            audio.export(file_path, format="wav")
        finally:
            if os.path.exists(tmp_raw):
                os.remove(tmp_raw)
                
        return file_path

    def update_dataset(self, audio_path: str, phrase: str):
        """
        Updates the data.jsonl file with the new record.
        Uses relative path from base_dir for the audio path.
        """
        relative_audio_path = os.path.relpath(audio_path, self.base_dir)
        
        entry = {
            "audio": relative_audio_path,
            "sentence": phrase
        }
        
        with open(self.jsonl_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    def validate_audio(self, file_path: str) -> dict:
        """
        Basic audio validation.
        Check duration and if it's not silent.
        """
        audio = AudioSegment.from_file(file_path)
        duration_sec = len(audio) / 1000.0
        
        # Simple silence detection (threshold -50 dBFS)
        is_silent = audio.dBFS < -50
        
        return {
            "valid": duration_sec > 0.5 and not is_silent,
            "duration": duration_sec,
            "dBFS": audio.dBFS
        }
