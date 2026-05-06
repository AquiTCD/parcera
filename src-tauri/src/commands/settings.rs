use crate::python_client::python_url;
use crate::settings_store::parse_default_yaml;
use crate::types::OpResult;
use crate::AppState;
use serde_json::Value;
use tauri::{Emitter, State};

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Value, String> {
    let store = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(store.get_all())
}

#[tauri::command]
pub async fn get_default_settings() -> Result<Value, String> {
    parse_default_yaml()
}

#[tauri::command]
pub async fn reload_settings(state: State<'_, AppState>) -> Result<Value, String> {
    let mut store = state.settings.lock().map_err(|e| e.to_string())?;
    store.load()?;
    Ok(store.get_all())
}

#[tauri::command]
pub async fn save_settings(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    settings: Value,
) -> Result<OpResult, String> {
    let port = {
        let mut store = state.settings.lock().map_err(|e| e.to_string())?;
        store.set_all(settings.clone());
        store.save()?;
        store.get_port()
    };

    let _ = app_handle.emit("settings-changed", &settings);

    let restart_required = notify_python_reload(port, &settings).await;

    Ok(OpResult::ok_with_restart(restart_required))
}

#[tauri::command]
pub async fn update_setting(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    key: String,
    value: Value,
) -> Result<OpResult, String> {
    let (all_settings, port) = {
        let mut store = state.settings.lock().map_err(|e| e.to_string())?;
        store.set(&key, value);
        store.save()?;
        (store.get_all(), store.get_port())
    };

    let _ = app_handle.emit("settings-changed", &all_settings);

    notify_python_reload(port, &all_settings).await;

    Ok(OpResult::ok())
}

async fn notify_python_reload(port: u16, settings: &Value) -> bool {
    let url = python_url(port, "/config/reload");
    if let Ok(resp) = reqwest::Client::new()
        .post(&url)
        .json(settings)
        .send()
        .await
    {
        if let Ok(body) = resp.json::<Value>().await {
            return body.get("restart_required")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use crate::settings_store::parse_default_yaml;

    #[test]
    fn default_settings_is_valid_json_object() {
        let v = parse_default_yaml().unwrap();
        assert!(v.is_object());
    }

    #[test]
    fn default_settings_has_required_top_level_keys() {
        let v = parse_default_yaml().unwrap();
        for key in &["log_level", "llm", "stt", "tts", "app", "avatars"] {
            assert!(v.get(*key).is_some(), "missing key: {key}");
        }
    }
}
