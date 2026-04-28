use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn select_directory(
    app_handle: tauri::AppHandle,
    current_path: Option<String>,
) -> Result<Option<String>, String> {
    let mut builder = app_handle.dialog().file();

    if let Some(ref path) = current_path {
        builder = builder.set_directory(path);
    }

    // blocking pick_folder runs synchronously; wrap in spawn_blocking for async context
    let result = tokio::task::spawn_blocking(move || builder.blocking_pick_folder())
        .await
        .map_err(|e| e.to_string())?;

    Ok(result.map(|p| p.to_string()))
}

#[cfg(test)]
mod tests {
    // Dialog commands require a running Tauri app.
    // Covered by integration / manual testing.
}
