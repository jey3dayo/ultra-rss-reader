use reqwest::{header::HeaderMap, StatusCode};
use serde::Serialize;
use std::net::{IpAddr, SocketAddr, TcpStream, ToSocketAddrs};
use std::time::Duration;
use thiserror::Error;

pub const PROVIDER_RETRY_AFTER_MAX_SECONDS: u64 = 3_600;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CredentialTarget {
    Password,
    CloudflareAccess,
}

/// What happened to a credential operation, as the UI distinguishes it. `Canceled` is only set
/// when the OS reported a user cancellation; an opaque CLI exit is `NotAllowed`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CredentialFailureCause {
    ReadFailed,
    WriteFailed,
    Canceled,
    NotAllowed,
    Unverified,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct CredentialFailure {
    pub target: CredentialTarget,
    pub cause: CredentialFailureCause,
}

impl CredentialFailure {
    pub fn new(target: CredentialTarget, cause: CredentialFailureCause) -> Self {
        Self { target, cause }
    }
}

#[derive(Debug, Clone, Error)]
pub enum DomainError {
    #[error("Network error: {0}")]
    Network(String),
    #[error("Rate limit error: {0}")]
    RateLimit(String),
    #[error("Rate limit error: {message}; retry_after_seconds={retry_after_seconds}")]
    RateLimitWithRetryAfter {
        message: String,
        retry_after_seconds: u64,
    },
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
    #[error("Keychain error: {message}")]
    CredentialStore {
        failure: CredentialFailure,
        message: String,
    },
    #[error("Migration error: {0}")]
    Migration(String),
}

pub type DomainResult<T> = Result<T, DomainError>;

// ProviderBlockResponseContract uses this type for provider-only user-action
// labels. It is not the application-wide recovery classifier; the runtime UI
// recovery surface is owned by src/lib/ui-errors.ts and related TS owners.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppRecoveryAction {
    Retry,
    WaitForRetryWindow,
    EditAccountSettings,
    FixInput,
    CheckLogs,
    RunIntegrityCheck,
    RestoreBackup,
    CheckOsPermissions,
    PreserveBackupAndRestart,
}

// Test-only provider response policy. Runtime HTTP classification is owned by
// DomainError's provider mapping and sync warning DTOs; the durable recovery
// guidance is documented in docs/incident-runbook.md and
// docs/feed-content-privacy.md.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProviderBlockResponseContract {
    pub status: StatusCode,
    pub uses_sync_backoff: bool,
    pub primary_user_action: AppRecoveryAction,
    pub manual_retry_allowed: bool,
}

pub fn provider_block_response_contract(
    status: StatusCode,
) -> Option<ProviderBlockResponseContract> {
    let (uses_sync_backoff, primary_user_action, manual_retry_allowed) = match status {
        StatusCode::FORBIDDEN => (true, AppRecoveryAction::EditAccountSettings, false),
        StatusCode::TOO_MANY_REQUESTS => (true, AppRecoveryAction::WaitForRetryWindow, false),
        StatusCode::UNAVAILABLE_FOR_LEGAL_REASONS => (true, AppRecoveryAction::FixInput, false),
        StatusCode::SERVICE_UNAVAILABLE => (true, AppRecoveryAction::Retry, true),
        _ => return None,
    };

    Some(ProviderBlockResponseContract {
        status,
        uses_sync_backoff,
        primary_user_action,
        manual_retry_allowed,
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlatformPermissionDeniedSurface {
    File,
    Dialog,
    Keyring,
    Clipboard,
}

pub fn platform_permission_denied_user_action(
    surface: PlatformPermissionDeniedSurface,
) -> &'static str {
    match surface {
        PlatformPermissionDeniedSurface::File => {
            "Choose a writable location or allow file access in the OS privacy settings."
        }
        PlatformPermissionDeniedSurface::Dialog => {
            "Allow the OS file dialog and choose the file again."
        }
        PlatformPermissionDeniedSurface::Keyring => {
            "Allow keyring access, then save or reconnect the account again."
        }
        PlatformPermissionDeniedSurface::Clipboard => {
            "Allow clipboard access, or copy the redacted log excerpt manually."
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FrontendNetworkSignal {
    Offline,
    Online,
}

// Test-only network-signal policy. Frontend online/offline state is only a
// trigger hint; native provider classification remains authoritative. The
// durable policy is documented in docs/incident-runbook.md.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NetworkSignalContract {
    pub frontend_signal: FrontendNetworkSignal,
    pub native_error_classification_is_authoritative: bool,
    pub suppresses_automatic_background_attempts: bool,
    pub allows_manual_retry: bool,
}

pub fn network_signal_contract(frontend_signal: FrontendNetworkSignal) -> NetworkSignalContract {
    NetworkSignalContract {
        frontend_signal,
        native_error_classification_is_authoritative: true,
        suppresses_automatic_background_attempts: matches!(
            frontend_signal,
            FrontendNetworkSignal::Offline
        ),
        allows_manual_retry: true,
    }
}

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
const TLS_CERTIFICATE_ERROR_MARKERS: &[&str] = &[
    "certificate has expired",
    "cert has expired",
    "certificate expired",
    "self signed certificate",
    "self-signed certificate",
    "unknown issuer",
    "certificate verify failed",
    "invalid certificate",
];
const TLS_CERTIFICATE_ERROR_MESSAGE: &str =
    "Could not verify the server certificate. Check the server certificate or account URL.";
const CONNECTION_RESET_ERROR_MARKERS: &[&str] = &[
    "connection reset",
    "connection aborted",
    "connection closed before message completed",
];
const CONNECTION_RESET_ERROR_MESSAGE: &str =
    "The server closed the connection unexpectedly. Check the server status and try again.";
const CONNECTIVITY_ERROR_MESSAGE: &str =
    "Could not connect to the server. Check the server URL and whether the server is reachable.";
const TIMEOUT_ERROR_MESSAGE: &str =
    "Request timed out. Check the server URL or your network connection.";
const RETRY_AFTER_HEADER: &str = "retry-after";
const SENSITIVE_HEADER_MARKERS: &[&str] = &[
    "authorization:",
    "proxy-authorization:",
    "cookie:",
    "set-cookie:",
];
const SENSITIVE_KV_PREFIXES: &[&str] = &["auth=", "token=", "access_token=", "refresh_token="];

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

fn contains_tls_certificate_error_marker(normalized_message: &str) -> bool {
    TLS_CERTIFICATE_ERROR_MARKERS
        .iter()
        .any(|marker| normalized_message.contains(marker))
}

fn contains_connection_reset_error_marker(normalized_message: &str) -> bool {
    CONNECTION_RESET_ERROR_MARKERS
        .iter()
        .any(|marker| normalized_message.contains(marker))
}

#[derive(Debug, Default)]
struct NetworkErrorClassificationInput<'a> {
    message: &'a str,
    has_resolution_failed: bool,
    has_dns_error_marker: bool,
    has_tls_certificate_error_marker: bool,
    has_connection_reset_error_marker: bool,
    is_loopback_connectivity_timeout: bool,
    is_timeout: bool,
    is_connect: bool,
}

fn classify_network_error(input: NetworkErrorClassificationInput<'_>) -> String {
    if input.has_resolution_failed || input.has_dns_error_marker {
        return DNS_RESOLUTION_ERROR_MESSAGE.to_string();
    }

    if input.has_tls_certificate_error_marker {
        return TLS_CERTIFICATE_ERROR_MESSAGE.to_string();
    }

    if input.has_connection_reset_error_marker {
        return CONNECTION_RESET_ERROR_MESSAGE.to_string();
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
        has_tls_certificate_error_marker: contains_tls_certificate_error_marker(&normalized),
        has_connection_reset_error_marker: contains_connection_reset_error_marker(&normalized),
        is_loopback_connectivity_timeout: is_loopback_connectivity_timeout(error),
        is_timeout: error.is_timeout(),
        is_connect: error.is_connect(),
    })
}

fn redact_sensitive_network_error_message(message: &str) -> String {
    redact_sensitive_header_lines(message)
        .split_whitespace()
        .map(redact_sensitive_network_token)
        .collect::<Vec<_>>()
        .join(" ")
}

fn redact_sensitive_header_lines(message: &str) -> String {
    message
        .lines()
        .map(|line| {
            let normalized = line.to_ascii_lowercase();
            let Some((marker, marker_start)) = SENSITIVE_HEADER_MARKERS
                .iter()
                .find_map(|marker| normalized.find(marker).map(|start| (*marker, start)))
            else {
                return line.to_string();
            };
            format!("{}{} <redacted>", &line[..marker_start], marker)
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn redact_sensitive_network_token(token: &str) -> String {
    let url_redacted = redact_sensitive_url_token(token);
    if url_redacted != token {
        return url_redacted;
    }

    redact_sensitive_kv_token(token)
}

fn redact_sensitive_kv_token(token: &str) -> String {
    let lower = token.to_ascii_lowercase();
    if let Some(prefix) = SENSITIVE_KV_PREFIXES
        .iter()
        .find(|prefix| lower.starts_with(**prefix))
    {
        return format!("{prefix}<redacted>");
    }

    token.to_string()
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
            StatusCode::UNAVAILABLE_FOR_LEGAL_REASONS => Self::Validation(message),
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
            StatusCode::TOO_MANY_REQUESTS => Self::RateLimitWithRetryAfter {
                message: format!("HTTP {status}"),
                retry_after_seconds,
            },
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
        return Some(seconds.min(PROVIDER_RETRY_AFTER_MAX_SECONDS));
    }

    let retry_at = chrono::DateTime::parse_from_rfc2822(value).ok()?;
    let now = chrono::Utc::now();
    let seconds = retry_at
        .with_timezone(&chrono::Utc)
        .signed_duration_since(now)
        .num_seconds();
    Some((seconds.max(0) as u64).min(PROVIDER_RETRY_AFTER_MAX_SECONDS))
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
mod tests;
