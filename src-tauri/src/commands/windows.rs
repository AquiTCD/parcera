use crate::types::{OpResult, Rect};
use crate::AppState;
use serde_json::json;
use tauri::{Manager, State, WebviewWindow};

#[tauri::command]
pub async fn save_window_bounds(
    window: WebviewWindow,
    state: State<'_, AppState>,
    window_type: String,
) -> Result<OpResult, String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;

    let x = (pos.x as f64 / scale).round() as i64;
    let y = (pos.y as f64 / scale).round() as i64;
    let w = (size.width as f64 / scale).round() as i64;
    let h = (size.height as f64 / scale).round() as i64;

    let mut store = state.settings.lock().map_err(|e| e.to_string())?;
    store.set(&format!("app.windows.{window_type}.x"), json!(x));
    store.set(&format!("app.windows.{window_type}.y"), json!(y));
    store.set(&format!("app.windows.{window_type}.width"), json!(w));
    store.set(&format!("app.windows.{window_type}.height"), json!(h));
    store.save()?;

    Ok(OpResult::ok())
}

#[tauri::command]
pub async fn get_avatar_window_bounds(
    app_handle: tauri::AppHandle,
    window_type: String,
) -> Result<Option<Rect>, String> {
    let win = match app_handle.get_webview_window(&window_type) {
        Some(w) => w,
        None => return Ok(None),
    };

    let scale = win.scale_factor().map_err(|e| e.to_string())?;
    let pos = win.outer_position().map_err(|e| e.to_string())?;
    let size = win.outer_size().map_err(|e| e.to_string())?;

    Ok(Some(Rect {
        x: pos.x as f64 / scale,
        y: pos.y as f64 / scale,
        width: size.width as f64 / scale,
        height: size.height as f64 / scale,
    }))
}

#[cfg(test)]
mod tests {
    use crate::types::Rect;
    use serde_json;

    #[test]
    fn rect_serializes_to_expected_shape() {
        let r = Rect { x: 10.0, y: 20.0, width: 400.0, height: 300.0 };
        let v = serde_json::to_value(&r).unwrap();
        assert_eq!(v["x"], serde_json::json!(10.0));
        assert_eq!(v["width"], serde_json::json!(400.0));
    }
}
