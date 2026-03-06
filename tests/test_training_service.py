import os
import json
import pytest
from unittest.mock import MagicMock
from src.services.training_service import TrainingService

from unittest.mock import patch, MagicMock

@pytest.fixture
def training_service(tmp_path):
    # Mocking the base directory for training data
    data_dir = tmp_path / "training_data"
    data_dir.mkdir()
    (data_dir / "wavs").mkdir()
    
    service = TrainingService(base_dir=str(data_dir))
    return service

@patch("src.services.training_service.AudioSegment")
def test_save_audio_creates_file(mock_audio_segment, training_service):
    # Setup mock
    mock_instance = MagicMock()
    mock_audio_segment.from_file.return_value = mock_instance
    mock_instance.set_frame_rate.return_value = mock_instance
    mock_instance.set_channels.return_value = mock_instance
    mock_instance.normalize.return_value = mock_instance
    
    dummy_audio = b"dummy audio content"
    phrase = "今の反確、逃さなかったね！"
    
    file_path = training_service.save_audio(dummy_audio, phrase)
    
    # Check if export was called
    mock_instance.export.assert_called_once()
    assert file_path.endswith(".wav")
    # Actually wait, save_audio in my implementation returns the path it *intended* to save to.
    # In the real code, export() creates the file. Since it's mocked, the file won't exist.
    # I should check if the path is correct.
    assert "training_data/wavs" in file_path

def test_get_progress_counts_lines(training_service):
    training_service.update_dataset("test1.wav", "Phrase 1")
    training_service.update_dataset("test2.wav", "Phrase 2")
    assert training_service.get_progress() == 2

def test_training_task_management(training_service):
    # Initial status
    status = training_service.get_training_status()
    assert status["status"] == "idle"
    
    # Add files for progress (need 10 to pass the check)
    for i in range(10):
        training_service.update_dataset(f"test{i}.wav", f"Phrase {i}")
    
    # Start training
    result = training_service.start_training()
    assert result["success"] is True
    
    # Status should be training
    status = training_service.get_training_status()
    assert status["status"] == "training"
    assert "started_at" in status
    
    # After some time or manual completion check (for prototype)
    # We can't easily test the background process completion without async/await or wait.
    # But we can at least check if metadata was updated.
    metadata = training_service.get_metadata()
    assert metadata["status"] == "training"

def test_reset_training(training_service):
    # Set to completed first
    training_service.update_metadata(status="completed")
    
    # Create a dummy adapter file
    adapter_path = os.path.join(training_service.profile_dir, "adapters.npz")
    with open(adapter_path, "w") as f:
        f.write("dummy adapter")
    
    assert os.path.exists(adapter_path)
    
    # Reset
    training_service.reset_training()
    
    # Check metadata
    assert training_service.get_training_status()["status"] == "idle"
    # Check file deleted
    assert not os.path.exists(adapter_path)

def test_get_active_adapter_path(training_service):
    # Missing file -> None
    assert training_service.get_active_adapter() is None
    
    # Existing file -> Path
    adapter_path = os.path.join(training_service.profile_dir, "adapters.npz")
    with open(adapter_path, "w") as f:
        f.write("dummy adapter")
    
    assert training_service.get_active_adapter() == adapter_path

def test_merge_adapters(training_service, tmp_path):
    import numpy as np
    # Create two profiles with dummy adapters
    p1_dir = tmp_path / "training_data" / "profiles" / "p1"
    p2_dir = tmp_path / "training_data" / "profiles" / "p2"
    p1_dir.mkdir(parents=True)
    p2_dir.mkdir(parents=True)
    
    # Save dummy .npz with weights
    w1 = {"lora_A": np.array([1.0, 1.0], dtype=np.float32)}
    w2 = {"lora_A": np.array([2.0, 2.0], dtype=np.float32)}
    
    np.savez(p1_dir / "adapters.npz", **w1)
    np.savez(p2_dir / "adapters.npz", **w2)
    
    # Merge p1=1.0, p2=0.5
    # Result should be 1.0 + 2.0*0.5 = 2.0
    profile_alphas = [
        {"id": "p1", "alpha": 1.0},
        {"id": "p2", "alpha": 0.5}
    ]
    
    merged_path = training_service.merge_adapters(profile_alphas)
    assert merged_path is not None
    assert os.path.exists(merged_path)
    
    # Load and check values
    merged_w = np.load(merged_path)
    assert "lora_A" in merged_w.files
    np.testing.assert_array_almost_equal(merged_w["lora_A"], np.array([2.0, 2.0], dtype=np.float32))
    
    # Cleanup (not strictly necessary for tmp_path but good practice)
    os.remove(merged_path)
