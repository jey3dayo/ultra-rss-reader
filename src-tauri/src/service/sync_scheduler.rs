use std::panic::AssertUnwindSafe;
use std::sync::atomic::Ordering;
use std::sync::Mutex;

use futures::FutureExt;
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::sync_commands::{
    get_min_sync_interval, purge_old_articles, run_automatic_sync,
};
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

        wait_for_automatic_sync_enabled(
            state.automatic_sync_enabled.as_ref(),
            state.automatic_sync_notify.as_ref(),
        )
        .await;

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
                    purge_old_articles(&state.db);
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

pub async fn wait_for_automatic_sync_enabled(
    automatic_sync_enabled: &std::sync::atomic::AtomicBool,
    automatic_sync_notify: &tokio::sync::Notify,
) {
    while !automatic_sync_enabled.load(Ordering::SeqCst) {
        automatic_sync_notify.notified().await;
    }
}

#[cfg(test)]
mod tests {
    use super::wait_for_automatic_sync_enabled;
    use std::sync::atomic::{AtomicBool, Ordering};
    use tokio::sync::Notify;

    #[tokio::test]
    async fn wait_for_automatic_sync_enabled_returns_immediately_when_already_enabled() {
        let automatic_sync_enabled = AtomicBool::new(true);
        let automatic_sync_notify = Notify::new();

        tokio::time::timeout(
            std::time::Duration::from_millis(50),
            wait_for_automatic_sync_enabled(&automatic_sync_enabled, &automatic_sync_notify),
        )
        .await
        .expect("should not wait when automatic sync is already enabled");
    }

    #[tokio::test]
    async fn wait_for_automatic_sync_enabled_waits_for_notification() {
        let automatic_sync_enabled = std::sync::Arc::new(AtomicBool::new(false));
        let automatic_sync_notify = std::sync::Arc::new(Notify::new());

        let enabled = automatic_sync_enabled.clone();
        let notify = automatic_sync_notify.clone();
        let waiter = tokio::spawn(async move {
            wait_for_automatic_sync_enabled(enabled.as_ref(), notify.as_ref()).await;
        });

        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        automatic_sync_enabled.store(true, Ordering::SeqCst);
        automatic_sync_notify.notify_waiters();

        tokio::time::timeout(std::time::Duration::from_millis(50), waiter)
            .await
            .expect("waiter should complete after notify")
            .expect("wait task should not panic");
    }
}
