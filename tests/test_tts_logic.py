import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch
from src.core.tts import FineTunedVoicevoxTTS

@pytest.fixture
def tts():
    return FineTunedVoicevoxTTS(
        base_url="http://localhost:50021",
        speaker_id=3,
        settings={"speedScale": 1.1, "pitchScale": 0.05}
    )

@pytest.mark.anyio
async def test_tts_synthesize_success(tts):
    mock_response_query = MagicMock()
    mock_response_query.status_code = 200
    mock_response_query.json.return_value = {"speedScale": 1.0, "pitchScale": 0.0}

    mock_response_synth = MagicMock()
    mock_response_synth.status_code = 200
    mock_response_synth.content = b"fake_audio_data"

    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.post.side_effect = [mock_response_query, mock_response_synth]
    mock_client.is_closed = False

    with patch.object(tts, "_get_client", return_value=mock_client):
        result = await tts.synthesize("こんにちは")

        assert result == b"fake_audio_data"
        assert mock_client.post.call_count == 2

        # Check if settings were applied to second post (synthesis)
        _, kwargs = mock_client.post.call_args_list[1]
        sent_json = kwargs["json"]
        assert sent_json["speedScale"] == 1.1
        assert sent_json["pitchScale"] == 0.05

@pytest.mark.anyio
async def test_tts_synthesize_retry_logic(tts):
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    # Fail 2 times with ConnectError, then success
    mock_client.post.side_effect = [
        httpx.ConnectError("Failed"),
        httpx.ConnectError("Failed"),
        MagicMock(status_code=200, json=lambda: {}), # query success
        MagicMock(status_code=200, content=b"audio") # synth success
    ]
    mock_client.is_closed = False

    with patch.object(tts, "_get_client", return_value=mock_client):
        with patch("asyncio.sleep", return_value=None): # Speed up test
            result = await tts.synthesize("こんにちは")
            assert result == b"audio"
            # 2 fails + 2 success calls = 4 calls total
            assert mock_client.post.call_count == 4

@pytest.mark.anyio
async def test_tts_synthesize_ultimate_failure(tts):
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    # Always fail
    mock_client.post.side_effect = httpx.ConnectError("Down")
    mock_client.is_closed = False

    with patch.object(tts, "_get_client", return_value=mock_client):
        with patch("asyncio.sleep", return_value=None):
            result = await tts.synthesize("こんにちは")
            assert result == b""
            # Attempts: 1(fail), sleep, 2(fail), sleep, 3(fail) -> Done
            assert mock_client.post.call_count == 3
