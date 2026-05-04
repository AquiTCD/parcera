use crate::types::LogEntry;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_log_history(state: State<'_, AppState>) -> Result<Vec<LogEntry>, String> {
    Ok(state.log_manager.get_all())
}

#[cfg(test)]
mod tests {
    use crate::types::{LogEntry, LogManager};

    #[test]
    fn get_log_history_returns_all_entries() {
        let mgr = LogManager::new();
        mgr.add("stdout", "first");
        mgr.add("stderr", "second");
        let logs = mgr.get_all();
        assert_eq!(logs.len(), 2);
        assert_eq!(logs[0].text, "first");
        assert_eq!(logs[1].text, "second");
    }

    #[test]
    fn log_entry_source_roundtrip() {
        let e = LogEntry::new("stdout", "test");
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["source"], "stdout");
        assert_eq!(json["text"], "test");
    }
}
