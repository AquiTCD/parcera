use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

pub const DEFAULT_SETTINGS_YAML: &str =
    include_str!("../../configs/settings.default.yaml");

pub struct SettingsStore {
    data: Value,
    path: PathBuf,
}

impl SettingsStore {
    pub fn new(path: PathBuf) -> Self {
        Self { data: json!({}), path }
    }

    /// Initialize: load from file if exists, otherwise seed from default YAML.
    pub fn init(&mut self) -> Result<(), String> {
        if self.path.exists() {
            self.load()
        } else {
            self.data = parse_default_yaml()?;
            self.save()
        }
    }

    pub fn load(&mut self) -> Result<(), String> {
        let content = fs::read_to_string(&self.path).map_err(|e| e.to_string())?;
        self.data = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn save(&self) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let content = serde_json::to_string_pretty(&self.data).map_err(|e| e.to_string())?;
        fs::write(&self.path, content).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_all(&self) -> Value {
        self.data.clone()
    }

    pub fn set_all(&mut self, data: Value) {
        self.data = data;
    }

    /// Set a value by dot-notation key (e.g. "app.port").
    pub fn set(&mut self, key: &str, value: Value) {
        set_nested_value(&mut self.data, key, value);
    }

    pub fn get_port(&self) -> u16 {
        self.data["app"]["port"].as_u64().unwrap_or(8676) as u16
    }

    pub fn get_frontend_port(&self) -> u16 {
        self.data["app"]["frontend_port"]
            .as_u64()
            .unwrap_or_else(|| (self.get_port() as u64) + 1) as u16
    }
}

/// Parse the bundled default YAML into a JSON Value.
pub fn parse_default_yaml() -> Result<Value, String> {
    serde_yaml::from_str(DEFAULT_SETTINGS_YAML).map_err(|e| e.to_string())
}

/// Set a nested value by dot-notation key, creating missing objects along the way.
pub fn set_nested_value(data: &mut Value, key: &str, value: Value) {
    match key.splitn(2, '.').collect::<Vec<_>>().as_slice() {
        [leaf] => {
            if let Value::Object(map) = data {
                map.insert((*leaf).to_string(), value);
            }
        }
        [head, rest] => {
            if let Value::Object(map) = data {
                let child = map.entry((*head).to_string()).or_insert_with(|| json!({}));
                if !child.is_object() {
                    *child = json!({});
                }
                set_nested_value(child, rest, value);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    // ── set_nested_value ──────────────────────────────────────────────────────

    #[test]
    fn set_simple_key() {
        let mut data = json!({});
        set_nested_value(&mut data, "verbose", json!(true));
        assert_eq!(data["verbose"], json!(true));
    }

    #[test]
    fn set_nested_key_creates_path() {
        let mut data = json!({});
        set_nested_value(&mut data, "app.port", json!(8676));
        assert_eq!(data["app"]["port"], json!(8676));
    }

    #[test]
    fn set_deeply_nested_key() {
        let mut data = json!({});
        set_nested_value(&mut data, "llm.providers.gemini.model", json!("gemini-2.0-flash"));
        assert_eq!(data["llm"]["providers"]["gemini"]["model"], "gemini-2.0-flash");
    }

    #[test]
    fn set_overwrites_existing_value() {
        let mut data = json!({ "verbose": false });
        set_nested_value(&mut data, "verbose", json!(true));
        assert_eq!(data["verbose"], json!(true));
    }

    #[test]
    fn set_replaces_non_object_with_object_when_traversing() {
        let mut data = json!({ "app": "old_string" });
        set_nested_value(&mut data, "app.port", json!(9000));
        assert_eq!(data["app"]["port"], json!(9000));
    }

    #[test]
    fn set_preserves_sibling_keys() {
        let mut data = json!({ "app": { "port": 8676, "gpu_acceleration": true } });
        set_nested_value(&mut data, "app.port", json!(9000));
        assert_eq!(data["app"]["port"], json!(9000));
        assert_eq!(data["app"]["gpu_acceleration"], json!(true));
    }

    // ── parse_default_yaml ───────────────────────────────────────────────────

    #[test]
    fn default_yaml_parses_successfully() {
        let v = parse_default_yaml().expect("YAML parse failed");
        assert!(v.is_object(), "root must be an object");
    }

    #[test]
    fn default_yaml_has_expected_keys() {
        let v = parse_default_yaml().unwrap();
        assert_eq!(v["log_level"], "INFO");
        assert_eq!(v["app"]["port"], 8676);
        assert!(v["llm"].is_object());
        assert!(v["tts"].is_object());
        assert!(v["stt"].is_object());
    }

    #[test]
    fn default_yaml_port_is_8676() {
        let v = parse_default_yaml().unwrap();
        assert_eq!(v["app"]["port"].as_u64().unwrap(), 8676u64);
    }

    // ── SettingsStore persistence ─────────────────────────────────────────────

    #[test]
    fn store_init_seeds_from_yaml_when_file_missing() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("config.json");
        let mut store = SettingsStore::new(path.clone());
        store.init().unwrap();
        assert!(path.exists());
        let v = store.get_all();
        assert_eq!(v["app"]["port"], json!(8676));
    }

    #[test]
    fn store_save_and_load_roundtrip() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("config.json");
        let mut store = SettingsStore::new(path.clone());
        store.init().unwrap();
        store.set("app.port", json!(9999));
        store.save().unwrap();

        let mut store2 = SettingsStore::new(path);
        store2.load().unwrap();
        assert_eq!(store2.get_all()["app"]["port"], json!(9999));
    }

    #[test]
    fn store_get_port_defaults_to_8676() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("config.json");
        let mut store = SettingsStore::new(path);
        store.set_all(json!({}));
        assert_eq!(store.get_port(), 8676);
    }

    #[test]
    fn store_get_port_reads_from_settings() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("config.json");
        let mut store = SettingsStore::new(path);
        store.set_all(json!({ "app": { "port": 9876 } }));
        assert_eq!(store.get_port(), 9876);
    }

    #[test]
    fn store_get_frontend_port_defaults_to_port_plus_one() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("config.json");
        let mut store = SettingsStore::new(path);
        store.set_all(json!({ "app": { "port": 8676 } }));
        assert_eq!(store.get_frontend_port(), 8677);
    }

    #[test]
    fn store_get_frontend_port_reads_explicit_value() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("config.json");
        let mut store = SettingsStore::new(path);
        store.set_all(json!({ "app": { "port": 8676, "frontend_port": 9000 } }));
        assert_eq!(store.get_frontend_port(), 9000);
    }
}
