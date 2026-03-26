use super::event_bus::{AppEvent, SyncCommand};
use tokio::sync::{broadcast, mpsc};
use tracing::info;

// For now, a simplified service that processes commands.
// Full integration with repositories will happen when Tauri app state is wired up.

pub async fn run_sync_loop(
    mut cmd_rx: mpsc::Receiver<SyncCommand>,
    event_tx: broadcast::Sender<AppEvent>,
) {
    info!("SyncService started");
    while let Some(cmd) = cmd_rx.recv().await {
        match cmd {
            SyncCommand::SyncAll => {
                info!("Processing SyncAll");
                // TODO: iterate accounts, call sync_flow::sync_account for each
            }
            SyncCommand::SyncAccount { account_id } => {
                info!("Processing SyncAccount: {}", account_id);
                let _ = event_tx.send(AppEvent::SyncStarted {
                    account_id: account_id.clone(),
                });
                // TODO: call sync_flow::sync_account
                let _ = event_tx.send(AppEvent::SyncCompleted { account_id });
            }
            SyncCommand::ManualRefresh => {
                info!("Processing ManualRefresh");
            }
            SyncCommand::PurgeOldArticles => {
                info!("Processing PurgeOldArticles");
            }
            SyncCommand::SyncFeed { .. } | SyncCommand::PushPendingMutations { .. } => {
                info!("Processing command: {:?}", cmd);
            }
        }
    }
    info!("SyncService stopped");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::types::AccountId;
    use crate::service::event_bus;

    #[tokio::test]
    async fn sync_loop_processes_commands() {
        let (cmd_tx, cmd_rx, evt_tx) = event_bus::create_channels();
        let mut evt_rx = evt_tx.subscribe();

        let handle = tokio::spawn(run_sync_loop(cmd_rx, evt_tx));

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
