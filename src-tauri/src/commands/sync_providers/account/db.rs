//! Named, single-purpose DB-lock scopes shared by the account sync
//! orchestrators (`feeds`, `entries`, `remote_state`). Each function acquires
//! `lock_db` exactly once; see the `SYNC_PROVIDERS_LOCK_DB_ALLOWLIST` pin in
//! `src/__tests__/config/sync-remote-state-lock-contract.node.test.ts`
//! (plan 025 lock-scope audit).
//!
//! `apply_remote_state_with_protection` is the one related lock scope that
//! does *not* live here: it stays in `remote_state.rs`, paired with
//! `pending_remote_ids_by_axis`, per
//! `.claude/rules/remote-state-reconciliation.md`.
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use crate::commands::dto::AppError;
use crate::commands::feed_commands::lock_db;
use crate::domain::account::Account;
use crate::domain::article::Article;
use crate::domain::feed::Feed;
use crate::domain::folder::Folder;
use crate::domain::provider::{RemoteFolder, GREADER_FEED_ID_PREFIX};
use crate::domain::types::{AccountId, FeedId, FolderId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_folder::SqliteFolderRepository;
use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::repository::article::ArticleRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;
use crate::repository::pending_mutation::{PendingMutation, PendingMutationRepository};
use crate::repository::sync_state::{SyncState, SyncStateRepository, SyncStateScopeKey};

use super::super::subscriptions::is_provider_managed_greader_feed;
use super::super::subscriptions::{folder_name_case_key, resolve_greader_folder_sort_order};
use super::ProviderManagedFeedSnapshot;

pub(crate) fn save_greader_folders_snapshot(
    db: &Mutex<DbManager>,
    account: &Account,
    remote_folders: &[RemoteFolder],
) -> Result<HashSet<String>, AppError> {
    let remote_folder_ids = remote_folders
        .iter()
        .filter(|folder| !folder.remote_id.trim().is_empty())
        .map(|folder| folder.remote_id.clone())
        .collect::<HashSet<_>>();
    let db_guard = lock_db(db)?;
    let folder_repo = SqliteFolderRepository::new(db_guard.writer());
    let mut local_folders = folder_repo.find_by_account(&account.id)?;
    let mut next_sort_order = local_folders
        .iter()
        .map(|folder| folder.sort_order)
        .max()
        .map_or(0, |sort_order| sort_order.saturating_add(1));

    for rf in remote_folders {
        let existing_remote_index = local_folders
            .iter()
            .position(|folder| folder.remote_id.as_deref() == Some(rf.remote_id.as_str()));
        let existing_name_index = if existing_remote_index.is_none() {
            let remote_name_key = folder_name_case_key(&rf.name);
            local_folders.iter().position(|folder| {
                folder.remote_id.is_some() && folder_name_case_key(&folder.name) == remote_name_key
            })
        } else {
            None
        };
        let existing_index = existing_remote_index.or(existing_name_index);
        let existing_folder = existing_index.and_then(|index| local_folders.get(index));
        let sort_order =
            resolve_greader_folder_sort_order(rf.sort_order, existing_folder, &mut next_sort_order);
        let folder = Folder {
            id: existing_folder
                .map(|folder| folder.id.clone())
                .unwrap_or_else(FolderId::new),
            account_id: account.id.clone(),
            remote_id: Some(rf.remote_id.clone()),
            name: rf.name.clone(),
            sort_order,
        };
        folder_repo.save(&folder)?;
        if let Some(index) = existing_index {
            local_folders[index] = folder;
        } else {
            local_folders.push(folder);
        }
    }

    Ok(remote_folder_ids)
}

pub(crate) fn provider_managed_feed_snapshots(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> Result<HashMap<String, ProviderManagedFeedSnapshot>, AppError> {
    let db_guard = lock_db(db)?;
    let mut stmt = db_guard
        .reader()
        .prepare(&format!(
            "SELECT f.id, f.title, COUNT(a.id)
         FROM feeds f
         LEFT JOIN articles a ON a.feed_id = f.id
         WHERE f.account_id = ?1 AND f.remote_id LIKE '{GREADER_FEED_ID_PREFIX}%'
         GROUP BY f.id, f.title"
        ))
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)?;

    let rows = stmt
        .query_map(rusqlite::params![account_id.as_ref()], |row| {
            Ok((
                row.get::<_, String>(0)?,
                ProviderManagedFeedSnapshot {
                    article_count: row.get::<_, i64>(2)? as usize,
                },
            ))
        })
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)?;

    rows.collect::<Result<HashMap<_, _>, _>>()
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)
}

/// Read all feeds owned by `account_id` inside a single reader lock scope.
pub(super) fn load_account_feeds(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> Result<Vec<Feed>, AppError> {
    let db_guard = lock_db(db)?;
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    Ok(feed_repo.find_by_account(account_id)?)
}

/// Recalculate unread counts for the GReader provider-managed subset of
/// `feeds`, inside a single writer lock scope.
pub(super) fn recalculate_provider_managed_feed_unread_counts(
    db: &Mutex<DbManager>,
    feeds: &[Feed],
) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    let managed_feed_ids: Vec<FeedId> = feeds
        .iter()
        .filter(|feed| is_provider_managed_greader_feed(feed.remote_id.as_deref()))
        .map(|feed| feed.id.clone())
        .collect();
    feed_repo.recalculate_unread_counts(&managed_feed_ids)?;
    Ok(())
}

/// Recalculate the unread count for a single feed, inside a single writer
/// lock scope.
pub(super) fn recalculate_single_feed_unread_count(
    db: &Mutex<DbManager>,
    feed_id: &FeedId,
) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    feed_repo.recalculate_unread_count(feed_id)?;
    Ok(())
}

/// Recalculate unread counts for every feed in `feeds`, inside a single
/// writer lock scope.
pub(super) fn recalculate_feed_unread_counts(
    db: &Mutex<DbManager>,
    feeds: &[Feed],
) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    let feed_ids: Vec<FeedId> = feeds.iter().map(|feed| feed.id.clone()).collect();
    feed_repo.recalculate_unread_counts(&feed_ids)?;
    Ok(())
}

/// Persist articles pulled for a full-account delta sync and clear their
/// muted-unread state, inside a single writer lock scope.
pub(super) fn persist_pulled_account_articles(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    articles: &[Article],
    candidate_ids: &[crate::domain::types::ArticleId],
) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let article_repo = SqliteArticleRepository::new(db_guard.writer());
    article_repo.upsert(articles)?;
    article_repo.mark_muted_unread_as_read(account_id, Some(candidate_ids))?;
    Ok(())
}

/// Persist articles pulled for a single-feed sync and clear their
/// muted-unread state, inside a single writer lock scope.
pub(super) fn persist_pulled_feed_articles(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    articles: &[Article],
) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let article_repo = SqliteArticleRepository::new(db_guard.writer());
    article_repo.upsert(articles)?;
    let candidate_ids = articles
        .iter()
        .map(|article| article.id.clone())
        .collect::<Vec<_>>();
    article_repo.mark_muted_unread_as_read(account_id, Some(&candidate_ids))?;
    Ok(())
}

/// Read the folder-id-by-remote-id map for `account_id`, inside a single
/// reader lock scope.
pub(super) fn load_folder_remote_id_map(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> Result<HashMap<String, FolderId>, AppError> {
    let db_guard = lock_db(db)?;
    let folder_repo = SqliteFolderRepository::new(db_guard.reader());
    let folders = folder_repo.find_by_account(account_id)?;
    Ok(folders
        .into_iter()
        .filter_map(|folder| folder.remote_id.map(|remote_id| (remote_id, folder.id)))
        .collect())
}

/// Read all pending mutations for `account_id`, inside a single reader lock
/// scope.
pub(super) fn load_pending_mutations_for_account(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> Result<Vec<PendingMutation>, AppError> {
    let db_guard = lock_db(db)?;
    let pending_repo = SqlitePendingMutationRepository::new(db_guard.reader());
    Ok(pending_repo.find_by_account(account_id)?)
}

/// Delete a single pending mutation by id, inside a single writer lock
/// scope. Shared by the dropped-mutation and successfully-pushed-mutation
/// paths in `sync_greader_feeds`.
pub(super) fn delete_pending_mutation(
    db: &Mutex<DbManager>,
    mutation_id: i64,
) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let pending_repo = SqlitePendingMutationRepository::new(db_guard.writer());
    pending_repo.delete(&[mutation_id])?;
    Ok(())
}

/// Read the saved sync state for a single feed, inside a single reader lock
/// scope.
pub(super) fn load_feed_sync_state(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    scope_key: &SyncStateScopeKey,
) -> Result<Option<SyncState>, AppError> {
    let db_guard = lock_db(db)?;
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    Ok(sync_state_repo.get(account_id, scope_key)?)
}

/// Save the updated sync state for a single feed, inside a single writer
/// lock scope.
pub(super) fn save_feed_sync_state(
    db: &Mutex<DbManager>,
    next_state: &SyncState,
) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
    Ok(sync_state_repo.save(next_state)?)
}
