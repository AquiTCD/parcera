use tauri::{Emitter, Manager, WebviewWindowBuilder};

const TRAINING_WINDOW_LABEL: &str = "training";

fn build_training_url(profile: &str) -> String {
    format!(
        "index.html?type=training&profile={}",
        urlencoding::encode(profile)
    )
}

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

    let url = build_training_url(&profile);
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
    use super::build_training_url;

    #[test]
    fn build_training_url_normal_profile() {
        let url = build_training_url("default");
        assert_eq!(url, "index.html?type=training&profile=default");
    }

    #[test]
    fn build_training_url_encodes_spaces_and_slashes() {
        let url = build_training_url("my profile/v2");
        assert!(url.contains("my%20profile%2Fv2"), "got: {url}");
        assert!(!url.contains("my profile"), "raw space leaked: {url}");
    }

    #[test]
    fn build_training_url_encodes_path_traversal() {
        let url = build_training_url("../etc/passwd");
        assert!(!url.contains("../"), "path traversal not encoded: {url}");
        assert!(url.contains("..%2F"), "got: {url}");
    }
}
