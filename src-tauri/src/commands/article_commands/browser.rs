use reqwest::header::{HeaderMap, CONTENT_SECURITY_POLICY, X_FRAME_OPTIONS};
use std::collections::HashSet;
use std::net::SocketAddr;
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use crate::commands::dto::AppError;
use crate::domain::error::DomainError;
use crate::domain::url_policy::validate_public_http_url;

pub(crate) const BROWSER_EMBED_SUPPORT_REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
pub(crate) const DOWNGRADE_REDIRECT_VALIDATION_MESSAGE: &str =
    "HTTPS to HTTP redirects are not allowed";
static BROWSER_OPEN_QUEUE: OnceLock<Mutex<HashSet<BrowserOpenQueueKey>>> = OnceLock::new();

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub(crate) struct BrowserOpenQueueKey {
    pub(crate) url: String,
}

pub(crate) struct BrowserOpenQueueGuard<'a> {
    queue: &'a Mutex<HashSet<BrowserOpenQueueKey>>,
    key: BrowserOpenQueueKey,
    acquired: bool,
}

impl Drop for BrowserOpenQueueGuard<'_> {
    fn drop(&mut self) {
        if !self.acquired {
            return;
        }

        match self.queue.lock() {
            Ok(mut queue) => {
                queue.remove(&self.key);
            }
            Err(error) => {
                tracing::error!("Browser open queue mutex poisoned while releasing: {error}");
            }
        }
    }
}

#[tauri::command]
pub fn open_in_browser(url: String, background: Option<bool>) -> Result<(), AppError> {
    let parsed_url = parse_public_browser_http_url(&url)?;
    let platform_info = crate::platform::PlatformInfo::current();
    let background =
        should_use_background_browser_open(background.unwrap_or(false), &platform_info);
    let normalized_url = parsed_url.to_string();
    let Some(_open_guard) = acquire_browser_open_queue_guard(&normalized_url)? else {
        tracing::debug!(
            url = %crate::commands::redacted_browser_url_for_display(&normalized_url),
            background,
            "skipping duplicate in-flight browser open"
        );
        return Ok(());
    };

    if background {
        open_browser_in_background(&normalized_url)?;
    } else {
        open::that(&normalized_url).map_err(|e| AppError::UserVisible {
            message: native_browser_open_failure_message(e),
        })?;
    }
    Ok(())
}

pub(crate) fn parse_public_browser_http_url(url: &str) -> Result<reqwest::Url, AppError> {
    let parsed_url = crate::commands::parse_browser_http_url(url)?;
    // External-browser open only hands the URL to the OS browser (no app-side
    // fetch), so it keeps literal-IP validation and must not incur DNS resolution
    // or fail-closed behavior. The app-side fetch entry (check_browser_embed_support)
    // resolves and pins separately via resolve_validated_public_addrs.
    validate_public_http_url(&parsed_url).map_err(|error| match error {
        DomainError::Validation(message) => AppError::UserVisible { message },
        other => AppError::from(other),
    })?;
    Ok(parsed_url)
}

pub(crate) fn acquire_browser_open_queue_guard(
    url: &str,
) -> Result<Option<BrowserOpenQueueGuard<'static>>, AppError> {
    acquire_browser_open_queue_guard_from(
        browser_open_queue(),
        BrowserOpenQueueKey {
            url: url.to_string(),
        },
    )
}

pub(crate) fn acquire_browser_open_queue_guard_from(
    queue: &'static Mutex<HashSet<BrowserOpenQueueKey>>,
    key: BrowserOpenQueueKey,
) -> Result<Option<BrowserOpenQueueGuard<'static>>, AppError> {
    let acquired = queue
        .lock()
        .map_err(|error| {
            tracing::error!("Browser open queue mutex poisoned: {error}");
            AppError::UserVisible {
                message: crate::commands::APP_STATE_POISONED_ERROR.to_string(),
            }
        })?
        .insert(key.clone());

    Ok(acquired.then_some(BrowserOpenQueueGuard {
        queue,
        key,
        acquired,
    }))
}

pub(crate) fn browser_open_queue() -> &'static Mutex<HashSet<BrowserOpenQueueKey>> {
    BROWSER_OPEN_QUEUE.get_or_init(|| Mutex::new(HashSet::new()))
}

pub(crate) fn should_use_background_browser_open(
    background_requested: bool,
    info: &crate::platform::PlatformInfo,
) -> bool {
    background_requested && info.capabilities.supports_background_browser_open
}

pub(crate) fn background_browser_open_failure_message(error: impl std::fmt::Display) -> String {
    native_browser_open_diagnostics_message(format_args!("background open failed: {error}"))
}

pub(crate) fn native_browser_open_failure_message(error: impl std::fmt::Display) -> String {
    native_browser_open_diagnostics_message(format_args!("default open failed: {error}"))
}

pub(crate) fn native_browser_open_diagnostics_message(error: impl std::fmt::Display) -> String {
    let diagnostics = crate::commands::redacted_browser_diagnostic_text(&error.to_string());
    format!("Failed to open browser; native opener diagnostics: {diagnostics}")
}

pub(crate) fn background_browser_open_status_failure_message(
    status: std::process::ExitStatus,
    stderr: &[u8],
) -> String {
    let details = String::from_utf8_lossy(stderr).trim().to_string();
    if details.is_empty() {
        background_browser_open_failure_message(format!("open exited with status {status}"))
    } else {
        background_browser_open_failure_message(format!(
            "open exited with status {status}: {details}"
        ))
    }
}

pub(crate) fn open_browser_in_background_with_command(
    command: &mut Command,
) -> Result<(), AppError> {
    let output = command.output().map_err(|e| AppError::UserVisible {
        message: background_browser_open_failure_message(e),
    })?;

    if output.status.success() {
        return Ok(());
    }

    Err(AppError::UserVisible {
        message: background_browser_open_status_failure_message(output.status, &output.stderr),
    })
}

pub(crate) fn open_browser_in_background(url: &str) -> Result<(), AppError> {
    // macOS: use `open -g` to open in background while still observing
    // LaunchServices failures from the child process.
    open_browser_in_background_with_command(Command::new("open").arg("-g").arg(url))
}

pub(crate) fn has_blocking_x_frame_options(headers: &HeaderMap) -> bool {
    headers
        .get_all(X_FRAME_OPTIONS)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .map(str::trim)
        .any(|value| !value.is_empty())
}

pub(crate) fn has_blocking_frame_ancestors(headers: &HeaderMap) -> bool {
    headers
        .get_all(CONTENT_SECURITY_POLICY)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .any(|policy| {
            policy
                .split(';')
                .map(str::trim)
                .find_map(|directive| {
                    let (name, value) = directive.split_once(char::is_whitespace)?;
                    name.eq_ignore_ascii_case("frame-ancestors")
                        .then_some(value)
                })
                .map(|value| {
                    let sources = value
                        .split_whitespace()
                        .map(|source| source.trim_matches('"').trim_matches('\''));
                    !sources.into_iter().any(|source| source == "*")
                })
                .unwrap_or(false)
        })
}

#[tauri::command]
pub async fn check_browser_embed_support(url: String) -> Result<bool, AppError> {
    check_browser_embed_support_with_timeout(url, BROWSER_EMBED_SUPPORT_REQUEST_TIMEOUT).await
}

pub(crate) async fn check_browser_embed_support_with_timeout(
    url: String,
    timeout: Duration,
) -> Result<bool, AppError> {
    let url = parse_public_browser_http_url(&url)?;
    // Resolve and pin the validated public addresses so the fetch connects to the
    // same addresses that passed validation, closing the DNS-rebinding window
    // between validation and connect.
    let resolved_addrs = crate::infra::feed_discovery::resolve_validated_public_addrs(&url)
        .map_err(|error| match error {
            DomainError::Validation(message) => AppError::UserVisible { message },
            other => AppError::from(other),
        })?;
    check_browser_embed_support_for_url(url, timeout, &resolved_addrs).await
}

pub(crate) async fn check_browser_embed_support_for_url(
    url: reqwest::Url,
    timeout: Duration,
    resolved_addrs: &[SocketAddr],
) -> Result<bool, AppError> {
    let mut builder = reqwest::Client::builder()
        .redirect(browser_embed_redirect_policy())
        .timeout(timeout);
    // Pin the connection to the validated addresses when present. Direct callers
    // (unit tests hitting a local mock server) pass an empty slice to preserve the
    // original unpinned behavior.
    if !resolved_addrs.is_empty() {
        if let Some(host) = url.host_str() {
            builder = builder.resolve_to_addrs(host, resolved_addrs);
        }
    }
    let client = builder.build().map_err(DomainError::from)?;

    let response = match client
        .head(url.as_str())
        .send()
        .await
        .map_err(DomainError::from)?
    {
        head_response if head_response.status().is_success() => head_response,
        _ => client
            .get(url.as_str())
            .send()
            .await
            .map_err(DomainError::from)?,
    };

    if !response.status().is_success() {
        return Ok(false);
    }

    let headers = response.headers();
    Ok(!(has_blocking_x_frame_options(headers) || has_blocking_frame_ancestors(headers)))
}

pub(crate) fn browser_embed_redirect_policy() -> reqwest::redirect::Policy {
    reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() > 5 {
            return attempt.error("too many redirects");
        }

        match validate_browser_embed_redirect(attempt.previous(), attempt.url()) {
            Ok(()) => attempt.follow(),
            Err(error) => attempt.error(error.to_string()),
        }
    })
}

pub(crate) fn validate_browser_embed_redirect(
    previous_urls: &[reqwest::Url],
    next_url: &reqwest::Url,
) -> Result<(), DomainError> {
    crate::infra::feed_discovery::validate_discovery_request_url(next_url)?;

    if previous_urls
        .last()
        .is_some_and(|previous| previous.scheme() == "https" && next_url.scheme() == "http")
    {
        return Err(DomainError::Validation(
            DOWNGRADE_REDIRECT_VALIDATION_MESSAGE.to_string(),
        ));
    }

    Ok(())
}
