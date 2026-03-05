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
