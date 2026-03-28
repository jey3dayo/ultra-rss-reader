use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

use super::dto::AppError;

static DOWNLOADING: AtomicBool = AtomicBool::new(false);

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
    percent: u8,
}

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<Option<UpdateInfo>, AppError> {
    let updater = app.updater().map_err(|e| AppError::Retryable {
        message: format!("Failed to initialize updater: {e}"),
    })?;

    let update = updater.check().await.map_err(|e| AppError::Retryable {
        message: format!("Failed to check for update: {e}"),
    })?;

    Ok(update.map(|u| UpdateInfo {
        version: u.version.clone(),
        body: u.body.clone(),
    }))
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
    let updater = app.updater().map_err(|e| AppError::Retryable {
        message: format!("Failed to initialize updater: {e}"),
    })?;

    let update = updater
        .check()
        .await
        .map_err(|e| AppError::Retryable {
            message: format!("Failed to check for update: {e}"),
        })?
        .ok_or_else(|| AppError::UserVisible {
            message: "No update available".to_string(),
        })?;

    let app_handle = app.clone();
    let mut total_downloaded: usize = 0;

    update
        .download_and_install(
            move |chunk_length, content_length| {
                total_downloaded += chunk_length;
                let percent = content_length.map_or(0u8, |total| {
                    if total == 0 {
                        0
                    } else {
                        ((total_downloaded as f64 / total as f64) * 100.0).min(100.0) as u8
                    }
                });
                let _ = app_handle.emit("update-download-progress", DownloadProgress { percent });
            },
            || {},
        )
        .await
        .map_err(|e| AppError::UserVisible {
            message: format!("Failed to download/install update: {e}"),
        })?;

    let _ = app.emit("update-ready", ());

    Ok(())
}
