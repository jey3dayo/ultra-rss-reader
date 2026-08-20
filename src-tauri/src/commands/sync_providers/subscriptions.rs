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
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    for rs in remote_subs {
        let existing = match feed_repo.find_by_remote_id(&account.id, &rs.remote_id)? {
            Some(feed) => Some(feed),
            None => feed_repo.find_by_url(&account.id, &rs.url)?,
        };
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
        feed_repo.save(&feed)?;
    }
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
