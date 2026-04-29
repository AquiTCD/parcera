use tauri::{Manager, WebviewWindowBuilder};

const PREFERENCES_WINDOW_LABEL: &str = "preferences";

#[tauri::command]
pub async fn open_preference_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app_handle.get_webview_window(PREFERENCES_WINDOW_LABEL) {
        let _ = win.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app_handle,
        PREFERENCES_WINDOW_LABEL,
        tauri::WebviewUrl::App("index.html?type=settings".into()),
    )
    .title("Preferences")
    .inner_size(900.0, 700.0)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    // Window creation requires a running Tauri app.
    // Covered by integration / manual testing.
}
