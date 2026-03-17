import pytest
from unittest.mock import AsyncMock, MagicMock
from src.services.training_service import TrainingService

@pytest.fixture
def mock_config():
    config = MagicMock()
    config.app_data_dir = "/tmp/parcera_test"
    return config

@pytest.fixture
def mock_gemini():
    gemini = AsyncMock()
    # Mocking the teacher's response
    gemini.generate.return_value = '[{"question": "スト6のエドってどんな感じ？", "response": "エドちゃん？トリッキーでマジかっこよくない！？ウチ、あのフリッカーのリーチにビビるんだけどw"}]'
    return gemini
@pytest.fixture(autouse=True)
def clean_db(mock_config):
    import os
    if not os.path.exists(mock_config.app_data_dir):
        os.makedirs(mock_config.app_data_dir)
    db_path = os.path.join(mock_config.app_data_dir, "training.db")
    if os.path.exists(db_path):
        os.remove(db_path)
    yield
    if os.path.exists(db_path):
        os.remove(db_path)

@pytest.mark.asyncio
async def test_add_knowledge_text(mock_config, mock_gemini):
    service = TrainingService(mock_config, teacher_llm=mock_gemini)
    
    # Test adding text knowledge
    knowledge = "スト6のエドはリーチの長いフリッカーが特徴のキャラクターです。"
    await service.add_knowledge_from_text(knowledge)
    
    # Verify gemini was called
    mock_gemini.generate.assert_called()
    
    # Verify pairs were saved to DB
    pairs = await service.get_pairs()
    assert len(pairs) > 0
    assert pairs[0]["input"] == "スト6のエドってどんな感じ？"
    assert "エドちゃん" in pairs[0]["output"]
    assert pairs[0]["status"] == "pending"

@pytest.mark.asyncio
async def test_update_pair_status(mock_config, mock_gemini):
    service = TrainingService(mock_config, teacher_llm=mock_gemini)
    await service.add_knowledge_from_text("Dummy")
    
    pairs = await service.get_pairs()
    pair_id = pairs[0]["id"]
    
    await service.update_pair(pair_id, status="ok")
    
    updated_pairs = await service.get_pairs()
    assert updated_pairs[0]["status"] == "ok"
@pytest.mark.asyncio
async def test_profile_isolation(mock_config, mock_gemini):
    service = TrainingService(mock_config, teacher_llm=mock_gemini)
    
    # Add to default profile
    await service.add_knowledge_from_text("Default knowledge", profile="default")
    # Add to specific profile
    mock_gemini.generate.return_value = '[{"question": "SF6?", "response": "Cool!"}]'
    await service.add_knowledge_from_text("SF6 knowledge", profile="sf6")
    
    # Check default
    default_pairs = await service.get_pairs(profile="default")
    assert len(default_pairs) == 1
    
    # Check sf6
    sf6_pairs = await service.get_pairs(profile="sf6")
    assert len(sf6_pairs) == 1
    assert sf6_pairs[0]["input"] == "SF6?"
    
    # Check non-existent
    empty_pairs = await service.get_pairs(profile="non-existent")
    assert len(empty_pairs) == 0
@pytest.mark.asyncio
async def test_dynamic_prompt_generation(mock_config, mock_gemini):
    # Setup mock config to return specific character settings
    def mock_get(key, default=None):
        settings = {
            "ai_profile": {"name": "TestAI", "personality": "Cheerful"},
            "user_profile": {"calling": "Master"}
        }
        return settings.get(key, default)
    
    mock_config.get.side_effect = mock_get
    
    service = TrainingService(mock_config, teacher_llm=mock_gemini)
    await service.add_knowledge_from_text("Dynamic Prompt Test")
    
    # Check if the prompt sent to teacher_llm contains the dynamic values
    call_args = mock_gemini.generate.call_args[0][0]
    assert "TestAI" in call_args
    assert "Cheerful" in call_args
    assert "Master" in call_args
@pytest.mark.asyncio
async def test_calculate_merge_weights(mock_config):
    service = TrainingService(mock_config)
    
    # Case 1: Total weight <= 1.2, no scaling
    configs = [
        {"name": "A", "weight": 0.5, "is_main": False},
        {"name": "B", "weight": 0.5, "is_main": False}
    ]
    weights = service._calculate_merge_weights(configs)
    assert weights["A"] == 0.5
    assert weights["B"] == 0.5
    
    # Case 2: Total weight > 1.2, no main, all scale equally
    configs = [
        {"name": "A", "weight": 1.0, "is_main": False},
        {"name": "B", "weight": 1.0, "is_main": False}
    ]
    weights = service._calculate_merge_weights(configs)
    # Total 2.0 -> scaled to 1.2 sum -> 0.6 each
    assert weights["A"] == pytest.approx(0.6)
    assert weights["B"] == pytest.approx(0.6)
    
    # Case 3: Total weight > 1.2, has main. 
    # Logic: Target 1.2. Main stays strong (max 0.8), others shared.
    configs = [
        {"name": "Main", "weight": 1.0, "is_main": True},
        {"name": "Exp1", "weight": 0.5, "is_main": False},
        {"name": "Exp2", "weight": 0.5, "is_main": False}
    ]
    # Current behavior desired by user: "Main can drop to 0.8" 
    # If total is 2.0.
    weights = service._calculate_merge_weights(configs)
    assert weights["Main"] == pytest.approx(0.8)
    assert weights["Exp1"] == pytest.approx(0.2)
    assert weights["Exp2"] == pytest.approx(0.2)
    
    # Case 4: Main is set to 0.5, total still safe
    configs = [
        {"name": "Main", "weight": 0.5, "is_main": True},
        {"name": "Exp1", "weight": 0.3, "is_main": False}
    ]
    weights = service._calculate_merge_weights(configs)
    assert weights["Main"] == 0.5
    assert weights["Exp1"] == 0.3
