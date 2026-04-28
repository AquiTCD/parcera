use tauri::{Emitter, Manager, WebviewWindowBuilder};

const TRAINING_WINDOW_LABEL: &str = "training";

#[tauri::command]
pub async fn open_training_window(
    app_handle: tauri::AppHandle,
    profile: String,
) -> Result<(), String> {
    if let Some(win) = app_handle.get_webview_window(TRAINING_WINDOW_LABEL) {
        let _ = win.set_focus();
        let _ = win.emit("training-profile-changed", &profile);
        return Ok(());
    }

    let url = format!("index.html?type=training&profile={profile}");
    WebviewWindowBuilder::new(&app_handle, TRAINING_WINDOW_LABEL, tauri::WebviewUrl::App(url.into()))
        .title("追加学習")
        .inner_size(900.0, 700.0)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn broadcast_profiles_updated(app_handle: tauri::AppHandle) -> Result<(), String> {
    let _ = app_handle.emit("profiles-updated", ());
    Ok(())
}

#[cfg(test)]
mod tests {
    // Window creation requires a running Tauri app.
    // Covered by integration / manual testing.
}
