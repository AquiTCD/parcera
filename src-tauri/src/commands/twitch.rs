use crate::twitch::oauth::TwitchOAuthHandler;
use crate::types::{OpResult, TwitchStatus};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn twitch_start_auth(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let (client_id, client_secret, port) = {
        let store = state.settings.lock().map_err(|e| e.to_string())?;
        let settings = store.get_all();
        let id = settings["twitch"]["client_id"]
            .as_str()
            .filter(|s| !s.is_empty())
            .ok_or("Twitch Client ID is missing in settings")?
            .to_string();
        let secret = settings["twitch"]["client_secret"]
            .as_str()
            .filter(|s| !s.is_empty())
            .ok_or("Twitch Client Secret is missing in settings")?
            .to_string();
        (id, secret, store.get_port())
    };

    let token_store = state.twitch_tokens.clone();
    TwitchOAuthHandler::start(client_id, client_secret, token_store, app_handle, port).await
}

#[tauri::command]
pub async fn twitch_get_auth_status(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.twitch_tokens.exists())
}

#[tauri::command]
pub async fn twitch_clear_auth(state: State<'_, AppState>) -> Result<bool, String> {
    state.twitch_tokens.clear()?;

    let port = state.settings.lock().map_err(|e| e.to_string())?.get_port();
    let url = format!("http://127.0.0.1:{port}/twitch/stop");
    let _ = reqwest::Client::new().post(&url).send().await;

    Ok(true)
}

fn build_test_event_url(port: u16, event_type: &str) -> String {
    format!(
        "http://127.0.0.1:{}/twitch/test-event?event_type={}",
        port,
        urlencoding::encode(event_type)
    )
}

#[tauri::command]
pub async fn twitch_test_event(
    state: State<'_, AppState>,
    event_type: String,
) -> Result<OpResult, String> {
    let port = state.settings.lock().map_err(|e| e.to_string())?.get_port();
    let url = build_test_event_url(port, &event_type);

    match reqwest::Client::new().post(&url).send().await {
        Ok(res) if res.status().is_success() => Ok(OpResult::ok()),
        Ok(res) => {
            let body = res.text().await.unwrap_or_default();
            Ok(OpResult::err(body))
        }
        Err(e) => Ok(OpResult::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn get_twitch_status(state: State<'_, AppState>) -> Result<TwitchStatus, String> {
    let port = state.settings.lock().map_err(|e| e.to_string())?.get_port();
    let url = format!("http://127.0.0.1:{port}/twitch/status");

    match reqwest::Client::new().get(&url).send().await {
        Ok(res) if res.status().is_success() => {
            res.json::<TwitchStatus>().await.map_err(|e| e.to_string())
        }
        _ => Ok(TwitchStatus { initialized: false, user: None, session_id: None }),
    }
}

#[cfg(test)]
mod tests {
    use super::build_test_event_url;
    use crate::types::TwitchStatus;

    #[test]
    fn twitch_status_uninitialized_default() {
        let s = TwitchStatus { initialized: false, user: None, session_id: None };
        let v = serde_json::to_value(&s).unwrap();
        assert_eq!(v["initialized"], false);
        assert!(v.get("user").map_or(true, |u| u.is_null()));
    }

    #[test]
    fn build_test_event_url_normal_type() {
        let url = build_test_event_url(8676, "follow");
        assert_eq!(url, "http://127.0.0.1:8676/twitch/test-event?event_type=follow");
    }

    #[test]
    fn build_test_event_url_encodes_special_chars() {
        let url = build_test_event_url(8676, "follow&inject=x");
        assert!(url.contains("follow%26inject%3Dx"), "got: {url}");
        assert!(!url.contains("follow&inject=x"), "raw ampersand leaked into URL: {url}");
    }

    #[test]
    fn build_test_event_url_encodes_equals() {
        let url = build_test_event_url(8676, "a=b");
        assert!(url.contains("a%3Db"), "got: {url}");
    }
}
