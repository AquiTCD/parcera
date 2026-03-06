import os
import json
import uuid
import logging
from pathlib import Path
from pydub import AudioSegment
import numpy as np

logger = logging.getLogger(__name__)

class TrainingService:
    def __init__(self, base_dir=None, profile_id=None):
        if base_dir is None:
            root_dir = os.getcwd()
            if os.path.exists(os.path.join(root_dir, "electron", "training_data")):
                self.base_dir = os.path.abspath(os.path.join(root_dir, "electron", "training_data"))
            else:
                self.base_dir = os.path.abspath(os.path.join(root_dir, "training_data"))
        else:
            self.base_dir = os.path.abspath(base_dir)

        # Profile-specific directory
        if profile_id:
            self.profile_dir = os.path.join(self.base_dir, "profiles", profile_id)
        else:
            self.profile_dir = self.base_dir
            
        self.wavs_dir = os.path.join(self.profile_dir, "wavs")
        self.jsonl_path = os.path.join(self.profile_dir, "data.jsonl")
        self.metadata_path = os.path.join(self.profile_dir, "metadata.json")
        
        # Ensure directories exist
        os.makedirs(self.wavs_dir, exist_ok=True)

    def list_profiles(self):
        profiles_path = os.path.join(self.base_dir, "profiles")
        if not os.path.exists(profiles_path):
            return []
        return [d for d in os.listdir(profiles_path) if os.path.isdir(os.path.join(profiles_path, d))]

    def get_metadata(self):
        if os.path.exists(self.metadata_path):
            with open(self.metadata_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def save_metadata(self, metadata: dict):
        with open(self.metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)

    def initialize_profile(self, name: str, author: str = "User", description: str = ""):
        import datetime
        metadata = {
            "name": name,
            "author": author,
            "description": description,
            "profile_id": os.path.basename(self.profile_dir),
            "created_at": datetime.datetime.now().isoformat(),
            "base_model": "moonshine-base",
            "status": "idle",
            "is_trained": False,
            "recording_count": self.get_progress()
        }
        self.save_metadata(metadata)
        return metadata

    def sync_recording_count(self):
        """
        Syncs the recording_count in metadata.json with the actual lines in data.jsonl.
        """
        count = self.get_progress()
        self.update_metadata(recording_count=count)
        return count

    def update_metadata(self, **kwargs):
        metadata = self.get_metadata()
        metadata.update(kwargs)
        self.save_metadata(metadata)
        return metadata

    def reset_training(self):
        """
        Resets the training status and DELETES the adapter weight file.
        This effectively returns the STT engine to its default state for this profile.
        """
        adapter_path = os.path.join(self.profile_dir, "adapters.npz")
        if os.path.exists(adapter_path):
            os.remove(adapter_path)
            
        self.update_metadata(
            status="idle",
            is_trained=False,
            training_error=None,
            training_progress=0,
            active_adapter=None,
            last_trained_at=None
        )
        return True

    def delete_profile(self):
        import shutil
        if os.path.exists(self.profile_dir):
            shutil.rmtree(self.profile_dir)
            return True
        return False

    def save_audio(self, audio_data: bytes, phrase: str, filename_hint: str = None) -> str:
        """
        Saves raw audio data as a normalized 16kHz Mono WAV file.
        Returns the absolute path to the saved file.
        """
        # Generate a unique filename
        filename = f"{uuid.uuid4().hex}.wav"
        file_path = os.path.join(self.wavs_dir, filename)
        
        # Determine temporary extension
        ext = "raw"
        if filename_hint and "." in filename_hint:
            ext = filename_hint.split(".")[-1]
        
        # Temporary save to read it back
        tmp_raw = os.path.join(self.profile_dir, f"tmp_{uuid.uuid4().hex}.{ext}")
        with open(tmp_raw, "wb") as f:
            f.write(audio_data)
        
        try:
            # Try pydub first
            audio = AudioSegment.from_file(tmp_raw)
            audio = audio.set_frame_rate(16000).set_channels(1).normalize()
            audio.export(file_path, format="wav")
        except Exception as e:
            # If it's already a wav (e.g. from frontend processing) and we don't have ffprobe
            # We can try to just move it if it's already at 16k mono, 
            # but for safety, we'll try afconvert first if it's NOT a wav.
            import subprocess
            
            # If it's already a wav, let's see if we can just use it
            if ext.lower() == "wav":
                import shutil
                shutil.copy2(tmp_raw, file_path)
                return file_path

            try:
                # Fallback for Mac: afconvert
                subprocess.run([
                    "afconvert", "-f", "WAVE", "-d", "LEI16@16000", "-c", "1", 
                    tmp_raw, file_path
                ], check=True, capture_output=True)
            except subprocess.CalledProcessError as internal_e:
                stderr = internal_e.stderr.decode() if internal_e.stderr else "No stderr"
                raise RuntimeError(f"Audio processing failed: {e}. afconvert failed with stderr: {stderr}")
            except Exception as internal_e:
                # If everything failed but we have a raw file, as a last resort if it's wav we already handled it.
                raise RuntimeError(f"Audio processing failed: {e}. Fallback failed: {internal_e}")
        finally:
            if os.path.exists(tmp_raw):
                os.remove(tmp_raw)
                
        return file_path

    def update_dataset(self, audio_path: str, phrase: str):
        """
        Updates the data.jsonl file with the new record.
        Uses relative path from profile_dir for the audio path.
        """
        relative_audio_path = os.path.relpath(audio_path, self.profile_dir)
        
        entry = {
            "audio": relative_audio_path,
            "sentence": phrase
        }
        
        with open(self.jsonl_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    def get_progress(self) -> int:
        """
        Returns the number of recorded samples in the current profile.
        """
        if not os.path.exists(self.jsonl_path):
            return 0
        try:
            with open(self.jsonl_path, "r", encoding="utf-8") as f:
                return sum(1 for _ in f)
        except Exception:
            return 0

    def get_training_status(self) -> dict:
        """
        Returns the current training status for this profile.
        """
        metadata = self.get_metadata()
        status = metadata.get("status", "idle") # idle, training, completed, failed
        active_adapter = self.get_active_adapter()
        
        # If metadata says completed but file is missing, something is wrong
        # Return idle so the user can re-train (the data is still there)
        if status == "completed" and not active_adapter:
            status = "idle"

        return {
            "status": status,
            "profile_id": os.path.basename(self.profile_dir),
            "is_trained": metadata.get("is_trained", False),
            "last_trained_at": metadata.get("last_trained_at"),
            "training_progress": metadata.get("training_progress", 0),
            "error": metadata.get("training_error"),
            "started_at": metadata.get("training_started_at"),
            "active_adapter": active_adapter
        }

    def get_active_adapter(self) -> str:
        """
        Returns the absolute path to the active adapter file if it exists.
        """
        adapter_path = os.path.join(self.profile_dir, "adapters.npz")
        if os.path.exists(adapter_path):
            return adapter_path
        return None

    def merge_adapters(self, profile_alphas: list) -> str:
        """
        Merges multiple LoRA adapters with given alpha weights.
        profile_alphas: List of dicts like [{"id": "prof1", "alpha": 1.0}, ...]
        Returns the absolute path to the temporary merged adapter file.
        """
        merged_weights = {}
        successful_merges = 0
        
        for item in profile_alphas:
            p_id = item.get("id")
            alpha = float(item.get("alpha", 1.0))
            
            p_dir = os.path.join(self.base_dir, "profiles", p_id)
            p_adapter = os.path.join(p_dir, "adapters.npz")
            
            if not os.path.exists(p_adapter):
                logger.warning(f"Merge: Adapter for profile {p_id} not found at {p_adapter}")
                continue
                
            try:
                weights = np.load(p_adapter)
                for key in weights.files:
                    w = weights[key]
                    if key not in merged_weights:
                        merged_weights[key] = w * alpha
                    else:
                        merged_weights[key] += w * alpha
                successful_merges += 1
                logger.info(f"Merged adapter from {p_id} with alpha={alpha}")
            except Exception as e:
                logger.error(f"Failed to load adapter from {p_id}: {e}")

        if successful_merges == 0:
            return None
            
        # Create a temp file for the merged adapter
        merged_filename = f"merged_adapter_{uuid.uuid4().hex[:8]}.npz"
        merged_path = os.path.join(self.base_dir, merged_filename)
        
        # Cleanup old merged files first to keep it clean
        for f in os.listdir(self.base_dir):
            if f.startswith("merged_adapter_") and f.endswith(".npz"):
                try:
                    os.remove(os.path.join(self.base_dir, f))
                except: pass
                
        np.savez(merged_path, **merged_weights)
        logger.info(f"Created merged adapter with {successful_merges} profiles at {merged_path}")
        return merged_path

    def start_training(self, epochs: int = 10):
        """
        Starts the LoRA training process in the background.
        """
        import datetime
        import subprocess
        import sys
        
        # Phase 2: Validate minimum samples
        samples_count = self.get_progress()
        if samples_count < 10:
             return {"success": False, "error": f"Minimum 10 recordings required (Current: {samples_count})"}

        # Check if already training
        status = self.get_training_status()
        if status["status"] == "training":
            return {"success": False, "error": "Already training"}

        # Determine path to training script relative to this file
        current_file_dir = os.path.dirname(os.path.abspath(__file__))
        # src/services/training_service.py -> src/../scripts/mlx/train_lora.py
        project_root = os.path.abspath(os.path.join(current_file_dir, "..", ".."))
        script_path = os.path.join(project_root, "scripts", "mlx", "train_lora.py")
        
        if not os.path.exists(script_path):
             return {"success": False, "error": f"Training script not found at {script_path}"}

        # Prepare log file
        log_path = os.path.join(self.profile_dir, "training.log")
        
        # Update metadata to 'training'
        now = datetime.datetime.now().isoformat()
        self.update_metadata(
            status="training",
            training_started_at=now,
            training_progress=0, # Reset progress
            training_error=None,
            training_log=log_path
        )
        
        # Spawn background process
        # We use uv run to ensure the environment is correct
        try:
            with open(log_path, "w") as log_file:
                subprocess.Popen(
                    ["uv", "run", "python", script_path, "--profile_dir", self.profile_dir, "--epochs", str(epochs)],
                    stdout=log_file,
                    stderr=subprocess.STDOUT,
                    start_new_session=True # Ensure it survives server restart if needed
                )
            return {"success": True, "message": "Training started", "log_path": log_path}
        except Exception as e:
            logger.error(f"Failed to launch training process: {e}")
            self.update_metadata(status="failed", training_error=str(e))
            return {"success": False, "error": str(e)}

    def validate_audio(self, file_path: str) -> dict:
#...
        """
        Basic audio validation.
        Check duration and if it's not silent.
        """
        try:
            audio = AudioSegment.from_file(file_path)
            duration_sec = len(audio) / 1000.0
            dbfs = max(audio.dBFS, -120) if audio.dBFS != float('-inf') else -120
            is_silent = dbfs < -50
            return {
                "valid": duration_sec > 0.5 and not is_silent,
                "duration": duration_sec,
                "dBFS": dbfs
            }
        except Exception:
            # Fallback if ffprobe is missing but file was created by afconvert
            size = os.path.getsize(file_path)
            # 16kHz Mono 16bit is 32000 bytes per second
            duration_est = size / 32000.0
            return {
                "valid": duration_est > 0.5,
                "duration": duration_est,
                "note": "Validated via file size (ffprobe missing)"
            }
