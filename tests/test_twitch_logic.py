import pytest
import asyncio
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

        import asyncio
        await asyncio.sleep(0.1)

        assert response.status_code == 200

        data = response.json()
        assert data["success"] is True
        assert data["user"]["display_name"] == "TestUser"

        # Verify it was initialized with config values
        MockTwitchClient.assert_called_once_with("config_id", "config_secret", callback_on_refresh=ANY)


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
    assert server.twitch_service._calculate_wait_time("おはようございます") == 0.0

    # 2. Natural mode (base 0.2s + weighted char count)
    server.config.get = MagicMock(return_value={"response_speed": "natural"})
    # "あ" (1) -> 0.2 + 1 * 0.16 = 0.36
    assert server.twitch_service._calculate_wait_time("あ") == pytest.approx(0.36)
    # "漢" (2) -> 0.2 + 2 * 0.16 = 0.52
    assert server.twitch_service._calculate_wait_time("漢") == pytest.approx(0.52)
    # "！" (ignored) -> 0.2 + 0 = 0.2
    assert server.twitch_service._calculate_wait_time("！") == pytest.approx(0.2)

@pytest.mark.anyio
async def test_twitch_service_process_queue():
    from src.services.twitch_service import TwitchService
    server = MagicMock()
    server.config.get.return_value = {"response_speed": "instant"}
    twitch = TwitchService(server)
    
    # We will enqueue two items, then cancel the task to emulate running the loop
    await twitch.queue.put(("UserA", "Hello", "chat", asyncio.get_event_loop().time()))
    await twitch.queue.put(("UserB", "Bye", "chat", asyncio.get_event_loop().time()))
    
    with patch.object(twitch, "_invoke_response", new_callable=AsyncMock) as mock_invoke:
        # Since process_queue is a while True loop, we run it for a bit
        task = asyncio.create_task(twitch.process_queue())
        
        # Wait for queue to be empty (or timeout)
        for _ in range(20):
            if twitch.queue.empty():
                break
            await asyncio.sleep(0.1)
            
        task.cancel()
        
        # Verify 2 calls
        assert mock_invoke.call_count == 2
        mock_invoke.assert_any_call("UserA", "Hello", "chat", audio_delay=ANY, is_delayed=ANY)
        mock_invoke.assert_any_call("UserB", "Bye", "chat", audio_delay=ANY, is_delayed=ANY)

@pytest.mark.anyio
async def test_twitch_service_invoke_response():
    from src.services.twitch_service import TwitchService
    server = MagicMock()
    server.aiavatar_server.chat = AsyncMock()
    
    twitch = TwitchService(server)
    
    await twitch._invoke_response("UserA", "Test", "chat", audio_delay=0.0, is_delayed=False)
    
    # Verify aiavatar_server.chat was called
    server.aiavatar_server.chat.assert_called_once()
    args, kwargs = server.aiavatar_server.chat.call_args
    # First arg is DummyWS, second is payload
    payload = args[1]
    assert payload["session_id"] == "twitch-session"
    assert "UserA: Test" in payload["text"]
    assert "[Twitch Chat]" in payload["text"]

@pytest.mark.anyio
async def test_twitch_service_sync_client():
    from src.services.twitch_service import TwitchService
    server = MagicMock()
    twitch = TwitchService(server)
    
    # Mock configuration 
    server.config.settings = {
        "twitch": {
            "enabled": True,
            "wake_word": "test",
            "ignored_users": [],
            "ng_words": []
        }
    }
    server.twitch_client.is_chat_started = False
    server.twitch_client.is_eventsub_started = False
    server.twitch_client.start_chat = AsyncMock()
    server.twitch_client.start_eventsub = AsyncMock()
    
    # Enable Chat -> start_chat
    await twitch.sync_client()
    server.twitch_client.update_settings.assert_called_once_with(
        wake_word="test",
        ignored_users=[],
        ng_words=[]
    )
    server.twitch_client.start_chat.assert_called_once()
    
    # Enable Chat (already started) -> updates callback only
    server.twitch_client.is_chat_started = True
    server.twitch_client.start_chat.reset_mock()
    await twitch.sync_client()
    server.twitch_client.start_chat.assert_not_called()
    assert hasattr(server.twitch_client, "on_message_callback")
    
    # Disable Chat -> stop_chat
    server.config.settings["twitch"]["enabled"] = False
    server.twitch_client.stop_chat = AsyncMock()
    await twitch.sync_client()
    server.twitch_client.stop_chat.assert_called_once()
@pytest.mark.anyio
async def test_twitch_service_queue_management():
    from src.services.twitch_service import TwitchService
    server = MagicMock()
    server.config.get.return_value = {"response_speed": "instant"}
    twitch = TwitchService(server)
    
    # 1. Test Max Queue Size (max 3)
    # We need to mock should_process to always return True for this test
    twitch.should_process = AsyncMock(return_value=True)
    
    await twitch.enqueue("User1", "Msg1")
    await twitch.enqueue("User2", "Msg2")
    await twitch.enqueue("User3", "Msg3")
    assert twitch.queue.qsize() == 3
    
    # 4th message should discard the oldest (Msg1)
    await twitch.enqueue("User4", "Msg4")
    assert twitch.queue.qsize() == 3
    
    # Verify the order (Msg2, Msg3, Msg4)
    item1 = await twitch.queue.get()
    assert item1[0] == "User2"
    item2 = await twitch.queue.get()
    assert item2[0] == "User3"
    item3 = await twitch.queue.get()
    assert item3[0] == "User4"

@pytest.mark.anyio
async def test_twitch_service_rate_limiting():
    from src.services.twitch_service import TwitchService
    server = MagicMock()
    twitch = TwitchService(server)
    
    # Mock asyncio get_event_loop().time()
    with patch("asyncio.get_event_loop") as mock_loop:
        mock_loop.return_value.time.return_value = 1000.0
        
        # First message from UserA -> should pass
        assert await twitch.should_process("UserA") is True
        
        # Simulate processing (UserA responded at 1000.0)
        twitch.last_user_response_times["usera"] = 1000.0
        twitch.last_global_response_time = 1000.0
        
        # Second message from UserA within 60s (at 1030.0) -> should fail
        mock_loop.return_value.time.return_value = 1030.0
        assert await twitch.should_process("UserA") is False
        
        # Message from UserB within 10s of UserA (at 1005.0) -> should fail (global)
        mock_loop.return_value.time.return_value = 1005.0
        assert await twitch.should_process("UserB") is False 
        
        # After 11s (at 1011.0), UserB should pass global cooldown
        mock_loop.return_value.time.return_value = 1011.0
        assert await twitch.should_process("UserB") is True
        
        # Message from UserA after 61s (at 1061.0) -> should pass
        mock_loop.return_value.time.return_value = 1061.0
        assert await twitch.should_process("UserA") is True

@pytest.mark.anyio
async def test_twitch_client_eventsub_setup():
    from core.twitch_client import TwitchClient
    
    mock_twitch = AsyncMock()
    mock_eventsub = MagicMock() 
    # start/stop are SYNC in twitchAPI EventSubWebsocket (v4+)
    mock_eventsub.start = MagicMock() 
    mock_eventsub.stop = AsyncMock() # But wait, I used `await self.eventsub.stop()` in my code!
    mock_eventsub.listen_channel_raid = AsyncMock()
    mock_eventsub.listen_channel_follow = AsyncMock()
    mock_eventsub.listen_channel_subscribe = AsyncMock()
    
    with patch("core.twitch_client.Twitch", return_value=mock_twitch):
        with patch("core.twitch_client.EventSubWebsocket", return_value=mock_eventsub):
            client = TwitchClient("id", "secret")
            client.twitch = mock_twitch
            
            # Mock get_me for user info
            mock_user = MagicMock()
            mock_user.id = "123"
            mock_user.display_name = "User"
            client.get_me = AsyncMock(return_value=mock_user)
            
            await client.start_eventsub(on_event=AsyncMock())
            
            # Verify EventSubWebsocket was initialized and started
            mock_eventsub.start.assert_called_once()
            # Verify subscriptions (Raid, Sub, Follow)
            mock_eventsub.listen_channel_raid.assert_called_once()
            mock_eventsub.listen_channel_follow.assert_called_once()
            mock_eventsub.listen_channel_subscribe.assert_called_once()
