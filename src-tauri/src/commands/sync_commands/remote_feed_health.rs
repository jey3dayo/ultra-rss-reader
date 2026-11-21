use tauri::State;

use crate::commands::dto::{AppError, RemoteFeedSyncStatus};
use crate::commands::lock_db;
use crate::commands::AppState;
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::repository::account::AccountRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::sync_state::{SyncStateRepository, SyncStateScopeKey};

fn load_remote_feed_sync_statuses(
    conn: &rusqlite::Connection,
    account_id: &AccountId,
) -> Result<Vec<RemoteFeedSyncStatus>, AppError> {
    let account = SqliteAccountRepository::new(conn)
        .find_by_id(account_id)?
        .ok_or_else(|| AppError::UserVisible {
            message: "Account not found".to_string(),
        })?;
    if account.kind != ProviderKind::FreshRss {
        return Ok(Vec::new());
    }

    let feed_repo = SqliteFeedRepository::new(conn);
    let sync_state_repo = SqliteSyncStateRepository::new(conn);
    feed_repo
        .find_by_account(account_id)?
        .into_iter()
        .map(|feed| {
            let saved_state =
                sync_state_repo.get(account_id, SyncStateScopeKey::fever_feed(feed.id.as_ref()))?;
            let last_success_at = saved_state
                .and_then(|state| state.last_success_at)
                .filter(|value| chrono::DateTime::parse_from_rfc3339(value).is_ok());
            Ok(RemoteFeedSyncStatus {
                feed_id: feed.id.as_ref().to_string(),
                last_success_at,
            })
        })
        .collect()
}

#[tauri::command]
pub fn get_remote_feed_sync_statuses(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<Vec<RemoteFeedSyncStatus>, AppError> {
    let account_id = AccountId(account_id);
    let db_guard = lock_db(&state.db)?;
    load_remote_feed_sync_statuses(db_guard.reader(), &account_id)
}

#[cfg(test)]
mod tests {
    use super::load_remote_feed_sync_statuses;
    use serde_json::json;

    use crate::commands::dto::RemoteFeedSyncStatus;
    use crate::domain::feed::Feed;
    use crate::domain::types::{AccountId, FeedId};
    use crate::infra::db::connection::DbManager;
    use crate::infra::db::sqlite_feed::SqliteFeedRepository;
    use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
    use crate::repository::feed::FeedRepository;
    use crate::repository::sync_state::{SyncState, SyncStateRepository, SyncStateScopeKey};

    #[test]
    fn remote_feed_status_contract_serializes_last_success() {
        let status = RemoteFeedSyncStatus {
            feed_id: "feed-id".to_string(),
            last_success_at: Some("2026-11-20T00:00:00+00:00".to_string()),
        };
        assert_eq!(
            serde_json::to_value(status).expect("status should serialize"),
            json!({
                "feed_id": "feed-id",
                "last_success_at": "2026-11-20T00:00:00+00:00"
            })
        );
    }

    #[test]
    fn remote_feed_statuses_read_fever_scopes_for_freshrss_only() {
        let db = DbManager::new_in_memory().unwrap();
        {
            let conn = db.writer();
            for (id, kind) in [("remote", "FreshRss"), ("local", "Local")] {
                conn.execute(
                    "INSERT INTO accounts (id, kind, name, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days) VALUES (?1, ?2, ?1, 3600, 1, 0, 30)",
                    rusqlite::params![id, kind],
                )
                .unwrap();
            }
            let feeds = SqliteFeedRepository::new(conn);
            for (feed_id, account_id, url) in [
                ("remote-feed", "remote", "http://bridge.example/a.xml"),
                ("local-feed", "local", "https://local.example/feed.xml"),
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
            let sync_states = SqliteSyncStateRepository::new(conn);
            sync_states
                .save(&SyncState {
                    account_id: AccountId("remote".to_string()),
                    scope_key: SyncStateScopeKey::fever_feed("remote-feed").as_string(),
                    timestamp_usec: None,
                    continuation: None,
                    etag: None,
                    last_modified: None,
                    last_success_at: Some("2026-11-20T00:00:00+00:00".to_string()),
                    last_error: None,
                    error_count: 0,
                    next_retry_at: None,
                })
                .unwrap();
        }

        let remote_statuses =
            load_remote_feed_sync_statuses(db.reader(), &AccountId("remote".to_string())).unwrap();
        assert_eq!(remote_statuses.len(), 1);
        assert_eq!(remote_statuses[0].feed_id, "remote-feed");
        assert_eq!(
            remote_statuses[0].last_success_at.as_deref(),
            Some("2026-11-20T00:00:00+00:00"),
        );
        assert!(
            load_remote_feed_sync_statuses(db.reader(), &AccountId("local".to_string()))
                .unwrap()
                .is_empty()
        );
    }
}
