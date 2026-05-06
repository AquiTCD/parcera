pub mod commands;
pub mod python_client;
pub mod settings_store;
pub mod sidecar;
pub mod twitch;
pub mod types;

use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Manager;

use settings_store::SettingsStore;
use sidecar::SidecarManager;
use twitch::token_store::TwitchTokenStore;
use types::LogManager;
use tauri_plugin_shell::process::CommandChild;

#[derive(Clone)]
pub struct AppState {
    pub settings: Arc<Mutex<SettingsStore>>,
    pub log_manager: Arc<LogManager>,
    pub twitch_tokens: Arc<TwitchTokenStore>,
    pub python_child: Arc<Mutex<Option<CommandChild>>>,
}

pub fn run() {
    env_logger::init();
    log::info!("[Parcera] Starting (RUST_LOG={})", std::env::var("RUST_LOG").unwrap_or_else(|_| "unset".into()));

    // Read the default YAML to determine frontend_port before the Tauri builder
    // is constructed (tauri-plugin-localhost requires the port at registration time).
    // Falls back to 8677 if parsing fails.
    let default_frontend_port: u16 = settings_store::parse_default_yaml()
        .ok()
        .and_then(|v| v["app"]["frontend_port"].as_u64())
        .unwrap_or(8677) as u16;

    // Hoist python_child to function scope so both the setup closure and the
    // run-event handler can share the same Arc without lifetime issues.
    let python_child: Arc<Mutex<Option<CommandChild>>> = Arc::new(Mutex::new(None));
    let python_child_exit = python_child.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_localhost::Builder::new(default_frontend_port).build())
        .setup(move |app| {
            let data_dir = app.path().app_data_dir()?;

            let settings_path = data_dir.join("config.json");
            let mut store = SettingsStore::new(settings_path);
            store.init().expect("Failed to initialize settings store");

            let tokens_path = data_dir.join("twitch_tokens.json");

            let log_manager = Arc::new(LogManager::new());
            let port = store.get_port();
            let config_path = data_dir.join("config.json")
                .to_string_lossy()
                .into_owned();

            let state = AppState {
                settings: Arc::new(Mutex::new(store)),
                log_manager: log_manager.clone(),
                twitch_tokens: Arc::new(TwitchTokenStore::new(tokens_path)),
                python_child: python_child.clone(),
            };

            app.manage(state);

            // macOS application menu with Cmd+, → Preferences
            let app_menu_submenu = Submenu::with_items(
                app,
                "Parcera",
                true,
                &[
                    &PredefinedMenuItem::about(app, None, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "preferences", "Preferences...", true, Some("CmdOrCtrl+,"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?;
            let menu = Menu::with_items(app, &[&app_menu_submenu])?;
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| {
                if event.id().as_ref() == "preferences" {
                    let handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = commands::preferences::open_preference_window(handle).await;
                    });
                }
            });

            // Restore saved window bounds (position + size) for avatar windows
            {
                let settings_data = app.state::<AppState>().settings.lock().unwrap().get_all();
                for win_type in &["user", "ai"] {
                    let cfg = &settings_data["app"]["windows"][win_type];
                    if let Some(win) = app.get_webview_window(win_type) {
                        if let (Some(x), Some(y)) = (cfg["x"].as_f64(), cfg["y"].as_f64()) {
                            let _ = win.set_position(tauri::Position::Logical(
                                tauri::LogicalPosition { x, y },
                            ));
                        }
                        if let (Some(w), Some(h)) = (cfg["width"].as_f64(), cfg["height"].as_f64()) {
                            let _ = win.set_size(tauri::Size::Logical(
                                tauri::LogicalSize { width: w, height: h },
                            ));
                        }
                        // Hide window if visible == false (default: show)
                        if cfg["visible"].as_bool() == Some(false) {
                            let _ = win.hide();
                        }
                        // Apply always-on-top if explicitly set to true
                        if cfg["alwaysOnTop"].as_bool() == Some(true) {
                            let _ = win.set_always_on_top(true);
                        }
                    }
                }
            }

            // Start Python sidecar asynchronously after setup completes
            let paths = sidecar::resolve_paths(app.handle());
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                SidecarManager::new(log_manager, config_path, port, paths, python_child)
                    .start(app_handle)
                    .await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings::get_settings,
            commands::settings::get_default_settings,
            commands::settings::save_settings,
            commands::settings::update_setting,
            commands::settings::reload_settings,
            commands::windows::save_window_bounds,
            commands::windows::get_avatar_window_bounds,
            commands::windows::set_window_visible,
            commands::windows::set_window_always_on_top,
            commands::dialogs::select_directory,
            commands::logs::get_log_history,
            commands::twitch::twitch_start_auth,
            commands::twitch::twitch_get_auth_status,
            commands::twitch::twitch_clear_auth,
            commands::twitch::twitch_test_event,
            commands::twitch::get_twitch_status,
            commands::preferences::open_preference_window,
            commands::training::open_training_window,
            commands::training::broadcast_profiles_updated,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_, event| {
            if let tauri::RunEvent::Exit = event {
                // Kill the Python sidecar so it doesn't linger across app launches.
                if let Some(child) = python_child_exit.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
