use tauri::{AppHandle, Manager};
use tauri_plugin_updater::UpdaterExt;
use tracing::warn;

use super::dto::AppError;
use super::AppState;

mod policy;
mod state;

pub use policy::UpdateInfo;
pub(crate) use policy::{
    emit_update_event_log_only, is_updater_manual_check_configured, make_pending_update_handle,
    make_update_info, pending_update_metadata_matches, update_policy_error,
    updater_endpoint_error_message, updater_initialization_error_message, DownloadProgress,
    UpdateReady,
};
#[cfg(not(test))]
pub(crate) use state::is_update_download_in_flight;
pub(crate) use state::next_download_session_id;
pub use state::PendingUpdate;

#[cfg(any(target_os = "macos", test))]
pub(crate) use state::{resolve_post_download_install, PostDownloadInstall};

pub(crate) use state::{DownloadGuard, PendingUpdateHandle, SyncInstallGuard};

#[tauri::command]
pub async fn restart_app(app: AppHandle) -> Result<(), AppError> {
    let state = app.state::<AppState>();
    let _guard = SyncInstallGuard::acquire(state.syncing.as_ref())?;

    // Install any update downloaded-but-not-yet-installed before restarting.
    // This deferred path covers non-macOS platforms and the macOS fallback
    // where the sync/maintenance guard was busy when the download finished.
    // After a macOS immediate install there is nothing pending here.
    let pending = app.state::<PendingUpdate>();
    let (take_generation, pending_update) = pending.0.lock().await.take();
    if let Some(pending_update) = pending_update {
        if let Some(bytes) = pending_update.downloaded_bytes.as_ref() {
            let install_result = if !pending_update_metadata_matches(
                &pending_update.version,
                &pending_update.source,
                &pending_update.update,
            ) {
                Err(AppError::UserVisible {
                    message: "Pending update handle changed before install".to_string(),
                })
            } else if let Some(message) = update_policy_error(&pending_update.update) {
                Err(AppError::UserVisible { message })
            } else {
                pending_update
                    .update
                    .install(bytes)
                    .map_err(|e| AppError::UserVisible {
                        message: format!("Failed to install update: {e}"),
                    })
            };

            if let Err(error) = install_result {
                pending
                    .0
                    .lock()
                    .await
                    .restore_if_unchanged(take_generation, pending_update);
                return Err(error);
            }
        }
    }

    app.restart()
}

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<Option<UpdateInfo>, AppError> {
    let pending = app.state::<PendingUpdate>();
    pending.0.lock().await.clear();

    // Store builds ship with empty updater endpoints/pubkey (updater disabled).
    // Skip the check instead of letting the plugin surface an EmptyEndpoints
    // error on every startup check.
    if !is_updater_manual_check_configured(app.config()) {
        return Ok(None);
    }

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

    // Cache the update handle for download_update
    pending
        .0
        .lock()
        .await
        .replace(update.map(make_pending_update_handle));

    Ok(info)
}

/// Downloads the pending update in the background. `SyncInstallGuard` is
/// intentionally not held for the network transfer: it is only acquired for
/// the brief install step, so sync and other database-maintenance operations
/// are not blocked for the full download duration.
#[tauri::command]
pub async fn download_update(app: AppHandle) -> Result<(), AppError> {
    let session_id = next_download_session_id();
    let download_guard = DownloadGuard::acquire(session_id)?;

    do_download_update(&app, session_id, &download_guard).await
}

async fn do_download_update(
    app: &AppHandle,
    session_id: u64,
    download_guard: &DownloadGuard,
) -> Result<(), AppError> {
    // Take the cached update handle, falling back to a fresh check if empty
    let pending = app.state::<PendingUpdate>();
    let (_, update) = {
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

    let bytes = update
        .download(
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
            message: format!("Failed to download update: {e}"),
        })?;

    if !download_guard.is_current() {
        return Err(AppError::UserVisible {
            message: "Update download was canceled or superseded before completion".to_string(),
        });
    }

    #[cfg(target_os = "macos")]
    {
        // The .app bundle can be swapped out while the current process keeps
        // running the old binary; the replacement takes effect on next launch.
        // Only the brief install step needs the sync/maintenance guard. When
        // sync is holding that guard, do not fail the finished download: keep
        // the bytes and fall back to the deferred install path (`restart_app`
        // installs before restarting), the same contract as other OSes.
        let state = app.state::<AppState>();
        match resolve_post_download_install(SyncInstallGuard::acquire(state.syncing.as_ref())) {
            PostDownloadInstall::Immediate(_sync_guard) => {
                update.install(bytes).map_err(|e| AppError::UserVisible {
                    message: format!("Failed to install update: {e}"),
                })?;
            }
            PostDownloadInstall::DeferUntilRestart => {
                pending.0.lock().await.replace(Some(PendingUpdateHandle {
                    version: pending_update.version,
                    source: pending_update.source,
                    update,
                    downloaded_bytes: Some(bytes),
                }));
            }
        }
        emit_update_event_log_only(app, "update-ready", UpdateReady { session_id });
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Defer install until the user requests a restart (see `restart_app`).
        pending.0.lock().await.replace(Some(PendingUpdateHandle {
            version: pending_update.version,
            source: pending_update.source,
            update,
            downloaded_bytes: Some(bytes),
        }));
        emit_update_event_log_only(app, "update-ready", UpdateReady { session_id });
    }

    Ok(())
}

#[cfg(test)]
mod tests;

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
