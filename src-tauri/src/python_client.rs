/// Build a URL to the local Python backend server.
pub fn python_url(port: u16, path: &str) -> String {
    let path = if path.starts_with('/') { path } else { &format!("/{path}") };
    format!("http://127.0.0.1:{port}{path}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn python_url_simple_path() {
        assert_eq!(python_url(8676, "/health"), "http://127.0.0.1:8676/health");
    }

    #[test]
    fn python_url_without_leading_slash() {
        assert_eq!(python_url(8676, "health"), "http://127.0.0.1:8676/health");
    }

    #[test]
    fn python_url_nested_path() {
        assert_eq!(python_url(8676, "/twitch/status"), "http://127.0.0.1:8676/twitch/status");
    }

    #[test]
    fn python_url_respects_port() {
        assert_eq!(python_url(9999, "/ws"), "http://127.0.0.1:9999/ws");
    }

    #[test]
    fn python_url_with_query_string() {
        let url = python_url(8676, "/twitch/test-event?event_type=follow");
        assert_eq!(url, "http://127.0.0.1:8676/twitch/test-event?event_type=follow");
    }
}
