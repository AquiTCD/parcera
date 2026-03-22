import pytest
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
from src.core.local_llm import LocalLLMService

@pytest.fixture
def mock_mlx():
    with patch("mlx_lm.load") as mock_load, \
         patch("mlx_lm.generate.stream_generate") as mock_stream:
        
        mock_model = MagicMock()
        mock_tokenizer = MagicMock()
        mock_tokenizer.apply_chat_template.return_value = "formatted_prompt"
        
        mock_load.return_value = (mock_model, mock_tokenizer)
        
        # Mock GenerationResponse object
        mock_resp1 = MagicMock()
        mock_resp1.text = "Hello"
        mock_resp2 = MagicMock()
        mock_resp2.text = " world"
        
        # Mock stream_generate yields GenerationResponse objects
        mock_stream.return_value = iter([mock_resp1, mock_resp2])
        
        yield mock_load, mock_stream, mock_model, mock_tokenizer

@pytest.mark.asyncio
async def test_local_llm_service_inference(mock_mlx):
    mock_load, mock_stream, mock_model, mock_tokenizer = mock_mlx
    
    # Mock context manager to avoid DB issues
    mock_cm = MagicMock()
    mock_cm.get_context = AsyncMock(return_value=[])
    
    service = LocalLLMService(model="test_model", system_prompt="you are a help elf", context_manager=mock_cm)
    
    # Test streaming response
    responses = []
    async for chunk in service.get_llm_stream_response("ctx", "user", [{"role": "user", "content": "hi"}], None, None):
        responses.append(chunk)
    
    # Should have 2 chunks of text
    text_chunks = [r.text for r in responses if hasattr(r, 'text')]
    assert text_chunks == ["Hello", " world"]
    
    # Verify model loading
    mock_load.assert_called_once_with("test_model", adapter_path=None)
    
    # Verify prompt formatting
    mock_tokenizer.apply_chat_template.assert_called_once()
    
    # Verify stream_generate calls
    assert mock_stream.call_count == 1

def test_detect_model_family_qwen():
    assert LocalLLMService._detect_model_family("mlx-community/Qwen3.5-9B-MLX-4bit") == "qwen"
    assert LocalLLMService._detect_model_family("Qwen/Qwen3.5-4B") == "qwen"

def test_detect_model_family_gemma():
    assert LocalLLMService._detect_model_family("mlx-community/gemma-2-9b-it-4bit") == "gemma"
    assert LocalLLMService._detect_model_family("google/gemma-2-2b-it") == "gemma"

def test_detect_model_family_unknown():
    assert LocalLLMService._detect_model_family("some-other-model/llama-3") == "unknown"

@pytest.mark.asyncio
async def test_compose_messages_qwen_uses_system_role():
    """Qwen は system role を正式サポート。system_content が {"role": "system"} として先頭に入ること。"""
    mock_cm = MagicMock()
    mock_cm.get_histories = AsyncMock(return_value=[])

    service = LocalLLMService(
        model="mlx-community/Qwen3.5-9B-MLX-4bit",
        system_prompt="You are a helpful AI.",
        context_manager=mock_cm
    )
    messages = await service.compose_messages("ctx", "user1", "こんにちは")

    assert messages[0]["role"] == "system"
    assert "You are a helpful AI." in messages[0]["content"]
    assert messages[1]["role"] == "user"
    assert messages[1]["content"] == "こんにちは"

@pytest.mark.asyncio
async def test_compose_messages_gemma_embeds_system_in_user():
    """Gemma は system role 非サポート。system_content が user メッセージに埋め込まれること。"""
    mock_cm = MagicMock()
    mock_cm.get_histories = AsyncMock(return_value=[])

    service = LocalLLMService(
        model="mlx-community/gemma-2-9b-it-4bit",
        system_prompt="You are a helpful AI.",
        context_manager=mock_cm
    )
    messages = await service.compose_messages("ctx", "user1", "こんにちは")

    assert messages[0]["role"] == "user"
    assert "You are a helpful AI." in messages[0]["content"]
    assert "こんにちは" in messages[0]["content"]

@pytest.mark.asyncio
async def test_update_context_qwen_uses_assistant_role():
    """Qwen では context に "assistant" ロールで保存されること。"""
    mock_cm = MagicMock()
    mock_cm.add_histories = AsyncMock()
    mock_cm.get_histories = AsyncMock(return_value=[])

    service = LocalLLMService(
        model="mlx-community/Qwen3.5-9B-MLX-4bit",
        system_prompt="test",
        context_manager=mock_cm
    )
    messages = [{"role": "user", "content": "hi"}]
    await service.update_context("ctx", "user1", messages, "hello!")

    call_args = mock_cm.add_histories.call_args
    saved_messages = call_args[0][1]
    assert saved_messages[-1]["role"] == "assistant"

@pytest.mark.asyncio
async def test_update_context_gemma_uses_model_role():
    """Gemma では context に "model" ロールで保存されること。"""
    mock_cm = MagicMock()
    mock_cm.add_histories = AsyncMock()
    mock_cm.get_histories = AsyncMock(return_value=[])

    service = LocalLLMService(
        model="mlx-community/gemma-2-9b-it-4bit",
        system_prompt="test",
        context_manager=mock_cm
    )
    messages = [{"role": "user", "content": "hi"}]
    await service.update_context("ctx", "user1", messages, "hello!")

    call_args = mock_cm.add_histories.call_args
    saved_messages = call_args[0][1]
    assert saved_messages[-1]["role"] == "model"

@pytest.mark.asyncio
async def test_qwen_special_tags_are_filtered(mock_mlx):
    """Qwen の特殊タグ (<|im_end|>, <think> 等) がストリームから除去されること。"""
    mock_load, mock_stream, mock_model, mock_tokenizer = mock_mlx

    mock_resp1 = MagicMock(); mock_resp1.text = "こんにちは"
    mock_resp2 = MagicMock(); mock_resp2.text = "<|im_end|>"
    mock_resp3 = MagicMock(); mock_resp3.text = "<think>考え中</think>"
    mock_stream.return_value = iter([mock_resp1, mock_resp2, mock_resp3])

    mock_cm = MagicMock()
    mock_cm.get_context = AsyncMock(return_value=[])

    service = LocalLLMService(
        model="mlx-community/Qwen3.5-9B-MLX-4bit",
        system_prompt="test",
        context_manager=mock_cm
    )

    responses = []
    async for chunk in service.get_llm_stream_response("ctx", "user", [{"role": "user", "content": "hi"}], None, None):
        responses.append(chunk.text)

    full_text = "".join(responses)
    assert "<|im_end|>" not in full_text
    assert "<think>" not in full_text
    assert "</think>" not in full_text
    assert "こんにちは" in full_text

@pytest.mark.asyncio
async def test_local_llm_service_cache_behavior(mock_mlx):
    mock_load, _, _, _ = mock_mlx
    
    mock_cm = MagicMock()
    mock_cm.get_context = AsyncMock(return_value=[])
    
    service = LocalLLMService(model="model_a", system_prompt="test", context_manager=mock_cm)
    
    # First call loads model_a
    service._load_model("model_a", None)
    assert mock_load.call_count == 1
    
    # Second call with same model name uses cache
    service._load_model("model_a", None)
    assert mock_load.call_count == 1
    
    # Call with different model name triggers reload
    service._load_model("model_b", None)
    assert mock_load.call_count == 2
