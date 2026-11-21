//! Best-effort persistence of Fever per-feed last-success times.
//!
//! Runs after the GReader phases of an account sync. Any failure (Fever
//! disabled, auth rejected, network, DB) only logs a warning: the GReader
//! sync result must never depend on this supplementary signal.

use std::collections::HashMap;
use std::sync::Mutex;

use tracing::warn;

use crate::commands::lock_db;
use crate::domain::account::Account;
use crate::domain::feed::Feed;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::infra::provider::greader::{FeverFeedLastSuccess, GReaderProvider};
use crate::repository::sync_state::{SyncState, SyncStateRepository, SyncStateScopeKey};

use super::db::load_account_feeds;

fn fever_url_match_key(raw_url: &str) -> String {
    let trimmed = raw_url.trim();
    match reqwest::Url::parse(trimmed) {
        Ok(mut url) => {
            url.set_fragment(None);
            url.to_string()
        }
        Err(_) => trimmed.to_string(),
    }
}

/// Map Fever results onto the account's local feeds by feed URL. Feeds the
/// Fever response does not mention, and mentions without a successful
/// refresh time, produce no state: the stored value stays whatever the last
/// successful Fever read left behind.
pub(super) fn fever_feed_sync_states(
    account: &Account,
    feeds: &[Feed],
    successes: &[FeverFeedLastSuccess],
) -> Vec<SyncState> {
    let last_success_by_url: HashMap<String, chrono::DateTime<chrono::Utc>> = successes
        .iter()
        .filter_map(|success| {
            success
                .last_success_at
                .map(|at| (fever_url_match_key(&success.url), at))
        })
        .collect();

    feeds
        .iter()
        .filter_map(|feed| {
            let last_success_at = last_success_by_url.get(&fever_url_match_key(&feed.url))?;
            Some(SyncState {
                account_id: account.id.clone(),
                scope_key: SyncStateScopeKey::fever_feed(feed.id.as_ref()).as_string(),
                timestamp_usec: Some(last_success_at.timestamp_micros()),
                continuation: None,
                etag: None,
                last_modified: None,
                last_success_at: Some(last_success_at.to_rfc3339()),
                last_error: None,
                error_count: 0,
                next_retry_at: None,
            })
        })
        .collect()
}

pub(super) async fn refresh_fever_feed_last_successes(
    db: &Mutex<DbManager>,
    account: &Account,
    provider: &GReaderProvider,
) {
    let successes = match provider.get_fever_feed_last_successes().await {
        Ok(successes) => successes,
        Err(error) => {
            warn!(
                account_id = %account.id.as_ref(),
                error = %error,
                "Fever feed last-success fetch failed; keeping previous values"
            );
            return;
        }
    };

    let feeds = match load_account_feeds(db, &account.id) {
        Ok(feeds) => feeds,
        Err(error) => {
            warn!(
                account_id = %account.id.as_ref(),
                error = %error,
                "Fever feed last-success persistence skipped: feed load failed"
            );
            return;
        }
    };

    let states = fever_feed_sync_states(account, &feeds, &successes);
    if states.is_empty() {
        return;
    }

    if let Err(error) = save_fever_feed_sync_states(db, &states) {
        warn!(
            account_id = %account.id.as_ref(),
            error = %error,
            "Fever feed last-success persistence failed"
        );
    }
}

fn save_fever_feed_sync_states(
    db: &Mutex<DbManager>,
    states: &[SyncState],
) -> Result<(), crate::commands::dto::AppError> {
    let db_guard = lock_db(db)?;
    let repo = SqliteSyncStateRepository::new(db_guard.writer());
    for state in states {
        repo.save(state)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::fever_feed_sync_states;
    use crate::domain::account::Account;
    use crate::domain::feed::Feed;
    use crate::domain::provider::ProviderKind;
    use crate::domain::types::{AccountId, FeedId};
    use crate::infra::provider::greader::FeverFeedLastSuccess;

    fn test_account() -> Account {
        Account {
            id: AccountId("acc-1".to_string()),
            kind: ProviderKind::FreshRss,
            name: "FreshRSS".to_string(),
            server_url: Some("https://freshrss.example.com".to_string()),
            username: Some("reader".to_string()),
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status:
                crate::domain::account::ConnectionVerificationStatus::Verified,
            connection_verified_at: None,
            connection_verification_error: None,
        }
    }

    fn test_feed(id: &str, url: &str) -> Feed {
        Feed {
            id: FeedId(id.to_string()),
            account_id: AccountId("acc-1".to_string()),
            folder_id: None,
            remote_id: Some(format!("feed/{url}")),
            title: id.to_string(),
            url: url.to_string(),
            site_url: "https://example.com".to_string(),
            icon: None,
            icon_url: None,
            unread_count: 0,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        }
    }

    #[test]
    fn fever_states_match_feeds_by_url_and_skip_unknown_or_never_succeeded() {
        let account = test_account();
        let feeds = vec![
            test_feed("feed-1", "http://bridge.example/a.xml"),
            test_feed("feed-2", "http://bridge.example/b.xml"),
            test_feed("feed-3", "http://bridge.example/c.xml"),
        ];
        let at = chrono::DateTime::parse_from_rfc3339("2026-11-20T00:00:00Z")
            .expect("timestamp should parse")
            .with_timezone(&chrono::Utc);
        let successes = vec![
            FeverFeedLastSuccess {
                url: "http://bridge.example/a.xml".to_string(),
                last_success_at: Some(at),
            },
            FeverFeedLastSuccess {
                url: "http://bridge.example/b.xml".to_string(),
                last_success_at: None,
            },
            FeverFeedLastSuccess {
                url: "http://bridge.example/unknown.xml".to_string(),
                last_success_at: Some(at),
            },
        ];

        let states = fever_feed_sync_states(&account, &feeds, &successes);

        assert_eq!(states.len(), 1);
        assert_eq!(states[0].scope_key, "fever_feed:feed-1");
        assert_eq!(
            states[0].last_success_at.as_deref(),
            Some("2026-11-20T00:00:00+00:00"),
        );
    }
}
