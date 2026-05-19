use crate::python_client::python_url;
use crate::twitch::token_store::{SharedTokenStore, TwitchTokens};
use rand::Rng;
use std::net::SocketAddr;
use tauri::Emitter;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::time::{timeout, Duration};

const OAUTH_PORT: u16 = 8677;
const REDIRECT_URI: &str = "http://localhost:8677/auth/callback";
const AUTH_TIMEOUT_SECS: u64 = 300;

const TWITCH_SCOPES: &str =
    "chat:read chat:edit channel:read:subscriptions moderation:read \
     bits:read channel:read:redemptions moderator:read:followers";

pub struct TwitchOAuthHandler;

impl TwitchOAuthHandler {
    pub async fn start(
        client_id: String,
        client_secret: String,
        token_store: SharedTokenStore,
        app_handle: tauri::AppHandle,
        python_port: u16,
    ) -> Result<(), String> {
        let state_token = generate_state();

        // Bind BEFORE opening the browser: eliminates the race condition where
        // Twitch auto-redirects before the listener is ready.
        let addr: SocketAddr = format!("127.0.0.1:{OAUTH_PORT}").parse().unwrap();
        let listener = TcpListener::bind(addr).await.map_err(|e| {
            format!("Failed to bind OAuth callback port {OAUTH_PORT} (already in use?): {e}")
        })?;

        let auth_url = build_auth_url(&client_id, &state_token);
        tauri_plugin_opener::open_url(auth_url, Option::<String>::None)
            .map_err(|e| e.to_string())?;

        tokio::spawn(async move {
            if let Err(e) = run_callback_server(
                listener,
                state_token,
                client_id,
                client_secret,
                token_store,
                app_handle,
                python_port,
            )
            .await
            {
                log::error!("[Twitch] OAuth callback server error: {e}");
            }
        });

        Ok(())
    }
}

fn generate_state() -> String {
    let bytes: [u8; 16] = rand::thread_rng().gen();
    hex::encode(bytes)
}

fn build_auth_url(client_id: &str, state: &str) -> String {
    format!(
        "https://id.twitch.tv/oauth2/authorize\
         ?client_id={client_id}\
         &redirect_uri={REDIRECT_URI}\
         &response_type=code\
         &scope={}\
         &state={state}",
        urlencoding::encode(TWITCH_SCOPES)
    )
}

/// Extracts (code, state) from a callback path if it is a valid /auth/callback request.
/// Returns None for unrelated paths (e.g. /favicon.ico) so the server can skip them.
fn parse_callback_params(path: &str) -> Option<(String, String)> {
    if !path.starts_with("/auth/callback") {
        return None;
    }
    let query = path.splitn(2, '?').nth(1).unwrap_or("");
    let params: std::collections::HashMap<&str, &str> = query
        .split('&')
        .filter_map(|p| {
            let mut kv = p.splitn(2, '=');
            Some((kv.next()?, kv.next()?))
        })
        .collect();
    let code = params.get("code").copied()?.to_string();
    let state = params.get("state").copied()?.to_string();
    Some((code, state))
}

async fn sync_tokens_with_python(port: u16, tokens: &TwitchTokens) {
    let url = build_sync_url(port);
    let body = serde_json::json!({
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
    });

    for attempt in 1..=10u32 {
        match reqwest::Client::new().post(&url).json(&body).send().await {
            Ok(res) if res.status().is_success() => {
                log::info!("[Twitch] Python backend initialized successfully.");
                return;
            }
            Ok(res) => {
                log::warn!("[Twitch] /twitch/init responded {}: attempt {attempt}/10", res.status());
            }
            Err(e) => {
                log::warn!("[Twitch] /twitch/init unreachable: {e}: attempt {attempt}/10");
            }
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
    }
    log::error!("[Twitch] Failed to sync tokens with Python backend after 10 attempts.");
}

fn build_sync_url(port: u16) -> String {
    python_url(port, "/twitch/init")
}

async fn run_callback_server(
    listener: TcpListener,
    expected_state: String,
    client_id: String,
    client_secret: String,
    token_store: SharedTokenStore,
    app_handle: tauri::AppHandle,
    python_port: u16,
) -> Result<(), String> {
    // Loop to skip unrelated browser requests (favicon, prefetch, etc.) that
    // arrive before the actual /auth/callback?code=...&state=... request.
    loop {
        let (mut stream, _) = timeout(
            Duration::from_secs(AUTH_TIMEOUT_SECS),
            listener.accept(),
        )
        .await
        .map_err(|_| "OAuth callback timed out after 5 minutes".to_string())?
        .map_err(|e| e.to_string())?;

        let mut buf = vec![0u8; 4096];
        let n = stream.read(&mut buf).await.map_err(|e| e.to_string())?;
        if n == 0 {
            continue;
        }
        let request = String::from_utf8_lossy(&buf[..n]);

        let path = request
            .lines()
            .next()
            .and_then(|line| line.split_whitespace().nth(1))
            .unwrap_or("/");

        let (code, state) = match parse_callback_params(path) {
            None => {
                // Not the auth callback (e.g. /favicon.ico) — acknowledge and keep waiting.
                let _ = write_http_response(&mut stream, 404, "Not found").await;
                continue;
            }
            Some(params) => params,
        };

        if state != expected_state {
            let _ = write_http_response(&mut stream, 400, ERROR_HTML).await;
            return Err("State mismatch in OAuth callback".into());
        }

        match exchange_code(&client_id, &client_secret, &code).await {
            Ok(tokens) => {
                token_store.save(&tokens).map_err(|e| e.to_string())?;
                let _ = write_http_response(&mut stream, 200, SUCCESS_HTML).await;
                let _ = app_handle.emit("twitch-auth-status", serde_json::json!({ "success": true }));
                let tokens_clone = tokens.clone();
                tokio::spawn(async move {
                    sync_tokens_with_python(python_port, &tokens_clone).await;
                });
                return Ok(());
            }
            Err(e) => {
                let _ = write_http_response(&mut stream, 500, ERROR_HTML).await;
                return Err(e);
            }
        }
    }
}

async fn exchange_code(
    client_id: &str,
    client_secret: &str,
    code: &str,
) -> Result<TwitchTokens, String> {
    let params = [
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("code", code),
        ("grant_type", "authorization_code"),
        ("redirect_uri", REDIRECT_URI),
    ];

    let res = reqwest::Client::new()
        .post("https://id.twitch.tv/oauth2/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Token exchange failed: {text}"));
    }

    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    let expires_in = data["expires_in"].as_u64().unwrap_or(0);
    let expires_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
        + expires_in;

    Ok(TwitchTokens {
        access_token: data["access_token"].as_str().unwrap_or_default().to_string(),
        refresh_token: data["refresh_token"].as_str().unwrap_or_default().to_string(),
        expires_at,
    })
}

async fn write_http_response(
    stream: &mut tokio::net::TcpStream,
    status: u16,
    body: &str,
) -> std::io::Result<()> {
    let content_type = if body.trim_start().starts_with('<') {
        "text/html"
    } else {
        "text/plain"
    };
    let response = format!(
        "HTTP/1.1 {status} OK\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(response.as_bytes()).await
}

const SUCCESS_HTML: &str = r#"<html>
  <body style="font-family:sans-serif;display:flex;flex-direction:column;align-items:center;
               justify-content:center;height:100vh;background:#0f0f0f;color:white;">
    <h1 style="color:#9146FF;">Authentication Successful!</h1>
    <p>You can close this window and return to Parcera.</p>
    <script>setTimeout(() => window.close(), 3000);</script>
  </body>
</html>"#;

const ERROR_HTML: &str = r#"<html>
  <body style="font-family:sans-serif;display:flex;flex-direction:column;align-items:center;
               justify-content:center;height:100vh;background:#0f0f0f;color:white;">
    <h1 style="color:#ff4444;">Authentication Failed</h1>
    <p>Something went wrong. Please close this window and try again in Parcera.</p>
  </body>
</html>"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_auth_url_contains_client_id() {
        let url = build_auth_url("my_client_id", "test_state");
        assert!(url.contains("client_id=my_client_id"));
    }

    #[test]
    fn build_auth_url_contains_state() {
        let url = build_auth_url("id", "abc123");
        assert!(url.contains("state=abc123"));
    }

    #[test]
    fn build_auth_url_points_to_twitch() {
        let url = build_auth_url("id", "state");
        assert!(url.starts_with("https://id.twitch.tv/oauth2/authorize"));
    }

    #[test]
    fn build_auth_url_contains_redirect_uri() {
        let url = build_auth_url("id", "state");
        assert!(url.contains("redirect_uri="));
        assert!(url.contains("8677"));
    }

    #[test]
    fn generate_state_is_32_hex_chars() {
        let s = generate_state();
        assert_eq!(s.len(), 32);
        assert!(s.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn generate_state_is_different_each_call() {
        let a = generate_state();
        let b = generate_state();
        assert_ne!(a, b);
    }

    #[test]
    fn build_sync_url_uses_correct_path() {
        let url = build_sync_url(8676);
        assert_eq!(url, "http://127.0.0.1:8676/twitch/init");
    }

    #[test]
    fn build_sync_url_respects_port() {
        let url = build_sync_url(9999);
        assert!(url.contains(":9999/"));
        assert!(url.ends_with("/twitch/init"));
    }

    #[test]
    fn parse_callback_params_extracts_code_and_state() {
        let result = parse_callback_params("/auth/callback?code=abc123&state=xyz789");
        assert_eq!(result, Some(("abc123".to_string(), "xyz789".to_string())));
    }

    #[test]
    fn parse_callback_params_ignores_non_callback_paths() {
        assert!(parse_callback_params("/favicon.ico").is_none());
        assert!(parse_callback_params("/").is_none());
        assert!(parse_callback_params("/auth/other").is_none());
    }

    #[test]
    fn parse_callback_params_requires_both_code_and_state() {
        assert!(parse_callback_params("/auth/callback?code=abc").is_none());
        assert!(parse_callback_params("/auth/callback?state=xyz").is_none());
        assert!(parse_callback_params("/auth/callback").is_none());
    }

    #[test]
    fn parse_callback_params_handles_extra_query_params() {
        let result = parse_callback_params("/auth/callback?scope=chat%3Aread&code=tok&state=st");
        assert_eq!(result, Some(("tok".to_string(), "st".to_string())));
    }
}
