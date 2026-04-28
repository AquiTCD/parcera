use crate::types::LogManager;
use std::sync::Arc;

/// Placeholder state for the Python sidecar process.
/// Full implementation in Phase 2-C using tauri-plugin-shell Sidecar API.
pub struct SidecarState {
    pub log_manager: Arc<LogManager>,
}

impl SidecarState {
    pub fn new(log_manager: Arc<LogManager>) -> Self {
        Self { log_manager }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::LogManager;

    #[test]
    fn sidecar_state_creates_without_panic() {
        let log_mgr = Arc::new(LogManager::new());
        let _state = SidecarState::new(log_mgr);
    }
}
