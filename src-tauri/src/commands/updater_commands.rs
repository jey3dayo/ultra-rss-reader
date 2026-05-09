use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};
use tokio::sync::Mutex;
use tracing::warn;

use super::dto::AppError;

static DOWNLOADING: AtomicBool = AtomicBool::new(false);

/// Cached update handle from the last successful check.
/// Stored in Tauri managed state so `download_and_install_update` can reuse it
/// without a second network round-trip.
pub struct PendingUpdate(pub Arc<Mutex<Option<Update>>>);

fn clear_pending_update<T>(pending: &mut Option<T>) {
    *pending = None;
}

#[tauri::command]
pub fn restart_app(app: AppHandle) {
    app.restart();
}

#[derive(Debug, Serialize)]
pub struct UpdateInfo {
    pub version: String,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct DownloadProgress {
    percent: Option<u8>,
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

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<Option<UpdateInfo>, AppError> {
    let pending = app.state::<PendingUpdate>();
    clear_pending_update(&mut *pending.0.lock().await);

    let updater = app.updater().map_err(|e| AppError::Retryable {
        message: format!("Failed to initialize updater: {e}"),
    })?;

    let update = updater.check().await.map_err(|e| AppError::Retryable {
        message: format!("Failed to check for update: {e}"),
    })?;

    let info = update.as_ref().map(|u| UpdateInfo {
        version: u.version.clone(),
        body: u.body.clone(),
    });

    // Cache the update handle for download_and_install_update
    *pending.0.lock().await = update;

    Ok(info)
}

#[tauri::command]
pub async fn download_and_install_update(app: AppHandle) -> Result<(), AppError> {
    if DOWNLOADING
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err(AppError::UserVisible {
            message: "Update download already in progress".to_string(),
        });
    }

    let result = do_download_and_install(&app).await;

    DOWNLOADING.store(false, Ordering::SeqCst);

    result
}

async fn do_download_and_install(app: &AppHandle) -> Result<(), AppError> {
    // Take the cached update handle, falling back to a fresh check if empty
    let pending = app.state::<PendingUpdate>();
    let update = {
        let mut guard = pending.0.lock().await;
        guard.take()
    };

    let update = match update {
        Some(u) => u,
        None => {
            let updater = app.updater().map_err(|e| AppError::Retryable {
                message: format!("Failed to initialize updater: {e}"),
            })?;
            updater
                .check()
                .await
                .map_err(|e| AppError::Retryable {
                    message: format!("Failed to check for update: {e}"),
                })?
                .ok_or_else(|| AppError::UserVisible {
                    message: "No update available".to_string(),
                })?
        }
    };

    let app_handle = app.clone();
    let mut total_downloaded: usize = 0;

    update
        .download_and_install(
            move |chunk_length, content_length| {
                total_downloaded += chunk_length;
                let percent = content_length.and_then(|total| {
                    if total == 0 {
                        return None;
                    }
                    Some(((total_downloaded as f64 / total as f64) * 100.0).min(100.0) as u8)
                });
                emit_update_event_log_only(
                    &app_handle,
                    "update-download-progress",
                    DownloadProgress { percent },
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
    emit_update_event_log_only(app, "update-ready", ());

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{clear_pending_update, update_event_emit_warning};

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
}
