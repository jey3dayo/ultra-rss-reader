use reqwest::{header::HeaderMap, StatusCode};
use std::net::{IpAddr, SocketAddr, TcpStream, ToSocketAddrs};
use std::time::Duration;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DomainError {
    #[error("Network error: {0}")]
    Network(String),
    #[error("Rate limit error: {0}")]
    RateLimit(String),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Persistence error: {0}")]
    Persistence(String),
    #[error("Auth error: {0}")]
    Auth(String),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Keychain error: {0}")]
    Keychain(String),
    #[error("Migration error: {0}")]
    Migration(String),
}

pub type DomainResult<T> = Result<T, DomainError>;

const LOOPBACK_CONNECT_PROBE_TIMEOUT: Duration = Duration::from_millis(200);
const DNS_RESOLUTION_ERROR_MARKERS: &[&str] = &[
    "dns error",
    "failed to lookup address information",
    "name or service not known",
    "could not resolve host",
    "no such host",
    "nodename nor servname provided",
    "temporary failure in name resolution",
];
const DNS_RESOLUTION_ERROR_MESSAGE: &str =
    "Could not resolve the server name. Check the server URL or your DNS/network settings.";
const CONNECTIVITY_ERROR_MESSAGE: &str =
    "Could not connect to the server. Check the server URL and whether the server is reachable.";
const TIMEOUT_ERROR_MESSAGE: &str =
    "Request timed out. Check the server URL or your network connection.";
const RETRY_AFTER_HEADER: &str = "retry-after";

fn is_loopback_host(host: &str) -> bool {
    host.eq_ignore_ascii_case("localhost")
        || host.parse::<IpAddr>().is_ok_and(|ip| ip.is_loopback())
}

fn any_loopback_socket_accepts_connection(addrs: impl IntoIterator<Item = SocketAddr>) -> bool {
    addrs
        .into_iter()
        .filter(|addr| addr.ip().is_loopback())
        .any(|addr| TcpStream::connect_timeout(&addr, LOOPBACK_CONNECT_PROBE_TIMEOUT).is_ok())
}

fn is_loopback_connectivity_timeout(error: &reqwest::Error) -> bool {
    if !error.is_timeout() {
        return false;
    }

    let Some(url) = error.url() else {
        return false;
    };
    let Some(host) = url.host_str() else {
        return false;
    };
    let Some(port) = url.port_or_known_default() else {
        return false;
    };

    if !is_loopback_host(host) {
        return false;
    }

    let Ok(socket_addrs) = (host, port).to_socket_addrs() else {
        return false;
    };

    !any_loopback_socket_accepts_connection(socket_addrs)
}

fn contains_dns_error_marker(normalized_message: &str) -> bool {
    DNS_RESOLUTION_ERROR_MARKERS
        .iter()
        .any(|marker| normalized_message.contains(marker))
}

#[derive(Debug, Default)]
struct NetworkErrorClassificationInput<'a> {
    message: &'a str,
    has_resolution_failed: bool,
    has_dns_error_marker: bool,
    is_loopback_connectivity_timeout: bool,
    is_timeout: bool,
    is_connect: bool,
}

fn classify_network_error(input: NetworkErrorClassificationInput<'_>) -> String {
    if input.has_resolution_failed || input.has_dns_error_marker {
        return DNS_RESOLUTION_ERROR_MESSAGE.to_string();
    }

    if input.is_loopback_connectivity_timeout {
        return CONNECTIVITY_ERROR_MESSAGE.to_string();
    }

    if input.is_timeout {
        return TIMEOUT_ERROR_MESSAGE.to_string();
    }

    if input.is_connect {
        return CONNECTIVITY_ERROR_MESSAGE.to_string();
    }

    redact_sensitive_network_error_message(input.message)
}

fn classify_reqwest_network_error(error: &reqwest::Error) -> String {
    let message = error.to_string();
    let normalized = message.to_ascii_lowercase();

    classify_network_error(NetworkErrorClassificationInput {
        message: &message,
        has_resolution_failed: false,
        has_dns_error_marker: contains_dns_error_marker(&normalized),
        is_loopback_connectivity_timeout: is_loopback_connectivity_timeout(error),
        is_timeout: error.is_timeout(),
        is_connect: error.is_connect(),
    })
}

fn redact_sensitive_network_error_message(message: &str) -> String {
    message
        .split_whitespace()
        .map(redact_sensitive_url_token)
        .collect::<Vec<_>>()
        .join(" ")
}

fn redact_sensitive_url_token(token: &str) -> String {
    let trimmed_start = token.trim_start_matches(['"', '\'', '(', '[']);
    let prefix_len = token.len() - trimmed_start.len();
    let trimmed = trimmed_start.trim_end_matches(|c| {
        matches!(
            c,
            '"' | '\''
                | ')'
                | ']'
                | ','
                | '.'
                | ';'
                | ':'
                | '。'
                | '、'
                | '，'
                | '．'
                | '！'
                | '？'
        )
    });
    let suffix_len = trimmed_start.len() - trimmed.len();

    let Ok(mut url) = reqwest::Url::parse(trimmed) else {
        return token.to_string();
    };

    if url.scheme() != "http" && url.scheme() != "https" {
        return token.to_string();
    }

    let has_userinfo = !url.username().is_empty() || url.password().is_some();
    if !has_userinfo && url.query().is_none() && url.fragment().is_none() {
        return token.to_string();
    }

    if has_userinfo {
        let _ = url.set_username("");
        let _ = url.set_password(None);
    }
    url.set_query(url.query().map(|_| "redacted"));
    if url.fragment().is_some() {
        url.set_fragment(Some("redacted"));
    }

    format!(
        "{}{}{}",
        &token[..prefix_len],
        url,
        &token[token.len() - suffix_len..]
    )
}

impl DomainError {
    pub(crate) fn from_provider_http_status(status: StatusCode) -> Self {
        let message = format!("HTTP {status}");
        match status {
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => Self::Auth(message),
            StatusCode::TOO_MANY_REQUESTS => Self::RateLimit(message),
            _ => Self::Network(message),
        }
    }

    pub(crate) fn from_provider_http_response_status(
        status: StatusCode,
        headers: &HeaderMap,
    ) -> Self {
        let Some(retry_after_seconds) = retry_after_seconds(headers) else {
            return Self::from_provider_http_status(status);
        };

        match status {
            StatusCode::TOO_MANY_REQUESTS => Self::RateLimit(format!(
                "HTTP {status}; retry_after_seconds={retry_after_seconds}"
            )),
            _ => Self::from_provider_http_status(status),
        }
    }

    pub(crate) fn from_provider_http_error(error: reqwest::Error) -> Self {
        if let Some(status) = error.status() {
            return Self::from_provider_http_status(status);
        }

        Self::Network(classify_reqwest_network_error(&error))
    }
}

fn retry_after_seconds(headers: &HeaderMap) -> Option<u64> {
    let value = headers.get(RETRY_AFTER_HEADER)?.to_str().ok()?.trim();
    if value.is_empty() {
        return None;
    }

    if let Ok(seconds) = value.parse::<u64>() {
        return Some(seconds);
    }

    let retry_at = chrono::DateTime::parse_from_rfc2822(value).ok()?;
    let now = chrono::Utc::now();
    let seconds = retry_at
        .with_timezone(&chrono::Utc)
        .signed_duration_since(now)
        .num_seconds();
    Some(seconds.max(0) as u64)
}

impl From<rusqlite::Error> for DomainError {
    fn from(e: rusqlite::Error) -> Self {
        Self::Persistence(e.to_string())
    }
}

impl From<reqwest::Error> for DomainError {
    fn from(e: reqwest::Error) -> Self {
        Self::from_provider_http_error(e)
    }
}

#[cfg(test)]
mod tests {
    use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, TcpListener};

    use super::{
        any_loopback_socket_accepts_connection, classify_network_error,
        redact_sensitive_network_error_message, DomainError, NetworkErrorClassificationInput,
    };
    use crate::commands::dto::AppError;
    use reqwest::{
        header::{HeaderMap, HeaderValue, RETRY_AFTER},
        StatusCode,
    };

    #[test]
    fn network_error_classification_maps_resolution_failures_to_actionable_message() {
        assert_eq!(
            classify_network_error(NetworkErrorClassificationInput {
                message: "request failed before DNS resolution",
                has_resolution_failed: true,
                ..NetworkErrorClassificationInput::default()
            }),
            "Could not resolve the server name. Check the server URL or your DNS/network settings."
        );
    }

    #[test]
    fn network_error_classification_maps_dns_markers_to_actionable_message() {
        assert_eq!(
            classify_network_error(NetworkErrorClassificationInput {
                message: "request failed without a URL",
                has_dns_error_marker: true,
                ..NetworkErrorClassificationInput::default()
            }),
            "Could not resolve the server name. Check the server URL or your DNS/network settings."
        );
    }

    #[test]
    fn network_error_classification_keeps_loopback_connectivity_timeout_as_connectivity_failure() {
        assert_eq!(
            classify_network_error(NetworkErrorClassificationInput {
                message: "request timed out while probing a closed loopback port",
                is_loopback_connectivity_timeout: true,
                is_timeout: true,
                ..NetworkErrorClassificationInput::default()
            }),
            "Could not connect to the server. Check the server URL and whether the server is reachable."
        );
    }

    #[test]
    fn network_error_classification_maps_response_timeouts_to_timeout_message() {
        assert_eq!(
            classify_network_error(NetworkErrorClassificationInput {
                message: "request timed out waiting for a response",
                is_timeout: true,
                ..NetworkErrorClassificationInput::default()
            }),
            "Request timed out. Check the server URL or your network connection."
        );
    }

    #[test]
    fn network_error_classification_maps_connect_errors_to_connectivity_failure() {
        assert_eq!(
            classify_network_error(NetworkErrorClassificationInput {
                message: "connection refused",
                is_connect: true,
                ..NetworkErrorClassificationInput::default()
            }),
            "Could not connect to the server. Check the server URL and whether the server is reachable."
        );
    }

    #[test]
    fn network_error_classification_redacts_fallback_messages() {
        assert_eq!(
            classify_network_error(NetworkErrorClassificationInput {
                message: "request failed for https://example.test/feed?token=secret#section",
                ..NetworkErrorClassificationInput::default()
            }),
            "request failed for https://example.test/feed?redacted#redacted"
        );
    }

    #[test]
    fn fallback_network_errors_do_not_surface_sensitive_url_parts_as_retryable_messages() {
        let message = classify_network_error(NetworkErrorClassificationInput {
            message: "request failed for https://example.test/feed?token=secret-token&api_key=raw-key#access-token",
            ..NetworkErrorClassificationInput::default()
        });

        assert!(!message.is_empty());
        assert!(!message.contains("secret-token"));
        assert!(!message.contains("raw-key"));
        assert!(!message.contains("access-token"));

        match AppError::from(DomainError::Network(message)) {
            AppError::Retryable { message } => {
                assert!(!message.contains("secret-token"));
                assert!(!message.contains("raw-key"));
                assert!(!message.contains("access-token"));
            }
            AppError::UserVisible { message } => {
                panic!("network fallback errors should remain retryable: {message}");
            }
        }
    }

    #[test]
    fn loopback_probe_checks_all_resolved_addresses_before_classifying_connectivity_failure() {
        let listener =
            TcpListener::bind("127.0.0.1:0").expect("listener should bind to an ephemeral port");
        let port = listener
            .local_addr()
            .expect("listener should expose its bound address")
            .port();
        let addrs = [
            SocketAddr::new(IpAddr::V6(Ipv6Addr::LOCALHOST), port),
            SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port),
        ];

        assert!(any_loopback_socket_accepts_connection(addrs));
    }

    #[test]
    fn sqlite_errors_map_to_persistence_and_user_visible_app_errors() {
        let domain_error = DomainError::from(rusqlite::Error::QueryReturnedNoRows);

        assert!(matches!(domain_error, DomainError::Persistence(_)));
        assert_eq!(
            domain_error.to_string(),
            "Persistence error: Query returned no rows"
        );

        let app_error = AppError::from(DomainError::from(rusqlite::Error::QueryReturnedNoRows));

        match app_error {
            AppError::UserVisible { message } => {
                assert_eq!(message, "Persistence error: Query returned no rows");
            }
            AppError::Retryable { message } => {
                panic!("sqlite persistence errors must not become retryable: {message}");
            }
        }
    }

    #[test]
    fn provider_boundary_errors_keep_internal_kind_and_user_visible_messages() {
        let cases = [
            (
                DomainError::Auth("invalid credentials".to_string()),
                "Auth error: invalid credentials",
            ),
            (
                DomainError::Validation("missing feed url".to_string()),
                "Validation error: missing feed url",
            ),
            (
                DomainError::Parse("invalid feed document".to_string()),
                "Parse error: invalid feed document",
            ),
        ];

        for (domain_error, expected_message) in cases {
            match &domain_error {
                DomainError::Auth(_) | DomainError::Validation(_) | DomainError::Parse(_) => {}
                other => panic!("unexpected provider boundary error kind: {other:?}"),
            }

            assert_eq!(domain_error.to_string(), expected_message);

            match AppError::from(domain_error) {
                AppError::UserVisible { message } => {
                    assert_eq!(message, expected_message);
                }
                AppError::Retryable { message } => {
                    panic!("provider boundary errors must not become retryable: {message}");
                }
            }
        }
    }

    #[test]
    fn provider_boundary_errors_keep_category_and_recovery_surface() {
        let cases = [
            (
                DomainError::Network(
                    "Could not resolve the server name. Check the server URL or your DNS/network settings."
                        .to_string(),
                ),
                "Network error: Could not resolve the server name. Check the server URL or your DNS/network settings.",
                true,
                true,
            ),
            (
                DomainError::Network(
                    "Request timed out. Check the server URL or your network connection."
                        .to_string(),
                ),
                "Network error: Request timed out. Check the server URL or your network connection.",
                true,
                true,
            ),
            (
                DomainError::Auth("HTTP 401 Unauthorized".to_string()),
                "Auth error: HTTP 401 Unauthorized",
                false,
                false,
            ),
            (
                DomainError::RateLimit("HTTP 429 Too Many Requests".to_string()),
                "Rate limit error: HTTP 429 Too Many Requests",
                true,
                false,
            ),
            (
                DomainError::Parse("malformed provider response".to_string()),
                "Parse error: malformed provider response",
                false,
                false,
            ),
        ];

        for (domain_error, expected_message, expected_retryable, expected_recovery_guidance) in
            cases
        {
            assert_eq!(domain_error.to_string(), expected_message);
            assert_eq!(
                matches!(AppError::from(domain_error), AppError::Retryable { .. }),
                expected_retryable
            );
            assert_eq!(
                expected_message.contains("Check "),
                expected_recovery_guidance,
                "recovery guidance presence changed for {expected_message}"
            );
        }
    }

    #[test]
    fn provider_http_status_errors_keep_domain_failure_kinds() {
        let cases = [
            (
                StatusCode::UNAUTHORIZED,
                DomainError::Auth("HTTP 401 Unauthorized".to_string()),
                false,
            ),
            (
                StatusCode::FORBIDDEN,
                DomainError::Auth("HTTP 403 Forbidden".to_string()),
                false,
            ),
            (
                StatusCode::TOO_MANY_REQUESTS,
                DomainError::RateLimit("HTTP 429 Too Many Requests".to_string()),
                true,
            ),
            (
                StatusCode::BAD_GATEWAY,
                DomainError::Network("HTTP 502 Bad Gateway".to_string()),
                true,
            ),
        ];

        for (status, expected_error, expected_retryable) in cases {
            let domain_error = DomainError::from_provider_http_status(status);

            assert_eq!(domain_error.to_string(), expected_error.to_string());
            assert_eq!(
                matches!(AppError::from(domain_error), AppError::Retryable { .. }),
                expected_retryable
            );
        }
    }

    #[test]
    fn provider_http_status_429_includes_retry_after_seconds_when_present() {
        let mut headers = HeaderMap::new();
        headers.insert(RETRY_AFTER, HeaderValue::from_static("120"));

        let domain_error = DomainError::from_provider_http_response_status(
            StatusCode::TOO_MANY_REQUESTS,
            &headers,
        );

        assert_eq!(
            domain_error.to_string(),
            "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=120"
        );
    }

    #[test]
    fn provider_http_status_429_ignores_invalid_retry_after() {
        let mut headers = HeaderMap::new();
        headers.insert(RETRY_AFTER, HeaderValue::from_static("not-a-date"));

        let domain_error = DomainError::from_provider_http_response_status(
            StatusCode::TOO_MANY_REQUESTS,
            &headers,
        );

        assert_eq!(
            domain_error.to_string(),
            "Rate limit error: HTTP 429 Too Many Requests"
        );
    }

    #[test]
    fn network_error_message_redacts_url_query_and_fragment_values() {
        let message = redact_sensitive_network_error_message(
            "request failed for https://example.com/feed?token=secret-token&api_key=raw-key#access_token=fragment-token",
        );

        assert_eq!(
            message,
            "request failed for https://example.com/feed?redacted#redacted"
        );
        assert!(!message.contains("secret-token"));
        assert!(!message.contains("raw-key"));
        assert!(!message.contains("fragment-token"));
    }

    #[test]
    fn network_error_message_redacts_punctuated_sensitive_urls() {
        let message = redact_sensitive_network_error_message(
            "retryable error (https://example.com/path?password=hunter2), next retry soon",
        );

        assert_eq!(
            message,
            "retryable error (https://example.com/path?redacted), next retry soon"
        );
        assert!(!message.contains("hunter2"));
    }

    #[test]
    fn network_error_message_redacts_unicode_punctuated_sensitive_urls() {
        let message = redact_sensitive_network_error_message(
            "接続失敗: https://example.com/path?password=hunter2。",
        );

        assert_eq!(message, "接続失敗: https://example.com/path?redacted。");
        assert!(!message.contains("hunter2"));
    }

    #[test]
    fn network_error_message_redacts_multiline_sensitive_urls() {
        let message = redact_sensitive_network_error_message(
            "request failed:\nhttps://example.com/path?token=secret-token\nretry later",
        );

        assert_eq!(
            message,
            "request failed: https://example.com/path?redacted retry later"
        );
        assert!(!message.contains("secret-token"));
    }

    #[test]
    fn network_error_message_redacts_url_userinfo_credentials() {
        let message = redact_sensitive_network_error_message(
            "request failed for https://alice:hunter2@example.com/feed",
        );

        assert_eq!(message, "request failed for https://example.com/feed");
        assert!(!message.contains("alice"));
        assert!(!message.contains("hunter2"));
    }

    #[test]
    fn network_error_message_redacts_userinfo_with_query_and_fragment() {
        let message = redact_sensitive_network_error_message(
            "request failed for https://alice:hunter2@example.com/feed?token=secret#frag",
        );

        assert_eq!(
            message,
            "request failed for https://example.com/feed?redacted#redacted"
        );
        assert!(!message.contains("alice"));
        assert!(!message.contains("hunter2"));
        assert!(!message.contains("secret"));
    }
}
