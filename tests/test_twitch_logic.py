import pytest
from unittest.mock import AsyncMock, MagicMock, patch, ANY
from fastapi.testclient import TestClient

# Mock components before importing app to avoid unwanted initialization
with patch("src.core.avatar.ParceraComponentFactory"):
    from src.run_server import app, parcera_server

@pytest.fixture
def client():
    return TestClient(app)

@pytest.mark.anyio
async def test_twitch_client_initialization():
    from core.twitch_client import TwitchClient

    mock_twitch_instance = AsyncMock()
    mock_twitch_instance.set_user_authentication = AsyncMock()
    mock_twitch_instance.close = AsyncMock()

    # Twitch() is awaited in v4, so we need MockTwitch to be awaitable
    mock_twitch_constructor = AsyncMock(return_value=mock_twitch_instance)

    with patch("core.twitch_client.Twitch", new=mock_twitch_constructor):
        client = TwitchClient("test_id", "test_secret")
        success = await client.initialize("access_token", "refresh_token")

        assert success is True
        assert client.access_token == "access_token"
        assert client.refresh_token == "refresh_token"
        mock_twitch_instance.set_user_authentication.assert_called_once()

@pytest.mark.anyio
async def test_twitch_client_refresh_callback():
    from core.twitch_client import TwitchClient

    refresh_callback = AsyncMock()
    client = TwitchClient("test_id", "test_secret", callback_on_refresh=refresh_callback)

    await client._on_token_refresh("new_access", "new_refresh")

    assert client.access_token == "new_access"
    assert client.refresh_token == "new_refresh"
    refresh_callback.assert_called_once_with("new_access", "new_refresh")

@pytest.mark.anyio
async def test_twitch_router_init_success(client):
    # Setup mock server state
    parcera_server.config = MagicMock()
    parcera_server.config.get.side_effect = lambda key, default=None: {
        "sensitivity_presets": {"medium": [16.0, 0.35, 0.9]},
        "response_sensitivity": "medium",
        "force_keywords": [],
        "stt": {"ignore_sentences": []}
    }.get(key, default)

    parcera_server.config.settings = {
        "twitch": {
            "client_id": "config_id",
            "client_secret": "config_secret"
        }
    }
    # Reset internal state to force initialization
    parcera_server.twitch_client = None

    # Mock TwitchClient and its methods
    mock_user = MagicMock()
    mock_user.display_name = "TestUser"
    mock_user.login = "testuser"

    with patch("core.twitch_client.TwitchClient") as MockTwitchClient:
        instance = MockTwitchClient.return_value
        instance.initialize = AsyncMock(return_value=True)
        instance.get_me = AsyncMock(return_value=mock_user)
        instance.start_chat = AsyncMock()
        instance.stop_chat = AsyncMock()
        instance.update_settings = MagicMock()
        instance.is_chat_started = False

        response = client.post("/twitch/init", json={
            "access_token": "at",
            "refresh_token": "rt"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["user"]["display_name"] == "TestUser"

        # Verify it was initialized with config values
        MockTwitchClient.assert_called_once_with("config_id", "config_secret", callback_on_refresh=ANY)
        instance.update_settings.assert_called_once()

def test_twitch_router_init_missing_config(client):
    parcera_server.config = MagicMock()
    parcera_server.config.settings = {"twitch": {}} # Missing ID/Secret

    response = client.post("/twitch/init", json={
        "access_token": "at",
        "refresh_token": "rt"
    })

    assert response.status_code == 400
    assert "missing" in response.json()["detail"].lower()

@pytest.mark.anyio
async def test_twitch_router_status(client):
    parcera_server.twitch_client = MagicMock()
    parcera_server.twitch_client.twitch = MagicMock() # Simulate initialized

    mock_user = MagicMock()
    mock_user.display_name = "StatusUser"
    mock_user.login = "statususer"
    parcera_server.twitch_client.get_me = AsyncMock(return_value=mock_user)

    response = client.get("/twitch/status")

    assert response.status_code == 200
    data = response.json()
    assert data["initialized"] is True
    assert data["user"]["display_name"] == "StatusUser"

@pytest.mark.anyio
async def test_twitch_client_chat_filtering():
    from src.core.twitch_client import TwitchClient

    client = TwitchClient("id", "secret")
    # Set wake word and ignored users
    client.update_settings(wake_word="パルセラ", ignored_users=["BotUser"])

    callback = AsyncMock()
    client.on_message_callback = callback

    # 1. Ignored user message
    msg_ignored = MagicMock()
    msg_ignored.user.name = "BotUser"
    msg_ignored.text = "パルセラ こんにちは"
    await client._on_chat_message(msg_ignored)
    callback.assert_not_called()

    # 2. Message without wake word
    msg_no_wake = MagicMock()
    msg_no_wake.user.name = "RealUser"
    msg_no_wake.text = "こんにちは"
    await client._on_chat_message(msg_no_wake)
    callback.assert_not_called()

    # 3. Valid message with wake word
    msg_match = MagicMock()
    msg_match.user.name = "RealUser"
    msg_match.user.display_name = "リアルユーザー"
    msg_match.text = "ねえパルセラ！"
    await client._on_chat_message(msg_match)
    # Callback should be called with display_name
    callback.assert_called_once_with("リアルユーザー", "ねえパルセラ！")

@pytest.mark.anyio
async def test_twitch_wait_time_calculation():
    from src.run_server import ParceraServer
    server = ParceraServer()

    # 1. Instant mode (fixed 0.0s regardless of text)
    server.config.get = MagicMock(return_value={"response_speed": "instant"})
    assert server._calculate_twitch_wait_time("おはようございます") == 0.0

    # 2. Natural mode (base 0.2s + weighted char count)
    server.config.get = MagicMock(return_value={"response_speed": "natural"})
    # "あ" (1) -> 0.2 + 1 * 0.07 = 0.27
    assert server._calculate_twitch_wait_time("あ") == pytest.approx(0.27)
    # "漢" (2) -> 0.2 + 2 * 0.07 = 0.34
    assert server._calculate_twitch_wait_time("漢") == pytest.approx(0.34)
    # "！" (ignored) -> 0.2 + 0 = 0.2
    assert server._calculate_twitch_wait_time("！") == pytest.approx(0.2)
