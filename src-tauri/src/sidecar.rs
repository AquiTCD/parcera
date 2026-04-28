use crate::types::{LogEntry, LogManager};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

const MAX_RESTARTS: u32 = 5;

pub struct SidecarManager {
    log_manager: Arc<LogManager>,
    config_path: String,
    port: u16,
    restart_count: Arc<Mutex<u32>>,
}

impl SidecarManager {
    pub fn new(log_manager: Arc<LogManager>, config_path: String, port: u16) -> Self {
        Self {
            log_manager,
            config_path,
            port,
            restart_count: Arc::new(Mutex::new(0)),
        }
    }

    pub async fn start(&self, app: AppHandle) {
        self.spawn_python(app).await;
    }

    async fn spawn_python(&self, app: AppHandle) {
        let python_path = resolve_python_path();
        let script_path = resolve_script_path();
        let config_path = self.config_path.clone();
        let log_manager = self.log_manager.clone();
        let restart_count = self.restart_count.clone();
        let port = self.port;
        let app_clone = app.clone();

        log::info!("[Sidecar] Starting Python: {python_path} {script_path}");
        log::info!("[Sidecar] Config: {config_path}");

        let result = app
            .shell()
            .command(&python_path)
            .args([&script_path])
            .env("PARCERA_CONFIG_PATH", &config_path)
            .env("PYTHONUNBUFFERED", "1")
            .spawn();

        match result {
            Ok((mut rx, _child)) => {
                // Reset restart counter on successful spawn
                *restart_count.lock().unwrap() = 0;

                // Emit to frontend after 2s for Twitch sync
                let sync_app = app_clone.clone();
                tokio::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                    let _ = sync_app.emit("sidecar-ready", ());
                });

                // Stream stdout/stderr to LogManager and frontend
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            let text = String::from_utf8_lossy(&line).to_string();
                            let entry = LogEntry::new("stdout", &text);
                            log_manager.add("stdout", &text);
                            let _ = app_clone.emit("sidecar-log", &entry);
                        }
                        CommandEvent::Stderr(line) => {
                            let text = String::from_utf8_lossy(&line).to_string();
                            let is_info = text.contains("INFO:")
                                || text.contains("[USER]:")
                                || text.contains("[AI]:")
                                || text.contains("Application startup complete")
                                || text.contains("Uvicorn running");
                            let source = if is_info { "stdout" } else { "stderr" };
                            let entry = LogEntry::new(source, &text);
                            log_manager.add(source, &text);
                            let _ = app_clone.emit("sidecar-log", &entry);
                        }
                        CommandEvent::Error(e) => {
                            log::error!("[Sidecar] Process error: {e}");
                        }
                        CommandEvent::Terminated(status) => {
                            log::warn!(
                                "[Sidecar] Python exited with code {:?}",
                                status.code
                            );
                            break;
                        }
                        _ => {}
                    }
                }

                // Process exited — attempt restart with backoff
                let count = {
                    let mut c = restart_count.lock().unwrap();
                    *c += 1;
                    *c
                };

                if count <= MAX_RESTARTS {
                    let delay_ms = (1000u64 * 2u64.pow(count)).min(30_000);
                    log::warn!(
                        "[Sidecar] Restarting ({count}/{MAX_RESTARTS}) in {delay_ms}ms…"
                    );
                    tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;

                    // Recreate a new manager-like state for the retry
                    let mgr = SidecarManager {
                        log_manager: log_manager.clone(),
                        config_path: config_path.clone(),
                        port,
                        restart_count: restart_count.clone(),
                    };
                    Box::pin(mgr.spawn_python(app_clone)).await;
                } else {
                    log::error!("[Sidecar] Max restarts reached. Python engine stopped.");
                }
            }
            Err(e) => {
                log::error!("[Sidecar] Failed to spawn Python: {e}");
            }
        }
    }
}

/// Resolve the Python executable path.
/// Dev: `.venv/bin/python` relative to the project root.
/// Prod: bundled python-runtime binary.
pub fn resolve_python_path() -> String {
    #[cfg(debug_assertions)]
    {
        // In dev, resolve relative to the Cargo workspace (src-tauri/../.venv)
        let root = project_root();
        root.join(".venv").join("bin").join("python").to_string_lossy().into_owned()
    }
    #[cfg(not(debug_assertions))]
    {
        // In production, Tauri bundles resources; resolved via app.path() at runtime.
        // Placeholder — overridden when the app handle is available.
        ".venv/bin/python".to_string()
    }
}

/// Resolve the server script path.
pub fn resolve_script_path() -> String {
    let root = project_root();
    root.join("src").join("run_server.py").to_string_lossy().into_owned()
}

/// Returns the project root directory (parent of src-tauri/).
fn project_root() -> PathBuf {
    // CARGO_MANIFEST_DIR points to src-tauri/ at compile time
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    PathBuf::from(manifest_dir)
        .parent()
        .expect("src-tauri must have a parent directory")
        .to_path_buf()
}

/// Compute the restart delay (ms) using exponential backoff capped at 30s.
pub fn restart_delay_ms(count: u32) -> u64 {
    1000u64.saturating_mul(2u64.saturating_pow(count)).min(30_000)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::LogManager;

    // ── Pure logic tests (no process spawning) ────────────────────────────────

    #[test]
    fn restart_delay_grows_exponentially() {
        assert_eq!(restart_delay_ms(1), 2_000);
        assert_eq!(restart_delay_ms(2), 4_000);
        assert_eq!(restart_delay_ms(3), 8_000);
        assert_eq!(restart_delay_ms(4), 16_000);
        assert_eq!(restart_delay_ms(5), 30_000); // capped at 30s
    }

    #[test]
    fn restart_delay_caps_at_30s() {
        assert_eq!(restart_delay_ms(10), 30_000);
        assert_eq!(restart_delay_ms(100), 30_000);
    }

    #[test]
    fn resolve_python_path_is_nonempty() {
        let p = resolve_python_path();
        assert!(!p.is_empty());
    }

    #[test]
    fn resolve_script_path_ends_with_run_server_py() {
        let p = resolve_script_path();
        assert!(p.ends_with("run_server.py"), "got: {p}");
    }

    #[test]
    fn project_root_contains_src_tauri() {
        let root = project_root();
        assert!(root.join("src-tauri").exists(), "root: {}", root.display());
    }

    #[test]
    fn sidecar_manager_constructs() {
        let mgr = SidecarManager::new(
            Arc::new(LogManager::new()),
            "/tmp/test-config.json".into(),
            8676,
        );
        assert_eq!(*mgr.restart_count.lock().unwrap(), 0);
    }

    // ── Integration tests (require running Tauri app + Python) ───────────────

    #[test]
    #[ignore = "requires Tauri app handle and Python venv"]
    fn sidecar_starts_python_process() {
        // Verified manually via `mise run tauri-dev`
    }
}
