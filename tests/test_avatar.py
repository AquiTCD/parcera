import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from src.core.avatar import ParceraAvatarBase

@pytest.fixture
def mock_avatar():
    with patch("src.core.avatar.ParceraConfig") as MockConfig:
        with patch("src.core.avatar.ParceraComponentFactory") as MockFactory:
            with patch("os.path.exists", return_value=False):
                avatar = ParceraAvatarBase()
                return avatar

def test_avatar_initialization(mock_avatar):
    assert mock_avatar.llm is not None
    assert mock_avatar.stt is not None
    assert mock_avatar.tts is not None
    assert mock_avatar.vad is not None

def test_set_busy(mock_avatar):
    session_id = "session123"
    assert mock_avatar._is_ai_busy_check(session_id) is False

    mock_avatar.set_busy(session_id, True)
    assert mock_avatar._is_ai_busy_check(session_id) is True

    mock_avatar.set_busy(session_id, False)
    assert mock_avatar._is_ai_busy_check(session_id) is False

def test_is_busy_with_source(mock_avatar):
    # Test overall busy
    mock_avatar.set_busy("user1", True, source="user")
    assert mock_avatar.is_busy() is True
    assert mock_avatar.is_busy(source="user") is True
    assert mock_avatar.is_busy(source="twitch") is False

    # Test multiple sources
    mock_avatar.set_busy("twitch1", True, source="twitch")
    assert mock_avatar.is_busy(source="user") is True
    assert mock_avatar.is_busy(source="twitch") is True

    # Clear user, should only remain twitch
    mock_avatar.set_busy("user1", False)
    assert mock_avatar.is_busy(source="user") is False
    assert mock_avatar.is_busy(source="twitch") is True

@pytest.mark.anyio
async def test_warmup_calls_components():
    # We need a real-ish instance but with mocked components
    with patch("src.core.avatar.ParceraConfig"):
        with patch("src.core.avatar.ParceraComponentFactory") as MockFactory:
            factory = MockFactory.return_value
            mock_llm = MagicMock()
            mock_llm.warmup = AsyncMock()
            factory.build_llm.return_value = mock_llm

            mock_tts = MagicMock()
            mock_tts.synthesize = AsyncMock()
            factory.build_tts.return_value = mock_tts

            with patch("os.path.exists", return_value=False):
                avatar = ParceraAvatarBase()
                await avatar.warmup()

                mock_llm.warmup.assert_called_once()
                mock_tts.synthesize.assert_called_with("。")

@pytest.mark.anyio
async def test_cleanup_calls_tts_close():
    with patch("src.core.avatar.ParceraConfig"):
        with patch("src.core.avatar.ParceraComponentFactory") as MockFactory:
            factory = MockFactory.return_value
            mock_tts = MagicMock()
            mock_tts.close = AsyncMock()
            factory.build_tts.return_value = mock_tts

            with patch("os.path.exists", return_value=False):
                avatar = ParceraAvatarBase()
                await avatar.cleanup()
                mock_tts.close.assert_called_once()
