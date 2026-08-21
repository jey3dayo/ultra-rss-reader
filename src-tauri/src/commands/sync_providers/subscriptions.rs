use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use tracing::info;

use crate::commands::dto::AppError;
use crate::commands::feed_commands::lock_db;
use crate::domain::account::Account;
use crate::domain::feed::Feed;
use crate::domain::folder::Folder;
use crate::domain::provider::ProviderKind;
use crate::domain::provider::RemoteSubscription;
use crate::domain::types::{AccountId, FeedId, FolderId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_folder::SqliteFolderRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;

pub(super) fn is_provider_managed_greader_feed(remote_id: Option<&str>) -> bool {
    remote_id.is_some_and(|remote_id| remote_id.starts_with("feed/"))
}

pub(super) fn resolve_greader_subscription_folder_id(
    remote_folder_id: Option<&str>,
    folder_remote_id_map: &HashMap<String, FolderId>,
    existing_feed: Option<&Feed>,
) -> Option<FolderId> {
    remote_folder_id
        .and_then(|remote_id| folder_remote_id_map.get(remote_id))
        .cloned()
        .or_else(|| existing_feed.and_then(|feed| feed.folder_id.clone()))
}

pub(super) fn save_greader_subscriptions(
    db: &Mutex<DbManager>,
    account: &Account,
    folder_remote_id_map: &HashMap<String, FolderId>,
    remote_subs: &[RemoteSubscription],
    sync_started_remote_feed_ids: &HashSet<String>,
) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;

    // Load all existing feeds for the account once and index them by
    // remote_id / url in memory, instead of running a find_by_remote_id and
    // find_by_url SELECT per remote subscription (N+1).
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    let existing_feeds = feed_repo.find_by_account(&account.id)?;
    let mut by_remote_id: HashMap<String, Feed> = HashMap::new();
    let mut by_url: HashMap<String, Feed> = HashMap::new();
    for feed in existing_feeds {
        if let Some(remote_id) = feed.remote_id.clone() {
            by_remote_id.insert(remote_id, feed.clone());
        }
        by_url.insert(feed.url.clone(), feed);
    }

    // Apply all upserts inside a single transaction so N feeds commit once
    // instead of once per feed.
    let tx = db_guard
        .writer()
        .unchecked_transaction()
        .map_err(|error| AppError::from(crate::domain::error::DomainError::from(error)))?;
    let tx_feed_repo = SqliteFeedRepository::new(&tx);

    for rs in remote_subs {
        let existing = by_remote_id
            .get(&rs.remote_id)
            .cloned()
            .or_else(|| by_url.get(&rs.url).cloned());
        if existing.is_none() && sync_started_remote_feed_ids.contains(&rs.remote_id) {
            continue;
        }
        let feed = Feed {
            id: existing
                .as_ref()
                .map(|f| f.id.clone())
                .unwrap_or_else(FeedId::new),
            account_id: account.id.clone(),
            folder_id: resolve_greader_subscription_folder_id(
                rs.folder_remote_id.as_deref(),
                folder_remote_id_map,
                existing.as_ref(),
            ),
            remote_id: Some(rs.remote_id.clone()),
            title: rs.title.clone(),
            url: rs.url.clone(),
            site_url: rs.site_url.clone(),
            icon: existing.as_ref().and_then(|f| f.icon.clone()),
            icon_url: rs
                .icon_url
                .clone()
                .or_else(|| existing.as_ref().and_then(|feed| feed.icon_url.clone())),
            unread_count: 0,
            reader_mode: existing
                .as_ref()
                .map(|f| f.reader_mode.clone())
                .unwrap_or_else(|| "inherit".to_string()),
            web_preview_mode: existing
                .as_ref()
                .map(|f| f.web_preview_mode.clone())
                .unwrap_or_else(|| "inherit".to_string()),
        };
        tx_feed_repo.save(&feed)?;
        // Keep the in-memory indices in sync so a later remote subscription
        // in the same batch (e.g. a URL that matches a feed just upserted)
        // observes the update, matching the previous per-item read/write
        // ordering. Remove the matched feed's pre-update identity first: if
        // its url or remote_id changed, a stale by_url/by_remote_id entry
        // would otherwise still point a later, unrelated remote subscription
        // (e.g. one that now legitimately reuses the old url) at this
        // already-migrated feed instead of treating it as a new feed.
        if let Some(existing) = &existing {
            if let Some(remote_id) = existing.remote_id.as_deref() {
                by_remote_id.remove(remote_id);
            }
            by_url.remove(&existing.url);
        }
        if let Some(remote_id) = feed.remote_id.clone() {
            by_remote_id.insert(remote_id, feed.clone());
        }
        by_url.insert(feed.url.clone(), feed);
    }

    tx.commit()
        .map_err(|error| AppError::from(crate::domain::error::DomainError::from(error)))?;
    Ok(())
}

pub(super) fn delete_missing_greader_subscriptions(
    db: &Mutex<DbManager>,
    account: &Account,
    remote_subscription_ids: &HashSet<String>,
) -> Result<usize, AppError> {
    let db_guard = lock_db(db)?;
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    let feeds = feed_repo.find_by_account(&account.id)?;
    let mut deleted_count = 0usize;

    for feed in feeds {
        let Some(remote_id) = feed.remote_id.as_deref() else {
            continue;
        };
        if !is_provider_managed_greader_feed(Some(remote_id))
            || remote_subscription_ids.contains(remote_id)
        {
            continue;
        }

        info!(
            account_id = %account.id.as_ref(),
            account_name = %account.name,
            feed_id = %feed.id.as_ref(),
            remote_id = %remote_id,
            feed_title = %feed.title,
            "Deleting local FreshRSS feed missing from remote subscriptions"
        );
        feed_repo.delete(&feed.id)?;
        deleted_count = deleted_count.saturating_add(1);
    }

    Ok(deleted_count)
}

pub(super) fn delete_missing_greader_folders(
    db: &Mutex<DbManager>,
    account: &Account,
    remote_folder_ids: &HashSet<String>,
) -> Result<usize, AppError> {
    if account.kind != ProviderKind::FreshRss {
        return Ok(0);
    }

    let db_guard = lock_db(db)?;
    let folder_repo = SqliteFolderRepository::new(db_guard.writer());
    let local_folders = folder_repo.find_by_account(&account.id)?;
    let stale_folder_ids = local_folders
        .into_iter()
        .filter_map(|folder| {
            let remote_id = folder.remote_id.as_deref()?;
            if remote_id.trim().is_empty() || remote_folder_ids.contains(remote_id) {
                return None;
            }
            Some(folder.id)
        })
        .collect::<Vec<_>>();
    let deleted_count = stale_folder_ids.len();
    folder_repo.detach_feeds_and_delete_many(&stale_folder_ids)?;

    Ok(deleted_count)
}

pub(super) fn provider_managed_remote_feed_ids(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> Result<HashSet<String>, AppError> {
    let db_guard = lock_db(db)?;
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    Ok(feed_repo
        .find_by_account(account_id)?
        .into_iter()
        .filter_map(|feed| feed.remote_id)
        .filter(|remote_id| is_provider_managed_greader_feed(Some(remote_id)))
        .collect())
}

pub(super) fn folder_name_case_key(name: &str) -> String {
    name.trim().to_lowercase()
}

pub(super) fn resolve_greader_folder_sort_order(
    remote_sort_order: Option<i32>,
    existing_folder: Option<&Folder>,
    next_sort_order: &mut i32,
) -> i32 {
    remote_sort_order
        .or_else(|| existing_folder.map(|folder| folder.sort_order))
        .unwrap_or_else(|| {
            let sort_order = *next_sort_order;
            *next_sort_order = next_sort_order.saturating_add(1);
            sort_order
        })
}

pub(super) fn pending_mutation_ids_targeting_provider_managed_greader_feeds(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> Result<std::collections::HashSet<i64>, AppError> {
    let db_guard = lock_db(db)?;
    let mut stmt = db_guard
        .reader()
        .prepare(
            "SELECT pm.id
             FROM pending_mutations pm
             JOIN articles a ON a.remote_id = pm.remote_entry_id
             JOIN feeds f ON f.id = a.feed_id AND f.account_id = pm.account_id
             WHERE pm.account_id = ?1
             GROUP BY pm.id
             HAVING SUM(CASE WHEN f.remote_id LIKE 'feed/%' THEN 1 ELSE 0 END) > 0
                AND SUM(CASE WHEN f.remote_id IS NULL OR f.remote_id NOT LIKE 'feed/%' THEN 1 ELSE 0 END) = 0",
        )
        .map_err(|error| {
            AppError::from(crate::domain::error::DomainError::from(error))
        })?;
    let rows = stmt
        .query_map(rusqlite::params![account_id.as_ref()], |row| {
            row.get::<_, i64>(0)
        })
        .map_err(|error| AppError::from(crate::domain::error::DomainError::from(error)))?;
    let mut ids = std::collections::HashSet::new();
    for row in rows {
        let id =
            row.map_err(|error| AppError::from(crate::domain::error::DomainError::from(error)))?;
        ids.insert(id);
    }
    Ok(ids)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::account::{Account, ConnectionVerificationStatus};

    fn test_db() -> Mutex<DbManager> {
        Mutex::new(DbManager::new_in_memory().expect("in-memory db should initialize"))
    }

    fn test_account() -> Account {
        Account {
            id: AccountId::new(),
            kind: ProviderKind::FreshRss,
            name: "FreshRSS".to_string(),
            server_url: Some("http://localhost".to_string()),
            username: Some("u".to_string()),
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        }
    }

    fn make_remote_sub(remote_id: &str, url: &str) -> RemoteSubscription {
        RemoteSubscription {
            remote_id: remote_id.to_string(),
            title: format!("Title for {remote_id}"),
            url: url.to_string(),
            site_url: String::new(),
            folder_remote_id: None,
            icon_url: None,
        }
    }

    #[test]
    fn save_greader_subscriptions_treats_reused_url_as_new_feed_after_remote_id_matched_feed_url_changes(
    ) {
        let db = test_db();
        let account = test_account();

        // Pre-existing feed, previously synced as remote_id "feed/a" with the old url.
        let existing_feed = Feed {
            id: FeedId::new(),
            account_id: account.id.clone(),
            folder_id: None,
            remote_id: Some("feed/a".to_string()),
            title: "Feed A (old)".to_string(),
            url: "http://old.example.com/a.rss".to_string(),
            site_url: String::new(),
            icon: None,
            icon_url: None,
            unread_count: 0,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        };
        {
            let db_guard = db.lock().unwrap();
            db_guard
                .writer()
                .execute(
                    "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                    rusqlite::params![account.id.0, "FreshRss", &account.name],
                )
                .unwrap();
            let feed_repo = SqliteFeedRepository::new(db_guard.writer());
            feed_repo.save(&existing_feed).unwrap();
        }

        // First item: same remote_id "feed/a" as the pre-existing feed, but its url
        // has changed upstream to a new url.
        // Second item: a different, never-seen remote_id "feed/b" whose url happens
        // to reuse the pre-existing feed's now-stale old url.
        let remote_subs = vec![
            make_remote_sub("feed/a", "http://new.example.com/a.rss"),
            make_remote_sub("feed/b", "http://old.example.com/a.rss"),
        ];

        save_greader_subscriptions(
            &db,
            &account,
            &HashMap::new(),
            &remote_subs,
            &HashSet::new(),
        )
        .unwrap();

        let db_guard = db.lock().unwrap();
        let feed_repo = SqliteFeedRepository::new(db_guard.reader());
        let feeds = feed_repo.find_by_account(&account.id).unwrap();
        assert_eq!(
            feeds.len(),
            2,
            "the reused url should create a separate feed, not merge into feed/a"
        );

        let feed_a = feed_repo
            .find_by_remote_id(&account.id, "feed/a")
            .unwrap()
            .expect("feed/a should still exist");
        assert_eq!(feed_a.id, existing_feed.id);
        assert_eq!(feed_a.url, "http://new.example.com/a.rss");

        let feed_b = feed_repo
            .find_by_remote_id(&account.id, "feed/b")
            .unwrap()
            .expect("feed/b should have been created as a new feed");
        assert_ne!(feed_b.id, existing_feed.id);
        assert_eq!(feed_b.url, "http://old.example.com/a.rss");
    }
}
