import pytest
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
from src.core.local_llm import LocalLLMService

@pytest.fixture
def mock_mlx():
    mock_model = MagicMock()
    mock_tokenizer = MagicMock()
    mock_tokenizer.apply_chat_template.return_value = "formatted_prompt"

    # Mock GenerationResponse object
    mock_resp1 = MagicMock()
    mock_resp1.text = "Hello"
    mock_resp2 = MagicMock()
    mock_resp2.text = " world"

    with patch("src.core.local_llm.LocalLLMService._load_model", return_value=(mock_model, mock_tokenizer)) as mock_load, \
         patch("mlx_lm.generate.stream_generate") as mock_stream:

        # Mock stream_generate yields GenerationResponse objects
        mock_stream.return_value = iter([mock_resp1, mock_resp2])

        yield mock_load, mock_stream, mock_model, mock_tokenizer

@pytest.mark.asyncio
async def test_local_llm_service_inference(mock_mlx):
    mock_load, mock_stream, mock_model, mock_tokenizer = mock_mlx
    
    mock_cm = MagicMock()
    mock_cm.get_histories = AsyncMock(return_value=[])
    service = LocalLLMService(model="test_model", system_prompt="you are a help elf", context_manager=mock_cm)
    
    # Test streaming response
    responses = []
    async for chunk in service.get_llm_stream_response("ctx", "user", [{"role": "user", "content": "hi"}], None, None):
        responses.append(chunk)
    
    # Should have 2 chunks of text
    text_chunks = [r.text for r in responses if hasattr(r, 'text')]
    assert text_chunks == ["Hello", " world"]
    
    # Verify _load_model was called
    mock_load.assert_called_once()
    
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

def test_detect_model_family_gemma4():
    assert LocalLLMService._detect_model_family("mlx-community/gemma-4-e4b-it-4bit") == "gemma4"
    assert LocalLLMService._detect_model_family("mlx-community/gemma4-e2b-it-4bit") == "gemma4"

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
async def test_compose_messages_gemma4_uses_system_role():
    """Gemma 4 は system role をネイティブサポート。system_content が {"role": "system"} として先頭に入ること。"""
    mock_cm = MagicMock()
    mock_cm.get_histories = AsyncMock(return_value=[])

    service = LocalLLMService(
        model="mlx-community/gemma-4-e4b-it-4bit",
        system_prompt="You are a helpful AI.",
        context_manager=mock_cm
    )
    messages = await service.compose_messages("ctx", "user1", "こんにちは")

    assert messages[0]["role"] == "system"
    assert "You are a helpful AI." in messages[0]["content"]
    assert messages[1]["role"] == "user"
    assert messages[1]["content"] == "こんにちは"

@pytest.mark.asyncio
async def test_update_context_gemma4_uses_model_role():
    """Gemma 4 では context に "model" ロールで保存されること。"""
    mock_cm = MagicMock()
    mock_cm.add_histories = AsyncMock()
    mock_cm.get_histories = AsyncMock(return_value=[])

    service = LocalLLMService(
        model="mlx-community/gemma-4-e4b-it-4bit",
        system_prompt="test",
        context_manager=mock_cm
    )
    messages = [{"role": "user", "content": "hi"}]
    await service.update_context("ctx", "user1", messages, "hello!")

    call_args = mock_cm.add_histories.call_args
    saved_messages = call_args[0][1]
    assert saved_messages[-1]["role"] == "model"

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
    mock_cm.get_histories = AsyncMock(return_value=[])

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

def _make_gemma4_service(mock_mlx, tokens: list[str]):
    """Helper: create a Gemma 4 service with the given mock stream tokens."""
    mock_load, mock_stream, _, mock_tokenizer = mock_mlx
    mock_tokenizer.apply_chat_template.return_value = "prompt"
    resps = [MagicMock(text=t) for t in tokens]
    mock_stream.return_value = iter(resps)
    mock_cm = MagicMock()
    mock_cm.get_histories = AsyncMock(return_value=[])
    return LocalLLMService(
        model="mlx-community/gemma-4-e4b-it-4bit",
        system_prompt="test",
        context_manager=mock_cm,
    )


@pytest.mark.asyncio
async def test_gemma4_thinking_block_is_stripped(mock_mlx):
    """Gemma 4 の <channel>thought....<channel|> ブロックが TTS に流れないこと。"""
    tokens = [
        "<channel>thought",
        "\nI am thinking hard about this.",
        "\n<channel|>",  # end of thinking
        "実際の返答だよ",
    ]
    service = _make_gemma4_service(mock_mlx, tokens)

    results = []
    async for chunk in service.get_llm_stream_response("ctx", "user", [{"role": "user", "content": "hi"}], None, None):
        results.append(chunk.text)

    full = "".join(results)
    assert "thinking" not in full
    assert "実際の返答だよ" in full


@pytest.mark.asyncio
async def test_gemma4_no_thinking_block_streams_normally(mock_mlx):
    """Gemma 4 でも thinking なし応答はそのまま流れること。"""
    tokens = ["こんにちは", "！"]
    service = _make_gemma4_service(mock_mlx, tokens)

    results = []
    async for chunk in service.get_llm_stream_response("ctx", "user", [{"role": "user", "content": "hi"}], None, None):
        results.append(chunk.text)

    assert "こんにちは" in "".join(results)


@pytest.mark.asyncio
async def test_gemma4_min_tokens_boost(mock_mlx):
    """Gemma 4 は max_tokens が _G4_MIN_TOKENS 未満の場合に自動引き上げされること。"""
    mock_load, mock_stream, _, mock_tokenizer = mock_mlx
    mock_tokenizer.apply_chat_template.return_value = "prompt"
    mock_stream.return_value = iter([MagicMock(text="ok")])
    mock_cm = MagicMock()
    mock_cm.get_histories = AsyncMock(return_value=[])

    service = LocalLLMService(
        model="mlx-community/gemma-4-e4b-it-4bit",
        system_prompt="test",
        context_manager=mock_cm,
        max_tokens=50,  # below _G4_MIN_TOKENS
    )
    async for _ in service.get_llm_stream_response("ctx", "user", [{"role": "user", "content": "hi"}]):
        pass

    _, call_kwargs = mock_stream.call_args
    assert call_kwargs["max_tokens"] >= LocalLLMService._G4_MIN_TOKENS


@pytest.mark.asyncio
async def test_gemma4_thinking_tag_split_across_tokens(mock_mlx):
    """thinking タグがトークン境界をまたいでも正しく除去されること。"""
    # <channel>thought が 2 トークンに分割されるケース
    tokens_split_open = [
        "<channel>th",    # open tag split
        "ought\nreasoning\n<channel|>",
        "返答！",
    ]
    service_open = _make_gemma4_service(mock_mlx, tokens_split_open)
    results = []
    async for chunk in service_open.get_llm_stream_response("ctx", "user", [{"role": "user", "content": "hi"}]):
        results.append(chunk.text)
    full = "".join(results)
    assert "reasoning" not in full
    assert "返答！" in full

    # <channel|> 終了タグが 2 トークンに分割されるケース
    tokens_split_close = [
        "<channel>thought\nreasoning\n<ch",  # close tag split
        "annel|>返答B",
    ]
    service_close = _make_gemma4_service(mock_mlx, tokens_split_close)
    results2 = []
    async for chunk in service_close.get_llm_stream_response("ctx", "user", [{"role": "user", "content": "hi"}]):
        results2.append(chunk.text)
    full2 = "".join(results2)
    assert "reasoning" not in full2
    assert "返答B" in full2


@pytest.mark.asyncio
async def test_gemma4_multiple_thinking_blocks_stripped(mock_mlx):
    """thinking ブロックが複数連続しても全て除去されること。"""
    tokens = [
        "<channel>thought\nblock1\n<channel|>",
        "中間テキスト",
        "<channel>thought\nblock2\n<channel|>",
        "最終返答",
    ]
    service = _make_gemma4_service(mock_mlx, tokens)
    results = []
    async for chunk in service.get_llm_stream_response("ctx", "user", [{"role": "user", "content": "hi"}]):
        results.append(chunk.text)
    full = "".join(results)
    assert "block1" not in full
    assert "block2" not in full
    assert "中間テキスト" in full
    assert "最終返答" in full


@pytest.mark.asyncio
async def test_compose_messages_gemma_trims_leading_assistant_history():
    """Gemma 2 は履歴が assistant から始まる場合に先頭を user まで削る。"""
    mock_cm = MagicMock()
    mock_cm.get_histories = AsyncMock(return_value=[
        {"role": "model", "content": "old assistant turn"},
        {"role": "user", "content": "previous user turn"},
        {"role": "model", "content": "previous assistant turn"},
    ])
    service = LocalLLMService(
        model="mlx-community/gemma-2-9b-it-4bit",
        system_prompt="sys",
        context_manager=mock_cm,
    )
    messages = await service.compose_messages("ctx", "user1", "新しい質問")

    # 先頭は必ず user ロールになること（model ロール先頭は除去）
    assert messages[0]["role"] == "user"
    assert "新しい質問" in messages[-1]["content"]


@pytest.mark.asyncio
async def test_local_llm_service_cache_behavior():
    """_load_model caches the model for the same path and reloads for a different path."""
    mock_model = MagicMock()
    mock_tokenizer = MagicMock()
    mock_config = MagicMock()
    mock_config.get.return_value = None

    with patch("mlx_lm.utils.load_model", return_value=(mock_model, mock_config)) as mock_lm, \
         patch("mlx_lm.utils.load_tokenizer", return_value=mock_tokenizer), \
         patch("mlx_lm.utils._download", side_effect=lambda p: p):
        # Reset class-level cache before test
        LocalLLMService._model = None
        LocalLLMService._current_model_path = None
        LocalLLMService._current_adapter_path = None

        # First call loads model_a
        LocalLLMService._load_model("model_a", None)
        assert mock_lm.call_count == 1

        # Second call with same model name uses cache
        LocalLLMService._load_model("model_a", None)
        assert mock_lm.call_count == 1

        # Call with different model name triggers reload
        LocalLLMService._load_model("model_b", None)
        assert mock_lm.call_count == 2

        # Reset cache after test
        LocalLLMService._model = None
        LocalLLMService._current_model_path = None
        LocalLLMService._current_adapter_path = None
