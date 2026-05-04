use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TwitchTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: u64,
}

pub struct TwitchTokenStore {
    path: PathBuf,
}

impl TwitchTokenStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn save(&self, tokens: &TwitchTokens) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let content = serde_json::to_string(tokens).map_err(|e| e.to_string())?;
        fs::write(&self.path, content).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn load(&self) -> Option<TwitchTokens> {
        if !self.path.exists() {
            return None;
        }
        let content = fs::read_to_string(&self.path).ok()?;
        serde_json::from_str(&content).ok()
    }

    pub fn clear(&self) -> Result<(), String> {
        if self.path.exists() {
            fs::remove_file(&self.path).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn exists(&self) -> bool {
        self.path.exists()
    }
}

/// Convenience wrapper used by OAuth handler (avoids cloning the store itself).
pub type SharedTokenStore = Arc<TwitchTokenStore>;

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn sample_tokens() -> TwitchTokens {
        TwitchTokens {
            access_token: "tok_abc".into(),
            refresh_token: "ref_xyz".into(),
            expires_at: 9_999_999_999,
        }
    }

    #[test]
    fn save_and_load_roundtrip() {
        let dir = tempdir().unwrap();
        let store = TwitchTokenStore::new(dir.path().join("tokens.json"));
        store.save(&sample_tokens()).unwrap();
        let loaded = store.load().expect("tokens should exist");
        assert_eq!(loaded.access_token, "tok_abc");
        assert_eq!(loaded.refresh_token, "ref_xyz");
        assert_eq!(loaded.expires_at, 9_999_999_999);
    }

    #[test]
    fn load_returns_none_when_file_missing() {
        let dir = tempdir().unwrap();
        let store = TwitchTokenStore::new(dir.path().join("tokens.json"));
        assert!(store.load().is_none());
    }

    #[test]
    fn exists_false_before_save() {
        let dir = tempdir().unwrap();
        let store = TwitchTokenStore::new(dir.path().join("tokens.json"));
        assert!(!store.exists());
    }

    #[test]
    fn exists_true_after_save() {
        let dir = tempdir().unwrap();
        let store = TwitchTokenStore::new(dir.path().join("tokens.json"));
        store.save(&sample_tokens()).unwrap();
        assert!(store.exists());
    }

    #[test]
    fn clear_removes_file() {
        let dir = tempdir().unwrap();
        let store = TwitchTokenStore::new(dir.path().join("tokens.json"));
        store.save(&sample_tokens()).unwrap();
        store.clear().unwrap();
        assert!(!store.exists());
    }

    #[test]
    fn clear_is_idempotent_when_file_missing() {
        let dir = tempdir().unwrap();
        let store = TwitchTokenStore::new(dir.path().join("tokens.json"));
        assert!(store.clear().is_ok());
    }

    #[test]
    fn tokens_serialize_to_expected_json_shape() {
        let tokens = sample_tokens();
        let v = serde_json::to_value(&tokens).unwrap();
        assert!(v["access_token"].is_string());
        assert!(v["refresh_token"].is_string());
        assert!(v["expires_at"].is_number());
    }
}
