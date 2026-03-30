use std::panic::AssertUnwindSafe;
use std::sync::atomic::Ordering;
use std::sync::Mutex;
use std::time::Duration;

use futures::FutureExt;
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::sync_commands::{get_min_sync_interval, run_automatic_sync};
use crate::infra::db::connection::DbManager;

/// Start a background task that periodically syncs all accounts.
///
/// The interval is re-read from the DB on each iteration so changes
/// to account sync settings take effect without restart.
/// Panics in the sync loop are caught and logged, keeping the scheduler alive.
pub fn start_sync_scheduler(_db: &Mutex<DbManager>, app_handle: AppHandle) {
    tracing::info!("Starting background sync scheduler");

    tauri::async_runtime::spawn(async move {
        let state = app_handle.state::<crate::commands::AppState>();
        tracing::info!("Background sync is locked until the first manual sync completes");

        while !state.automatic_sync_enabled.load(Ordering::SeqCst) {
            tokio::time::sleep(Duration::from_secs(1)).await;
        }

        loop {
            // Re-read interval each iteration for dynamic updates
            let interval = get_min_sync_interval(&state.db);
            tokio::time::sleep(interval).await;

            let result = AssertUnwindSafe(run_automatic_sync(
                &state.db,
                &state.syncing,
                state.automatic_sync_enabled.as_ref(),
            ))
            .catch_unwind()
            .await;

            match result {
                Ok(Ok(sync_result)) if sync_result.synced => {
                    if sync_result.failed.is_empty() {
                        tracing::info!("Background sync completed successfully");
                    } else {
                        for err in &sync_result.failed {
                            tracing::warn!(
                                "Background sync: account '{}' failed: {}",
                                err.account_name,
                                err.message
                            );
                        }
                    }
                    if let Err(e) = app_handle.emit("sync-completed", ()) {
                        tracing::warn!("Failed to emit sync-completed event: {e}");
                    }
                }
                Ok(Ok(_)) => {
                    tracing::info!(
                        "Background sync skipped because another sync is already in progress"
                    );
                }
                Ok(Err(e)) => {
                    tracing::warn!("Background sync failed: {e}");
                }
                Err(_) => {
                    tracing::error!("Background sync panicked, scheduler continues");
                }
            }
        }
    });
}
