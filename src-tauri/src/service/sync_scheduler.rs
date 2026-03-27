use std::panic::AssertUnwindSafe;
use std::sync::Mutex;

use futures::FutureExt;
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::feed_commands::{get_min_sync_interval, run_full_sync};
use crate::infra::db::connection::DbManager;

/// Start a background task that periodically syncs all accounts.
///
/// The interval is re-read from the DB on each iteration so changes
/// to account sync settings take effect without restart.
/// Panics in the sync loop are caught and logged, keeping the scheduler alive.
pub fn start_sync_scheduler(_db: &Mutex<DbManager>, app_handle: AppHandle) {
    tracing::info!("Starting background sync scheduler");

    tauri::async_runtime::spawn(async move {
        // Initial delay — let frontend handle first sync
        let state = app_handle.state::<crate::commands::AppState>();
        let initial_interval = get_min_sync_interval(&state.db);
        tokio::time::sleep(initial_interval).await;

        loop {
            // Re-read interval each iteration for dynamic updates
            let interval = get_min_sync_interval(&state.db);

            let result = AssertUnwindSafe(run_full_sync(&state.db, &state.syncing))
                .catch_unwind()
                .await;

            match result {
                Ok(Ok(())) => {
                    tracing::info!("Background sync completed successfully");
                    if let Err(e) = app_handle.emit("sync-completed", ()) {
                        tracing::warn!("Failed to emit sync-completed event: {e}");
                    }
                }
                Ok(Err(e)) => {
                    tracing::warn!("Background sync failed: {e}");
                }
                Err(_) => {
                    tracing::error!("Background sync panicked, scheduler continues");
                }
            }

            tokio::time::sleep(interval).await;
        }
    });
}
