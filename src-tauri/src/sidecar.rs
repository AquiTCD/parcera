use crate::types::{LogEntry, LogManager};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
#[cfg(not(debug_assertions))]
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

const MAX_RESTARTS: u32 = 5;

/// Resolved paths for the Python sidecar process.
#[derive(Clone)]
pub struct SidecarPaths {
    pub python: String,
    pub script: String,
    /// Set to PYTHONPATH in production (None in dev where .venv handles deps).
    pub pythonpath: Option<String>,
}

pub struct SidecarManager {
    log_manager: Arc<LogManager>,
    config_path: String,
    port: u16,
    paths: SidecarPaths,
    restart_count: Arc<Mutex<u32>>,
    /// Holds the live Python child so it can be killed on app exit.
    pub child_store: Arc<Mutex<Option<CommandChild>>>,
}

impl SidecarManager {
    pub fn new(
        log_manager: Arc<LogManager>,
        config_path: String,
        port: u16,
        paths: SidecarPaths,
        child_store: Arc<Mutex<Option<CommandChild>>>,
    ) -> Self {
        Self {
            log_manager,
            config_path,
            port,
            paths,
            restart_count: Arc::new(Mutex::new(0)),
            child_store,
        }
    }

    pub async fn start(&self, app: AppHandle) {
        self.evict_port_occupant().await;
        self.spawn_python(app).await;
    }

    /// Kill any process currently bound to our port.
    /// macOS/Linux: lsof. Windows: netstat + taskkill.
    /// Ignores errors — if nothing is there, that's fine.
    #[cfg(not(target_os = "windows"))]
    async fn evict_port_occupant(&self) {
        let port = self.port;
        let result = tokio::task::spawn_blocking(move || {
            std::process::Command::new("sh")
                .args(["-c", &format!("lsof -ti tcp:{port} | xargs kill -9 2>/dev/null; exit 0")])
                .status()
        }).await;
        if result.is_ok() {
            tokio::time::sleep(tokio::time::Duration::from_millis(600)).await;
        }
    }

    #[cfg(target_os = "windows")]
    async fn evict_port_occupant(&self) {
        let port = self.port;
        let result = tokio::task::spawn_blocking(move || -> std::io::Result<()> {
            let output = std::process::Command::new("netstat")
                .args(["-ano"])
                .output()?;
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                // netstat -ano columns: Proto, Local, Foreign, State, PID
                if parts.len() >= 5
                    && parts[1].ends_with(&format!(":{port}"))
                    && parts[3] == "LISTENING"
                {
                    if let Some(pid) = parts.last() {
                        let _ = std::process::Command::new("taskkill")
                            .args(["/F", "/PID", pid])
                            .status();
                    }
                    break;
                }
            }
            Ok(())
        }).await;
        if result.is_ok() {
            tokio::time::sleep(tokio::time::Duration::from_millis(600)).await;
        }
    }

    async fn spawn_python(&self, app: AppHandle) {
        let python_path = self.paths.python.clone();
        let script_path = self.paths.script.clone();
        let pythonpath = self.paths.pythonpath.clone();
        let config_path = self.config_path.clone();
        let log_manager = self.log_manager.clone();
        let restart_count = self.restart_count.clone();
        let child_store = self.child_store.clone();
        let port = self.port;
        let paths = self.paths.clone();
        let app_clone = app.clone();

        log::info!("[Sidecar] Starting Python: {python_path} {script_path}");
        log::info!("[Sidecar] Config: {config_path}");

        let mut cmd = app
            .shell()
            .command(&python_path)
            .args([&script_path])
            .env("PARCERA_CONFIG_PATH", &config_path)
            .env("PYTHONUNBUFFERED", "1");

        if let Some(ref pp) = pythonpath {
            cmd = cmd.env("PYTHONPATH", pp);
        }

        let result = cmd.spawn();

        match result {
            Ok((mut rx, child)) => {
                // Store the child handle so the app can kill it on exit.
                *child_store.lock().unwrap() = Some(child);
                // Reset restart counter on successful spawn
                *restart_count.lock().unwrap() = 0;

                // Emit to frontend after 2s for Twitch sync
                let sync_app = app_clone.clone();
                tokio::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                    let _ = sync_app.emit("sidecar-ready", ());
                });

                // Stream stdout/stderr to LogManager, frontend, and terminal
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            let text = String::from_utf8_lossy(&line).to_string();
                            #[cfg(debug_assertions)]
                            eprintln!("[Python] {}", text.trim_end());
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
                            #[cfg(debug_assertions)]
                            eprintln!("[Python] {}", text.trim_end());
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
                    let delay_ms = restart_delay_ms(count);
                    log::warn!(
                        "[Sidecar] Restarting ({count}/{MAX_RESTARTS}) in {delay_ms}ms…"
                    );
                    tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;

                    let mgr = SidecarManager {
                        log_manager: log_manager.clone(),
                        config_path: config_path.clone(),
                        port,
                        paths,
                        restart_count: restart_count.clone(),
                        child_store: child_store.clone(),
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

// ── Path resolution helpers ────────────────────────────────────────────────

/// Path to the Python binary inside a bundled resource directory.
pub fn python_bin_path(resource_dir: &Path) -> PathBuf {
    resource_dir.join("python-runtime").join("bin").join("python")
}

/// Path to run_server.py inside a bundled resource directory.
pub fn server_script_path(resource_dir: &Path) -> PathBuf {
    resource_dir.join("python_src").join("run_server.py")
}

/// Path to site-packages inside a bundled resource directory.
pub fn site_packages_path(resource_dir: &Path) -> PathBuf {
    resource_dir.join("site-packages")
}

/// Resolve sidecar paths from the app handle.
/// Dev: project-local .venv. Prod: bundled resources via resource_dir().
pub fn resolve_paths(app: &AppHandle) -> SidecarPaths {
    #[cfg(debug_assertions)]
    {
        let _ = app;
        let root = project_root();
        SidecarPaths {
            python: root.join(".venv").join("bin").join("python").to_string_lossy().into_owned(),
            script: root.join("src").join("run_server.py").to_string_lossy().into_owned(),
            pythonpath: None,
        }
    }
    #[cfg(not(debug_assertions))]
    {
        let resource_dir = app.path().resource_dir()
            .expect("[Sidecar] resource_dir unavailable in production build");
        SidecarPaths {
            python: python_bin_path(&resource_dir).to_string_lossy().into_owned(),
            script: server_script_path(&resource_dir).to_string_lossy().into_owned(),
            pythonpath: Some(site_packages_path(&resource_dir).to_string_lossy().into_owned()),
        }
    }
}

/// Returns the project root directory (parent of src-tauri/).
#[cfg(debug_assertions)]
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
    fn python_bin_path_resolves_correctly() {
        let dir = PathBuf::from("/resources");
        let p = python_bin_path(&dir);
        assert!(p.to_string_lossy().ends_with("python-runtime/bin/python"), "got: {}", p.display());
    }

    #[test]
    fn server_script_path_resolves_correctly() {
        let dir = PathBuf::from("/resources");
        let p = server_script_path(&dir);
        assert!(p.to_string_lossy().ends_with("python_src/run_server.py"), "got: {}", p.display());
    }

    #[test]
    fn site_packages_path_resolves_correctly() {
        let dir = PathBuf::from("/resources");
        let p = site_packages_path(&dir);
        assert!(p.to_string_lossy().ends_with("site-packages"), "got: {}", p.display());
    }

    #[test]
    fn project_root_contains_src_tauri() {
        let root = project_root();
        assert!(root.join("src-tauri").exists(), "root: {}", root.display());
    }

    #[test]
    fn sidecar_manager_constructs() {
        let paths = SidecarPaths {
            python: "/tmp/python".into(),
            script: "/tmp/run_server.py".into(),
            pythonpath: None,
        };
        let mgr = SidecarManager::new(
            Arc::new(LogManager::new()),
            "/tmp/test-config.json".into(),
            8676,
            paths,
            Arc::new(Mutex::new(None)),
        );
        assert_eq!(*mgr.restart_count.lock().unwrap(), 0);
    }

    #[test]
    fn sidecar_paths_clones() {
        let paths = SidecarPaths {
            python: "/usr/bin/python".into(),
            script: "/app/run_server.py".into(),
            pythonpath: Some("/app/site-packages".into()),
        };
        let clone = paths.clone();
        assert_eq!(clone.python, paths.python);
        assert_eq!(clone.pythonpath, paths.pythonpath);
    }

    // ── Integration tests (require running Tauri app + Python) ───────────────

    #[test]
    #[ignore = "requires Tauri app handle and Python venv"]
    fn sidecar_starts_python_process() {
        // Verified manually via `mise run tauri-dev`
    }
}
