use crate::domain::provider::FeedIdentifier;
use crate::domain::types::{AccountId, FeedId};
use tokio::sync::{broadcast, mpsc};

// === Commands (job submission) ===
#[derive(Debug, Clone)]
pub enum SyncCommand {
    SyncAll,
    SyncAccount {
        account_id: AccountId,
    },
    SyncFeed {
        account_id: AccountId,
        feed_id: FeedIdentifier,
    },
    ManualRefresh,
    PushPendingMutations {
        account_id: AccountId,
    },
    PurgeOldArticles,
}

// === Notifications (UI updates) ===
#[derive(Debug, Clone)]
pub enum AppEvent {
    SyncStarted { account_id: AccountId },
    SyncCompleted { account_id: AccountId },
    FeedUpdated { feed_id: FeedId },
    ErrorOccurred { message: String },
}

pub fn create_channels() -> (
    mpsc::Sender<SyncCommand>,
    mpsc::Receiver<SyncCommand>,
    broadcast::Sender<AppEvent>,
) {
    let (cmd_tx, cmd_rx) = mpsc::channel(64);
    let (evt_tx, _) = broadcast::channel(64);
    (cmd_tx, cmd_rx, evt_tx)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn send_and_receive_command() {
        let (tx, mut rx, _) = create_channels();
        tx.send(SyncCommand::SyncAll).await.unwrap();
        let cmd = rx.recv().await.unwrap();
        assert!(matches!(cmd, SyncCommand::SyncAll));
    }

    #[tokio::test]
    async fn broadcast_event_to_multiple_subscribers() {
        let (_, _, evt_tx) = create_channels();
        let mut rx1 = evt_tx.subscribe();
        let mut rx2 = evt_tx.subscribe();

        let account_id = AccountId("test".into());
        evt_tx
            .send(AppEvent::SyncCompleted {
                account_id: account_id.clone(),
            })
            .unwrap();

        let e1 = rx1.recv().await.unwrap();
        let e2 = rx2.recv().await.unwrap();
        assert!(matches!(e1, AppEvent::SyncCompleted { .. }));
        assert!(matches!(e2, AppEvent::SyncCompleted { .. }));
    }
}
