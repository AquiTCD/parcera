import mlx.core as mx
import mlx.nn as nn
import mlx.optimizers as optim
from mlx.utils import tree_flatten, tree_unflatten
import json
import os
import argparse
import datetime
import librosa
import numpy as np
import time

class STTLoRAWrapper(nn.Module):
    """
    A more realistic mock of a LoRA-enabled adapter for STT adaptive learning.
    In a real MLX implementation, this would wrap the Transformer layers
    of the Moonshine model.
    """
    def __init__(self, input_dim=80, hidden_dim=512, output_dim=1024):
        super().__init__()
        # Encoder simulation
        self.encoder = [
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim)
        ]
        # LoRA-like layers to train
        self.lora_a = nn.Linear(hidden_dim, 16, bias=False)
        self.lora_b = nn.Linear(16, output_dim, bias=False)
        
        # Scaling factor
        self.scale = 0.1

    def __call__(self, x):
        # x: (batch, time, input_dim)
        for layer in self.encoder:
            x = layer(x)
        
        # x: (batch, time, hidden_dim)
        adapter_output = self.lora_b(self.lora_a(x))
        return adapter_output * self.scale

def load_dataset(jsonl_path, profile_dir):
    data = []
    if not os.path.exists(jsonl_path):
        return []
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            try:
                entry = json.loads(line)
                audio_path = os.path.join(profile_dir, entry["audio"])
                if os.path.exists(audio_path):
                    data.append((audio_path, entry["sentence"]))
            except Exception:
                continue
    return data

def preprocess_audio(audio_path, n_mels=80):
    y, sr = librosa.load(audio_path, sr=16000)
    # Extract log-mel-spectrogram
    mel = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=n_mels)
    log_mel = librosa.power_to_db(mel, ref=np.max)
    log_mel = (log_mel + 80) / 80 # Normalize to ~ [0, 1]
    return mx.array(log_mel.T) # (time, n_mels)

def loss_fn(model, x, target_text_len):
    # Simulated loss: we want the adapter to produce high variance for non-silence
    # In reality, this would be CTC loss against target_ids
    output = model(x)
    return mx.mean(output ** 2) / (target_text_len + 1e-6)

def train(profile_dir, epochs=20):
    metadata_path = os.path.join(profile_dir, "metadata.json")
    jsonl_path = os.path.join(profile_dir, "data.jsonl")
    adapter_path = os.path.join(profile_dir, "adapters.npz")

    def update_metadata(progress, status="training", loss=None, error=None):
        if not os.path.exists(metadata_path):
            return
        try:
            with open(metadata_path, "r") as f:
                meta = json.load(f)
            
            meta["training_progress"] = progress
            meta["status"] = status
            
            if loss is not None:
                meta["last_loss"] = float(loss)
                if "loss_history" not in meta:
                    meta["loss_history"] = []
                meta["loss_history"].append(float(loss))
            
            if error:
                meta["training_error"] = error
                
            if status == "completed":
                meta["is_trained"] = True
                meta["last_trained_at"] = datetime.datetime.now().isoformat()
                meta["active_adapter"] = "adapters.npz"
            
            with open(metadata_path, "w") as f:
                json.dump(meta, f, indent=2)
        except Exception as e:
            print(f"Failed to update metadata: {e}")

    print(f"--- MLX Fine-tuning Started: {os.path.basename(profile_dir)} ---")
    data = load_dataset(jsonl_path, profile_dir)
    
    if not data:
        update_metadata(0, status="failed", error="No training data found in data.jsonl")
        return

    # Initialize model and optimizer
    model = STTLoRAWrapper()
    mx.eval(model.parameters())
    
    optimizer = optim.Adam(learning_rate=5e-4) # Slightly lower lr for adaptation
    loss_and_grad = nn.value_and_grad(model, loss_fn)

    start_time = time.time()
    
    for epoch in range(epochs):
        epoch_loss = 0
        samples_processed = 0
        
        for audio_p, text in data:
            try:
                x = preprocess_audio(audio_p)[None] # Add batch dim
                text_len = len(text)
                
                loss, grads = loss_and_grad(model, x, text_len)
                optimizer.update(model, grads)
                mx.eval(model.parameters(), optimizer.state)
                
                epoch_loss += loss.item()
                samples_processed += 1
            except Exception as e:
                print(f"Error processing {audio_p}: {e}")

        avg_loss = epoch_loss / samples_processed if samples_processed > 0 else 0
        progress = int(((epoch + 1) / epochs) * 100)
        
        print(f"Epoch {epoch+1}/{epochs} | Loss: {avg_loss:.6f} | Progress: {progress}%")
        update_metadata(progress, loss=avg_loss)
        
        # Simulated delay to make progress visible in UI for small datasets
        # and to simulate actual heavy computation
        time.sleep(0.5)

    # Save the adapter
    weights = dict(tree_flatten(model.parameters()))
    # In Phase 2/3 we might move to .safetensors, but Moonshine currently loads .npz
    mx.savez(adapter_path, **weights)
    
    total_time = time.time() - start_time
    print(f"--- Training Complete in {total_time:.1f}s | Saved to {adapter_path} ---")
    update_metadata(100, status="completed")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile_dir", required=True)
    parser.add_argument("--epochs", type=int, default=10)
    args = parser.parse_args()
    
    try:
        train(args.profile_dir, args.epochs)
    except Exception as e:
        print(f"FATAL: Training aborted due to error: {e}")
        # We need a profile_dir to update metadata
        if hasattr(args, 'profile_dir'):
            # Lazy update attempt
            metadata_path = os.path.join(args.profile_dir, "metadata.json")
            if os.path.exists(metadata_path):
                with open(metadata_path, "r") as f: meta = json.load(f)
                meta["status"] = "failed"
                meta["training_error"] = str(e)
                with open(metadata_path, "w") as f: json.dump(meta, f, indent=2)
