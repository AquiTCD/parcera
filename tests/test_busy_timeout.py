import pytest
import asyncio
from unittest.mock import patch, MagicMock
from src.core.avatar import ParceraAvatarBase

@pytest.fixture
def avatar():
    with patch("src.core.avatar.ParceraConfig"):
        with patch("src.core.avatar.ParceraComponentFactory"):
            with patch("os.path.exists", return_value=False):
                return ParceraAvatarBase()

@pytest.mark.anyio
async def test_set_busy_timeout(avatar):
    session_id = "test_session"

    # 1. Set busy with short timeout
    avatar.set_busy(session_id, True, timeout=0.1)
    assert avatar._is_ai_busy_check(session_id) is True

    # 2. Wait for timeout
    await asyncio.sleep(0.2)

    # 3. Check if automatically cleared
    assert avatar._is_ai_busy_check(session_id) is False

@pytest.mark.anyio
async def test_set_busy_manual_clear_cancels_timer(avatar):
    session_id = "test_session"

    # 1. Set busy
    avatar.set_busy(session_id, True, timeout=1.0)
    assert session_id in avatar._busy_sessions

    # 2. Manual clear
    avatar.set_busy(session_id, False)
    assert avatar._is_ai_busy_check(session_id) is False
    assert session_id not in avatar._busy_sessions
