use std::sync::atomic::AtomicBool;
use std::sync::Mutex;

use tokio::sync::{broadcast, mpsc};
use tracing::{info, warn};

use super::event_bus::{AppEvent, SyncCommand};
use crate::commands::feed_commands::run_full_sync;
use crate::infra::db::connection::DbManager;

pub async fn run_sync_loop(
    mut cmd_rx: mpsc::Receiver<SyncCommand>,
    event_tx: broadcast::Sender<AppEvent>,
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
) {
    info!("SyncService started");
    while let Some(cmd) = cmd_rx.recv().await {
        match cmd {
            SyncCommand::SyncAll => {
                info!("Processing SyncAll");
                if let Err(e) = run_full_sync(db, syncing).await {
                    warn!("SyncAll failed: {e}");
                    let _ = event_tx.send(AppEvent::ErrorOccurred {
                        message: e.to_string(),
                    });
                }
            }
            SyncCommand::ManualRefresh => {
                info!("Processing ManualRefresh");
                if let Err(e) = run_full_sync(db, syncing).await {
                    warn!("ManualRefresh failed: {e}");
                    let _ = event_tx.send(AppEvent::ErrorOccurred {
                        message: e.to_string(),
                    });
                }
            }
            SyncCommand::SyncAccount { account_id } => {
                info!("Processing SyncAccount: {}", account_id.0);
                let _ = event_tx.send(AppEvent::SyncStarted {
                    account_id: account_id.clone(),
                });
                match run_full_sync(db, syncing).await {
                    Ok(true) => {
                        let _ = event_tx.send(AppEvent::SyncCompleted { account_id });
                    }
                    Ok(false) => {
                        info!(
                            "SyncAccount {} skipped because another sync is already in progress",
                            account_id.0
                        );
                    }
                    Err(e) => {
                        warn!("SyncAccount {} failed: {e}", account_id.0);
                        let _ = event_tx.send(AppEvent::ErrorOccurred {
                            message: e.to_string(),
                        });
                    }
                }
            }
            SyncCommand::PurgeOldArticles => {
                info!("Processing PurgeOldArticles");
                purge_old_articles(db);
            }
            SyncCommand::SyncFeed { .. } | SyncCommand::PushPendingMutations { .. } => {
                info!("Processing command: {:?}", cmd);
            }
        }
    }
    info!("SyncService stopped");
}

fn purge_old_articles(db: &Mutex<DbManager>) {
    let result = (|| -> Result<usize, String> {
        let db = db.lock().map_err(|e| format!("Lock error: {e}"))?;
        let conn = db.writer();

        // Delete read (non-starred) articles older than each account's keep_read_items_days.
        // Uses fetched_at (consistent with repo.purge_old_read). keep_read_items_days = 0 means forever.
        let deleted = conn
            .execute(
                "DELETE FROM articles WHERE id IN (
                    SELECT a.id FROM articles a
                    JOIN feeds f ON a.feed_id = f.id
                    JOIN accounts acc ON f.account_id = acc.id
                    WHERE a.is_read = 1
                      AND a.is_starred = 0
                      AND acc.keep_read_items_days > 0
                      AND datetime(a.fetched_at) < datetime('now', '-' || acc.keep_read_items_days || ' days')
                )",
                [],
            )
            .map_err(|e| format!("Purge error: {e}"))?;
        Ok(deleted)
    })();

    match result {
        Ok(n) if n > 0 => info!("Purged {n} old read articles"),
        Ok(_) => info!("No old articles to purge"),
        Err(e) => warn!("PurgeOldArticles failed: {e}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::types::AccountId;
    use crate::service::event_bus;

    #[tokio::test]
    async fn sync_loop_processes_commands() {
        let db = crate::infra::db::connection::DbManager::new_in_memory().unwrap();
        let db_mutex = Mutex::new(db);
        let syncing = AtomicBool::new(false);

        let (cmd_tx, cmd_rx, evt_tx) = event_bus::create_channels();
        let mut evt_rx = evt_tx.subscribe();

        let handle = tokio::spawn(async move {
            run_sync_loop(cmd_rx, evt_tx, &db_mutex, &syncing).await;
        });

        let account_id = AccountId("test-acc".into());
        cmd_tx
            .send(SyncCommand::SyncAccount {
                account_id: account_id.clone(),
            })
            .await
            .unwrap();

        // Should receive SyncStarted and SyncCompleted
        let e1 = evt_rx.recv().await.unwrap();
        assert!(matches!(e1, AppEvent::SyncStarted { .. }));
        let e2 = evt_rx.recv().await.unwrap();
        assert!(matches!(e2, AppEvent::SyncCompleted { .. }));

        drop(cmd_tx); // Close channel to stop loop
        handle.await.unwrap();
    }
}
