use reqwest::StatusCode;
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

fn has_resolution_failed(error: &reqwest::Error) -> bool {
    error.url().is_some_and(|url| {
        let Some(host) = url.host_str() else {
            return false;
        };
        let Some(port) = url.port_or_known_default() else {
            return false;
        };

        (host, port).to_socket_addrs().is_err()
    })
}

fn contains_dns_error_marker(normalized_message: &str) -> bool {
    DNS_RESOLUTION_ERROR_MARKERS
        .iter()
        .any(|marker| normalized_message.contains(marker))
}

fn classify_reqwest_network_error(error: &reqwest::Error) -> String {
    let message = error.to_string();
    let normalized = message.to_ascii_lowercase();

    if has_resolution_failed(error) || contains_dns_error_marker(&normalized) {
        return DNS_RESOLUTION_ERROR_MESSAGE.to_string();
    }

    if is_loopback_connectivity_timeout(error) {
        return CONNECTIVITY_ERROR_MESSAGE.to_string();
    }

    if error.is_timeout() {
        return TIMEOUT_ERROR_MESSAGE.to_string();
    }

    if error.is_connect() {
        return CONNECTIVITY_ERROR_MESSAGE.to_string();
    }

    redact_sensitive_network_error_message(&message)
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
    let trimmed = trimmed_start.trim_end_matches(['"', '\'', ')', ']', ',', '.', ';', ':']);
    let suffix_len = trimmed_start.len() - trimmed.len();

    let Ok(mut url) = reqwest::Url::parse(trimmed) else {
        return token.to_string();
    };

    if url.scheme() != "http" && url.scheme() != "https" {
        return token.to_string();
    }

    if url.query().is_none() && url.fragment().is_none() {
        return token.to_string();
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

    pub(crate) fn from_provider_http_error(error: reqwest::Error) -> Self {
        if let Some(status) = error.status() {
            return Self::from_provider_http_status(status);
        }

        Self::Network(classify_reqwest_network_error(&error))
    }
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
    use std::time::Duration;

    use super::{
        any_loopback_socket_accepts_connection, redact_sensitive_network_error_message, DomainError,
    };
    use crate::commands::dto::AppError;
    use reqwest::StatusCode;

    #[tokio::test]
    async fn reqwest_dns_errors_are_mapped_to_actionable_message() {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("client should build");

        let error = client
            .post("http://nonexistent.invalid/api/greader.php/accounts/ClientLogin")
            .send()
            .await
            .expect_err("request should fail");

        let domain_error = DomainError::from(error);

        assert_eq!(
            domain_error.to_string(),
            "Network error: Could not resolve the server name. Check the server URL or your DNS/network settings."
        );
    }

    #[tokio::test]
    async fn reqwest_connect_errors_remain_connectivity_failures() {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("client should build");

        let listener =
            TcpListener::bind("127.0.0.1:0").expect("listener should bind to an ephemeral port");
        let port = listener
            .local_addr()
            .expect("listener should expose its bound address")
            .port();
        drop(listener);

        let error = client
            .post(format!(
                "http://127.0.0.1:{port}/api/greader.php/accounts/ClientLogin"
            ))
            .send()
            .await
            .expect_err("request should fail");

        let domain_error = DomainError::from(error);

        assert_eq!(
            domain_error.to_string(),
            "Network error: Could not connect to the server. Check the server URL and whether the server is reachable."
        );
    }

    #[tokio::test]
    async fn reqwest_loopback_response_timeouts_remain_timeout_failures() {
        let listener =
            TcpListener::bind("127.0.0.1:0").expect("listener should bind to an ephemeral port");
        let port = listener
            .local_addr()
            .expect("listener should expose its bound address")
            .port();

        let accept_task = tokio::task::spawn_blocking(move || {
            let (_stream, _addr) = listener
                .accept()
                .expect("listener should accept one client");
            std::thread::sleep(Duration::from_millis(350));
        });

        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(100))
            .build()
            .expect("client should build");

        let error = client
            .post(format!(
                "http://127.0.0.1:{port}/api/greader.php/accounts/ClientLogin"
            ))
            .send()
            .await
            .expect_err("request should time out waiting for a response");

        let domain_error = DomainError::from(error);

        assert_eq!(
            domain_error.to_string(),
            "Network error: Request timed out. Check the server URL or your network connection."
        );

        accept_task
            .await
            .expect("accept task should finish cleanly");
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
}
