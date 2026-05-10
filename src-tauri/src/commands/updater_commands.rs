use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};
use tokio::sync::Mutex;
use tracing::warn;

use super::dto::AppError;
use super::{AppState, DATABASE_MAINTENANCE_BUSY_ERROR};

static DOWNLOADING: AtomicBool = AtomicBool::new(false);
static DOWNLOAD_SESSION_ID: AtomicU64 = AtomicU64::new(0);
const UPDATE_CHANNEL_STABLE: &str = "stable";
const UPDATE_SOURCE_LATEST_JSON: &str = "github-latest-json";

pub(crate) struct PendingUpdateHandle {
    update: Update,
    version: String,
    source: String,
}

/// Cached update handle from the last successful check. The version/source
/// metadata is verified again before install so a stale handle cannot be used
/// after a later check cleared or replaced the pending update.
pub struct PendingUpdate(pub(crate) Arc<Mutex<Option<PendingUpdateHandle>>>);

fn clear_pending_update<T>(pending: &mut Option<T>) {
    *pending = None;
}

struct DownloadGuard;

impl DownloadGuard {
    fn acquire() -> Result<Self, AppError> {
        DOWNLOADING
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map(|_| Self)
            .map_err(|_| AppError::UserVisible {
                message: "Update download already in progress".to_string(),
            })
    }
}

impl Drop for DownloadGuard {
    fn drop(&mut self) {
        DOWNLOADING.store(false, Ordering::SeqCst);
    }
}

fn next_download_session_id() -> u64 {
    DOWNLOAD_SESSION_ID.fetch_add(1, Ordering::SeqCst) + 1
}

#[derive(Debug)]
struct SyncInstallGuard<'a>(&'a std::sync::atomic::AtomicBool);

impl<'a> SyncInstallGuard<'a> {
    fn acquire(syncing: &'a std::sync::atomic::AtomicBool) -> Result<Self, AppError> {
        syncing
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map(|_| Self(syncing))
            .map_err(|_| AppError::UserVisible {
                message: DATABASE_MAINTENANCE_BUSY_ERROR.to_string(),
            })
    }
}

impl Drop for SyncInstallGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

#[tauri::command]
pub fn restart_app(app: AppHandle) -> Result<(), AppError> {
    let state = app.state::<AppState>();
    let _guard = SyncInstallGuard::acquire(state.syncing.as_ref())?;
    app.restart()
}

#[derive(Debug, Serialize)]
pub struct UpdateInfo {
    pub version: String,
    pub body: Option<String>,
    pub channel: String,
    pub prerelease: bool,
    pub source: String,
}

#[derive(Debug, Clone, Serialize)]
struct DownloadProgress {
    session_id: u64,
    percent: Option<u8>,
}

#[derive(Debug, Clone, Serialize)]
struct UpdateReady {
    session_id: u64,
}

fn update_event_emit_warning(event: &str, error: &impl std::fmt::Display) -> String {
    format!("Failed to emit {event} event during update flow: {error}")
}

fn emit_update_event_log_only<S>(app: &AppHandle, event: &str, payload: S)
where
    S: Serialize + Clone,
{
    if let Err(error) = app.emit(event, payload) {
        warn!("{}", update_event_emit_warning(event, &error));
    }
}

fn is_prerelease_version(version: &str) -> bool {
    version
        .split_once('-')
        .is_some_and(|(_, pre)| !pre.is_empty())
}

fn parse_semantic_version_parts(version: &str) -> Option<[u64; 3]> {
    let without_build = match version.split_once('+') {
        Some((core, build)) if is_semantic_version_identifier_list(build) => core,
        Some(_) => return None,
        None => version,
    };
    let core = without_build
        .split_once('-')
        .map_or(Some(without_build), |(core, prerelease)| {
            is_semantic_version_identifier_list(prerelease).then_some(core)
        })?;
    let mut parts = core.split('.');
    let major = parse_semantic_version_number(parts.next()?)?;
    let minor = parse_semantic_version_number(parts.next()?)?;
    let patch = parse_semantic_version_number(parts.next()?)?;
    if parts.next().is_some() {
        return None;
    }
    Some([major, minor, patch])
}

fn is_semantic_version_identifier_list(value: &str) -> bool {
    !value.is_empty()
        && value.split('.').all(|part| {
            !part.is_empty()
                && part
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || character == '-')
        })
}

fn parse_semantic_version_number(part: &str) -> Option<u64> {
    if part.is_empty() || (part.len() > 1 && part.starts_with('0')) {
        return None;
    }
    part.parse().ok()
}

fn is_strictly_newer_version(candidate: &str, current: &str) -> Option<bool> {
    let candidate_parts = parse_semantic_version_parts(candidate)?;
    let current_parts = parse_semantic_version_parts(current)?;
    Some(candidate_parts > current_parts)
}

fn update_channel(update: &Update) -> String {
    update
        .raw_json
        .get("channel")
        .and_then(|value| value.as_str())
        .unwrap_or(UPDATE_CHANNEL_STABLE)
        .trim()
        .to_string()
}

fn update_prerelease(update: &Update) -> bool {
    update
        .raw_json
        .get("prerelease")
        .and_then(|value| value.as_bool())
        .unwrap_or_else(|| is_prerelease_version(&update.version))
}

fn update_source(update: &Update) -> String {
    update
        .raw_json
        .get("source")
        .and_then(|value| value.as_str())
        .unwrap_or(UPDATE_SOURCE_LATEST_JSON)
        .trim()
        .to_string()
}

fn update_policy_error(update: &Update) -> Option<String> {
    update_policy_error_parts(
        &update.version,
        &update.current_version,
        &update_channel(update),
        update_prerelease(update),
    )
}

fn update_policy_error_parts(
    version: &str,
    current_version: &str,
    channel: &str,
    prerelease: bool,
) -> Option<String> {
    if channel != UPDATE_CHANNEL_STABLE {
        return Some(format!("Unsupported update channel: {channel}"));
    }

    if prerelease {
        return Some(format!("Prerelease update is not allowed: {version}"));
    }

    let Some(is_newer_version) = is_strictly_newer_version(version, current_version) else {
        return Some(format!(
            "Malformed semantic update version is not allowed: {version} <= {current_version}",
        ));
    };

    if !is_newer_version {
        return Some(format!(
            "Downgrade or same-version update is not allowed: {version} <= {current_version}",
        ));
    }

    None
}

fn make_update_info(update: &Update) -> UpdateInfo {
    UpdateInfo {
        version: update.version.clone(),
        body: update.body.clone(),
        channel: update_channel(update),
        prerelease: update_prerelease(update),
        source: update_source(update),
    }
}

fn make_pending_update_handle(update: Update) -> PendingUpdateHandle {
    PendingUpdateHandle {
        version: update.version.clone(),
        source: update_source(&update),
        update,
    }
}

fn pending_update_metadata_matches(version: &str, source: &str, update: &Update) -> bool {
    version == update.version && source == update_source(update)
}

fn updater_initialization_error_message(error: impl std::fmt::Display) -> String {
    format!("Updater unavailable during manual update check: {error}")
}

fn updater_endpoint_error_message(error: impl std::fmt::Display) -> String {
    format!("Update endpoint unavailable during manual update check: {error}")
}

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<Option<UpdateInfo>, AppError> {
    let pending = app.state::<PendingUpdate>();
    clear_pending_update(&mut *pending.0.lock().await);

    let updater = app.updater().map_err(|e| AppError::Retryable {
        message: updater_initialization_error_message(e),
    })?;

    let update = updater.check().await.map_err(|e| AppError::Retryable {
        message: updater_endpoint_error_message(e),
    })?;

    let update = match update {
        Some(update) => {
            if let Some(message) = update_policy_error(&update) {
                warn!("{message}");
                None
            } else {
                Some(update)
            }
        }
        None => None,
    };

    let info = update.as_ref().map(make_update_info);

    // Cache the update handle for download_and_install_update
    *pending.0.lock().await = update.map(make_pending_update_handle);

    Ok(info)
}

#[tauri::command]
pub async fn download_and_install_update(app: AppHandle) -> Result<(), AppError> {
    let _download_guard = DownloadGuard::acquire()?;
    let state = app.state::<AppState>();
    let _sync_guard = SyncInstallGuard::acquire(state.syncing.as_ref())?;

    do_download_and_install(&app, next_download_session_id()).await
}

async fn do_download_and_install(app: &AppHandle, session_id: u64) -> Result<(), AppError> {
    // Take the cached update handle, falling back to a fresh check if empty
    let pending = app.state::<PendingUpdate>();
    let update = {
        let mut guard = pending.0.lock().await;
        guard.take()
    };

    let pending_update = match update {
        Some(handle) => handle,
        None => {
            let updater = app.updater().map_err(|e| AppError::Retryable {
                message: updater_initialization_error_message(e),
            })?;
            updater
                .check()
                .await
                .map_err(|e| AppError::Retryable {
                    message: updater_endpoint_error_message(e),
                })?
                .ok_or_else(|| AppError::UserVisible {
                    message: "No update available".to_string(),
                })
                .map(make_pending_update_handle)?
        }
    };
    let update = pending_update.update;

    if !pending_update_metadata_matches(&pending_update.version, &pending_update.source, &update) {
        return Err(AppError::UserVisible {
            message: "Pending update handle changed before install".to_string(),
        });
    }

    if let Some(message) = update_policy_error(&update) {
        return Err(AppError::UserVisible { message });
    }

    let app_handle = app.clone();
    let mut total_downloaded: usize = 0;
    let mut last_percent: Option<u8> = None;

    update
        .download_and_install(
            move |chunk_length, content_length| {
                total_downloaded += chunk_length;
                let percent =
                    next_download_progress_percent(total_downloaded, content_length, last_percent);
                last_percent = percent;
                emit_update_event_log_only(
                    &app_handle,
                    "update-download-progress",
                    DownloadProgress {
                        session_id,
                        percent,
                    },
                );
            },
            || {},
        )
        .await
        .map_err(|e| AppError::UserVisible {
            message: format!("Failed to download/install update: {e}"),
        })?;

    // On Windows, download_and_install may restart the app immediately,
    // so this emit may never be reached. The frontend handles both cases:
    // if the app restarts, the user sees the update applied on next launch.
    emit_update_event_log_only(app, "update-ready", UpdateReady { session_id });

    Ok(())
}

fn next_download_progress_percent(
    total_downloaded: usize,
    content_length: Option<u64>,
    last_percent: Option<u8>,
) -> Option<u8> {
    let percent = content_length.and_then(|total| {
        if total == 0 {
            return None;
        }
        Some(((total_downloaded as f64 / total as f64) * 100.0).min(100.0) as u8)
    });
    match (percent, last_percent) {
        (Some(percent), Some(last_percent)) => Some(percent.max(last_percent)),
        (Some(percent), None) => Some(percent),
        (None, last_percent) => last_percent,
    }
}

#[cfg(test)]
mod tests {
    use std::panic;

    use super::{
        clear_pending_update, is_prerelease_version, is_strictly_newer_version,
        next_download_progress_percent, next_download_session_id, parse_semantic_version_parts,
        update_event_emit_warning, update_policy_error_parts, updater_endpoint_error_message,
        updater_initialization_error_message, DownloadGuard, SyncInstallGuard, DOWNLOADING,
        DOWNLOAD_SESSION_ID,
    };
    use crate::commands::dto::AppError;
    use crate::commands::DATABASE_MAINTENANCE_BUSY_ERROR;
    use std::sync::atomic::AtomicBool;
    use std::sync::atomic::Ordering;
    use std::sync::Mutex as StdMutex;

    static UPDATER_COMMAND_TEST_LOCK: StdMutex<()> = StdMutex::new(());

    #[test]
    fn clear_pending_update_drops_stale_cached_update_before_runtime_check() {
        let mut pending = Some("stale-update");

        clear_pending_update(&mut pending);

        assert_eq!(pending, None);
    }

    #[test]
    fn update_event_emit_warning_names_failed_event_without_failing_update() {
        let warning = update_event_emit_warning("update-ready", &"listener unavailable");

        assert_eq!(
            warning,
            "Failed to emit update-ready event during update flow: listener unavailable"
        );
    }

    #[test]
    fn updater_runtime_unavailable_errors_are_retryable_command_surface_copy() {
        assert_eq!(
            updater_initialization_error_message("plugin missing"),
            "Updater unavailable during manual update check: plugin missing"
        );
        assert_eq!(
            updater_endpoint_error_message("endpoint refused connection"),
            "Update endpoint unavailable during manual update check: endpoint refused connection"
        );
    }

    #[test]
    fn prerelease_version_detection_requires_non_empty_suffix() {
        assert!(is_prerelease_version("1.2.3-beta.1"));
        assert!(!is_prerelease_version("1.2.3"));
        assert!(!is_prerelease_version("1.2.3-"));
    }

    #[test]
    fn semantic_version_policy_rejects_same_version_and_downgrade() {
        assert_eq!(is_strictly_newer_version("1.10.0", "1.9.9"), Some(true));
        assert_eq!(is_strictly_newer_version("1.2.3", "1.2.3"), Some(false));
        assert_eq!(is_strictly_newer_version("1.2.2", "1.2.3"), Some(false));
    }

    #[test]
    fn semantic_version_policy_ignores_build_metadata_for_precedence() {
        assert_eq!(
            parse_semantic_version_parts("1.2.3+build.7"),
            Some([1, 2, 3])
        );
        assert_eq!(
            is_strictly_newer_version("1.2.3+build.7", "1.2.3"),
            Some(false)
        );
        assert_eq!(
            is_strictly_newer_version("1.2.4+build.7", "1.2.3"),
            Some(true)
        );
    }

    #[test]
    fn semantic_version_policy_rejects_malformed_versions_instead_of_string_fallback() {
        for version in [
            "v1.2.3", "1.2", "1.2.3.4", "01.2.3", "1.02.3", "1.2.03", "1.2.3+", "1.2.3-",
        ] {
            assert_eq!(parse_semantic_version_parts(version), None);
            assert_eq!(
                update_policy_error_parts(version, "1.2.3", "stable", false),
                Some(format!(
                    "Malformed semantic update version is not allowed: {version} <= 1.2.3"
                ))
            );
        }
    }

    #[test]
    fn update_policy_accepts_stable_newer_release_only() {
        assert_eq!(
            update_policy_error_parts("1.2.4", "1.2.3", "stable", false),
            None
        );
        assert_eq!(
            update_policy_error_parts("1.2.4", "1.2.3", "beta", false),
            Some("Unsupported update channel: beta".to_string())
        );
        assert_eq!(
            update_policy_error_parts("1.2.4-beta.1", "1.2.3", "stable", true),
            Some("Prerelease update is not allowed: 1.2.4-beta.1".to_string())
        );
        assert_eq!(
            update_policy_error_parts("1.2.3", "1.2.3", "stable", false),
            Some("Downgrade or same-version update is not allowed: 1.2.3 <= 1.2.3".to_string())
        );
        assert_eq!(
            update_policy_error_parts("1.2.2", "1.2.3", "stable", false),
            Some("Downgrade or same-version update is not allowed: 1.2.2 <= 1.2.3".to_string())
        );
    }

    #[test]
    fn download_guard_releases_flag_on_drop() {
        let _test_lock = UPDATER_COMMAND_TEST_LOCK
            .lock()
            .expect("test lock poisoned");
        DOWNLOADING.store(false, Ordering::SeqCst);

        {
            let _guard = DownloadGuard::acquire().expect("guard should acquire idle flag");
            assert!(DOWNLOADING.load(Ordering::SeqCst));
            assert!(DownloadGuard::acquire().is_err());
        }

        assert!(!DOWNLOADING.load(Ordering::SeqCst));
    }

    #[test]
    fn download_guard_releases_flag_after_panic_unwind() {
        let _test_lock = UPDATER_COMMAND_TEST_LOCK
            .lock()
            .expect("test lock poisoned");
        DOWNLOADING.store(false, Ordering::SeqCst);

        let result = panic::catch_unwind(|| {
            let _guard = DownloadGuard::acquire().expect("guard should acquire idle flag");
            panic!("simulated panic while downloading");
        });

        assert!(result.is_err());
        assert!(!DOWNLOADING.load(Ordering::SeqCst));
    }

    #[test]
    fn sync_install_guard_blocks_sync_and_db_writes_until_released() {
        let _test_lock = UPDATER_COMMAND_TEST_LOCK
            .lock()
            .expect("test lock poisoned");
        let syncing = AtomicBool::new(false);

        {
            let _guard =
                SyncInstallGuard::acquire(&syncing).expect("guard should acquire idle sync flag");
            assert!(syncing.load(Ordering::SeqCst));
            assert!(SyncInstallGuard::acquire(&syncing).is_err());
        }

        assert!(!syncing.load(Ordering::SeqCst));
    }

    #[test]
    fn sync_install_guard_returns_shared_busy_error_when_flag_is_reserved() {
        let _test_lock = UPDATER_COMMAND_TEST_LOCK
            .lock()
            .expect("test lock poisoned");
        let syncing = AtomicBool::new(true);

        let error = SyncInstallGuard::acquire(&syncing)
            .expect_err("reserved sync flag should block update install and restart");

        match error {
            AppError::UserVisible { message } => {
                assert_eq!(message, DATABASE_MAINTENANCE_BUSY_ERROR);
            }
            other => panic!("expected user-visible shared busy error, got {other:?}"),
        }
        assert!(
            syncing.load(Ordering::SeqCst),
            "failed updater guard acquire should not clear another operation's flag"
        );
    }

    #[test]
    fn sync_install_guard_releases_flag_after_panic_unwind() {
        let _test_lock = UPDATER_COMMAND_TEST_LOCK
            .lock()
            .expect("test lock poisoned");
        let syncing = AtomicBool::new(false);

        let result = panic::catch_unwind(|| {
            let _guard =
                SyncInstallGuard::acquire(&syncing).expect("guard should acquire idle sync flag");
            panic!("simulated panic while install gate is held");
        });

        assert!(result.is_err());
        assert!(!syncing.load(Ordering::SeqCst));
    }

    #[test]
    fn download_session_id_advances_per_download_attempt() {
        let _test_lock = UPDATER_COMMAND_TEST_LOCK
            .lock()
            .expect("test lock poisoned");
        DOWNLOAD_SESSION_ID.store(0, Ordering::SeqCst);

        assert_eq!(next_download_session_id(), 1);
        assert_eq!(next_download_session_id(), 2);
    }

    #[test]
    fn download_progress_percent_is_monotonic_when_content_length_changes() {
        assert_eq!(
            next_download_progress_percent(50, Some(100), None),
            Some(50)
        );
        assert_eq!(
            next_download_progress_percent(60, Some(200), Some(50)),
            Some(50)
        );
        assert_eq!(
            next_download_progress_percent(250, Some(200), Some(50)),
            Some(100)
        );
    }

    #[test]
    fn download_progress_percent_keeps_last_value_when_total_is_unknown() {
        assert_eq!(next_download_progress_percent(50, None, Some(40)), Some(40));
        assert_eq!(
            next_download_progress_percent(50, Some(0), Some(40)),
            Some(40)
        );
        assert_eq!(next_download_progress_percent(50, None, None), None);
    }
}
