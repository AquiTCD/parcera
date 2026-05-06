use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

#[derive(Debug, Serialize, Deserialize)]
pub struct OpResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub restart_required: Option<bool>,
}

impl OpResult {
    pub fn ok() -> Self {
        Self { success: true, error: None, restart_required: None }
    }
    pub fn err(msg: impl Into<String>) -> Self {
        Self { success: false, error: Some(msg.into()), restart_required: None }
    }
    pub fn ok_with_restart(restart: bool) -> Self {
        Self { success: true, error: None, restart_required: if restart { Some(true) } else { None } }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub source: String,
    pub text: String,
    pub timestamp: String,
}

impl LogEntry {
    pub fn new(source: impl Into<String>, text: impl Into<String>) -> Self {
        Self {
            source: source.into(),
            text: text.into(),
            timestamp: Utc::now().to_rfc3339(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TwitchUser {
    pub display_name: String,
    pub login: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TwitchStatus {
    pub initialized: bool,
    pub user: Option<TwitchUser>,
    pub session_id: Option<String>,
}

pub const MAX_LOG_HISTORY: usize = 1000;

#[derive(Clone)]
pub struct LogManager {
    logs: Arc<Mutex<VecDeque<LogEntry>>>,
}

impl LogManager {
    pub fn new() -> Self {
        Self {
            logs: Arc::new(Mutex::new(VecDeque::new())),
        }
    }

    pub fn add(&self, source: impl Into<String>, text: impl Into<String>) {
        let entry = LogEntry::new(source, text);
        let mut logs = self.logs.lock().unwrap();
        if logs.len() >= MAX_LOG_HISTORY {
            logs.pop_front();
        }
        logs.push_back(entry);
    }

    pub fn get_all(&self) -> Vec<LogEntry> {
        self.logs.lock().unwrap().iter().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn op_result_ok_has_success_true() {
        let r = OpResult::ok();
        assert!(r.success);
        assert!(r.error.is_none());
    }

    #[test]
    fn op_result_err_has_success_false() {
        let r = OpResult::err("oops");
        assert!(!r.success);
        assert_eq!(r.error.as_deref(), Some("oops"));
    }

    #[test]
    fn log_entry_new_sets_fields() {
        let e = LogEntry::new("stdout", "hello world");
        assert_eq!(e.source, "stdout");
        assert_eq!(e.text, "hello world");
        assert!(!e.timestamp.is_empty());
    }

    #[test]
    fn log_manager_add_and_get() {
        let mgr = LogManager::new();
        mgr.add("stdout", "line 1");
        mgr.add("stderr", "line 2");
        let all = mgr.get_all();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].source, "stdout");
        assert_eq!(all[1].source, "stderr");
    }

    #[test]
    fn log_manager_caps_at_max_history() {
        let mgr = LogManager::new();
        for i in 0..MAX_LOG_HISTORY + 10 {
            mgr.add("stdout", format!("line {i}"));
        }
        assert_eq!(mgr.get_all().len(), MAX_LOG_HISTORY);
    }
}
