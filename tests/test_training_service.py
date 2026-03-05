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

def test_update_dataset_adds_line(training_service):
    # Ensure the path is correctly handled relative to base_dir
    audio_path = os.path.join(training_service.wavs_dir, "test.wav")
    phrase = "テスト"
    
    training_service.update_dataset(audio_path, phrase)
    
    jsonl_path = os.path.join(training_service.base_dir, "data.jsonl")
    assert os.path.exists(jsonl_path)
    
    with open(jsonl_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        assert len(lines) == 1
        data = json.loads(lines[0])
        assert data["audio"] == os.path.relpath(audio_path, training_service.base_dir)
        assert data["sentence"] == phrase
