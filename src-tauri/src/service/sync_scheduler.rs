use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};

use crate::commands::feed_commands::{get_min_sync_interval, run_full_sync};
use crate::infra::db::connection::DbManager;

/// Start a background task that periodically syncs all accounts.
///
/// The interval is derived from the minimum `sync_interval_secs` across all accounts.
/// After each successful sync, a `"sync-completed"` event is emitted so the frontend
/// can invalidate its caches.
pub fn start_sync_scheduler(db: &Mutex<DbManager>, app_handle: AppHandle) {
    let interval = get_min_sync_interval(db);
    tracing::info!(
        "Starting background sync scheduler with interval {:?}",
        interval
    );

    tokio::spawn(async move {
        let mut timer = tokio::time::interval(interval);
        // Skip the first immediate tick (initial sync is handled by the frontend)
        timer.tick().await;

        loop {
            timer.tick().await;
            tracing::info!("Background sync triggered");

            let state = app_handle.state::<crate::commands::AppState>();
            match run_full_sync(&state.db).await {
                Ok(()) => {
                    tracing::info!("Background sync completed successfully");
                    if let Err(e) = app_handle.emit("sync-completed", ()) {
                        tracing::warn!("Failed to emit sync-completed event: {e}");
                    }
                }
                Err(e) => {
                    tracing::warn!("Background sync failed: {e}");
                }
            }
        }
    });
}
