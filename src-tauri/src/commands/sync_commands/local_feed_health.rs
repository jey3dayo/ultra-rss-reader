use tauri::State;

use crate::commands::dto::{AppError, LocalFeedSyncStatus};
use crate::commands::lock_db;
use crate::commands::sync_providers::{local_feed_scope_key, local_feed_sync_status};
use crate::commands::AppState;
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::repository::account::AccountRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::sync_state::SyncStateRepository;

fn load_local_feed_sync_statuses(
    conn: &rusqlite::Connection,
    account_id: &AccountId,
) -> Result<Vec<LocalFeedSyncStatus>, AppError> {
    let account = SqliteAccountRepository::new(conn)
        .find_by_id(account_id)?
        .ok_or_else(|| AppError::UserVisible {
            message: "Account not found".to_string(),
        })?;
    if account.kind != ProviderKind::Local {
        return Ok(Vec::new());
    }

    let feed_repo = SqliteFeedRepository::new(conn);
    let sync_state_repo = SqliteSyncStateRepository::new(conn);
    feed_repo
        .find_by_account(account_id)?
        .into_iter()
        .map(|feed| {
            let saved_state = sync_state_repo.get(account_id, local_feed_scope_key(&feed.url))?;
            Ok(local_feed_sync_status(&feed.id, saved_state))
        })
        .collect()
}

#[tauri::command]
pub fn get_local_feed_sync_statuses(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<Vec<LocalFeedSyncStatus>, AppError> {
    let account_id = AccountId(account_id);
    let db_guard = lock_db(&state.db)?;
    load_local_feed_sync_statuses(db_guard.reader(), &account_id)
}

#[cfg(test)]
mod tests {
    use super::load_local_feed_sync_statuses;
    use serde_json::json;

    use crate::commands::dto::{LocalFeedSyncErrorKind, LocalFeedSyncStatus};
    use crate::domain::feed::Feed;
    use crate::domain::types::{AccountId, FeedId};
    use crate::infra::db::connection::DbManager;
    use crate::infra::db::sqlite_feed::SqliteFeedRepository;
    use crate::repository::feed::FeedRepository;

    #[test]
    fn local_feed_status_contract_serializes_typed_errors() {
        let status = LocalFeedSyncStatus {
            feed_id: "feed-id".to_string(),
            last_attempt_at: Some("2026-10-11T00:00:00+00:00".to_string()),
            last_success_at: None,
            error_kind: Some(LocalFeedSyncErrorKind::PrivateAddressBlocked),
            error_count: 2,
            diagnostic_id: Some("8cb8465f-9d0c-429e-83f8-a7d511597be6".to_string()),
        };
        assert_eq!(
            serde_json::to_value(status).expect("status should serialize"),
            json!({
                "feed_id": "feed-id",
                "last_attempt_at": "2026-10-11T00:00:00+00:00",
                "last_success_at": null,
                "error_kind": "private_address_blocked",
                "error_count": 2,
                "diagnostic_id": "8cb8465f-9d0c-429e-83f8-a7d511597be6"
            })
        );
    }

    #[test]
    fn local_feed_statuses_use_account_ownership_and_skip_other_providers() {
        let db = DbManager::new_in_memory().unwrap();
        {
            let conn = db.writer();
            for (id, kind) in [("local", "Local"), ("remote", "FreshRss")] {
                conn.execute(
                    "INSERT INTO accounts (id, kind, name, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days) VALUES (?1, ?2, ?1, 3600, 1, 0, 30)",
                    rusqlite::params![id, kind],
                )
                .unwrap();
            }
            let feeds = SqliteFeedRepository::new(conn);
            for (feed_id, account_id, url) in [
                ("local-feed", "local", "https://local.example/feed.xml"),
                ("remote-feed", "remote", "https://remote.example/feed.xml"),
            ] {
                feeds
                    .save(&Feed {
                        id: FeedId(feed_id.to_string()),
                        account_id: AccountId(account_id.to_string()),
                        folder_id: None,
                        remote_id: None,
                        title: feed_id.to_string(),
                        url: url.to_string(),
                        site_url: "https://example.com".to_string(),
                        icon: None,
                        icon_url: None,
                        unread_count: 0,
                        reader_mode: "inherit".to_string(),
                        web_preview_mode: "inherit".to_string(),
                    })
                    .unwrap();
            }
        }

        let local_statuses =
            load_local_feed_sync_statuses(db.reader(), &AccountId("local".to_string())).unwrap();
        assert_eq!(local_statuses.len(), 1);
        assert_eq!(local_statuses[0].feed_id, "local-feed");
        assert!(
            load_local_feed_sync_statuses(db.reader(), &AccountId("remote".to_string()))
                .unwrap()
                .is_empty()
        );
    }
}
