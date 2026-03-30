use std::collections::HashMap;
use std::sync::Mutex;

use tracing::warn;

use crate::commands::dto::AppError;
use crate::domain::account::Account;
use crate::domain::article::{generate_entry_id, Article};
use crate::domain::feed::Feed;
use crate::domain::provider::{FeedIdentifier, Mutation, PullScope, SyncCursor};
use crate::domain::types::{AccountId, FeedId, FolderId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_folder::SqliteFolderRepository;
use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::infra::keyring_store;
use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::local::LocalProvider;
use crate::infra::provider::traits::{Credentials, FeedProvider};
use crate::infra::sanitizer;
use crate::repository::article::ArticleRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;
use crate::repository::pending_mutation::PendingMutationRepository;
use crate::repository::sync_state::{SyncState, SyncStateRepository};

use super::feed_commands::lock_db;

/// Fetch articles for a single local feed and save them to DB.
pub(super) async fn sync_local_feed(
    db: &Mutex<DbManager>,
    provider: &LocalProvider,
    account_id: &AccountId,
    feed: &Feed,
) -> Result<(), AppError> {
    let scope = PullScope::Feed(FeedIdentifier::Local {
        feed_url: feed.url.clone(),
    });

    let result = provider.pull_entries(scope, None).await?;

    let articles: Vec<Article> = result
        .entries
        .iter()
        .map(|entry| {
            let id = generate_entry_id(
                account_id.as_ref(),
                entry.id.as_deref(),
                &feed.url,
                entry.url.as_deref(),
                Some(&entry.title),
            );
            Article {
                id,
                feed_id: feed.id.clone(),
                remote_id: entry.id.clone(),
                title: entry.title.clone(),
                content_raw: entry.content.clone(),
                content_sanitized: sanitizer::sanitize_html(&entry.content),
                sanitizer_version: sanitizer::SANITIZER_VERSION,
                summary: entry.summary.clone(),
                url: entry.url.clone(),
                author: entry.author.clone(),
                published_at: entry.published_at.unwrap_or_else(chrono::Utc::now),
                thumbnail: entry.thumbnail.clone(),
                is_read: entry.is_read.unwrap_or(false),
                is_starred: entry.is_starred.unwrap_or(false),
                fetched_at: chrono::Utc::now(),
            }
        })
        .collect();

    if !articles.is_empty() {
        let db_guard = lock_db(db)?;
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let feed_repo_w = SqliteFeedRepository::new(db_guard.writer());
        article_repo.upsert(&articles)?;
        let _ = feed_repo_w.recalculate_unread_count(&feed.id);
    }
    Ok(())
}

/// Sync a GReader-compatible account (FreshRSS, Inoreader): authenticate, sync folders, subscriptions, entries, state, unread counts.
pub(super) async fn sync_greader_account(
    db: &Mutex<DbManager>,
    account: &Account,
    mut provider: GReaderProvider,
) -> Result<(), AppError> {
    use crate::domain::folder::Folder;

    let username = match &account.username {
        Some(u) => u.clone(),
        None => {
            warn!(
                "GReader account {} has no username, skipping",
                account.id.as_ref()
            );
            return Ok(());
        }
    };

    // Step 1: Authenticate (no DB lock)
    let password = keyring_store::get_password(account.id.as_ref())?;
    provider
        .authenticate(&Credentials {
            token: Some(username),
            password: Some(password),
        })
        .await?;

    // Step 2: Sync folders
    let remote_folders = provider.get_folders().await?;
    {
        let db_guard = lock_db(db)?;
        let folder_repo = SqliteFolderRepository::new(db_guard.writer());
        for rf in &remote_folders {
            let existing_id = folder_repo
                .find_by_remote_id(&account.id, &rf.remote_id)?
                .map(|f| f.id);
            let folder = Folder {
                id: existing_id.unwrap_or_else(FolderId::new),
                account_id: account.id.clone(),
                remote_id: Some(rf.remote_id.clone()),
                name: rf.name.clone(),
                sort_order: rf.sort_order.unwrap_or(0),
            };
            folder_repo.save(&folder)?;
        }
    }

    // Steps 3-7
    sync_greader_feeds(db, &provider, account).await?;

    Ok(())
}

/// Steps 3-7: sync subscriptions, pull entries, push mutations, apply remote state, recalculate unread counts.
async fn sync_greader_feeds(
    db: &Mutex<DbManager>,
    provider: &GReaderProvider,
    account: &Account,
) -> Result<(), AppError> {
    // Build remote_id -> FolderId map from existing folders
    let folder_remote_id_map: HashMap<String, FolderId> = {
        let db_guard = lock_db(db)?;
        let folder_repo = SqliteFolderRepository::new(db_guard.reader());
        let folders = folder_repo.find_by_account(&account.id)?;
        folders
            .into_iter()
            .filter_map(|f| f.remote_id.map(|rid| (rid, f.id)))
            .collect()
    };

    // Step 3: Sync subscriptions
    let remote_subs = provider.get_subscriptions().await?;
    {
        let db_guard = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        for rs in &remote_subs {
            let existing = feed_repo.find_by_remote_id(&account.id, &rs.remote_id)?;
            let feed = Feed {
                id: existing
                    .as_ref()
                    .map(|f| f.id.clone())
                    .unwrap_or_else(FeedId::new),
                account_id: account.id.clone(),
                folder_id: rs
                    .folder_remote_id
                    .as_ref()
                    .and_then(|rid| folder_remote_id_map.get(rid))
                    .cloned()
                    .or_else(|| existing.as_ref().and_then(|f| f.folder_id.clone())),
                remote_id: Some(rs.remote_id.clone()),
                title: rs.title.clone(),
                url: rs.url.clone(),
                site_url: rs.site_url.clone(),
                icon: None,
                unread_count: 0,
                display_mode: existing
                    .as_ref()
                    .map(|f| f.display_mode.clone())
                    .unwrap_or_else(|| "normal".to_string()),
            };
            feed_repo.save(&feed)?;
        }
    }

    // Step 4: Pull entries per feed
    let feeds = {
        let db_guard = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db_guard.reader());
        feed_repo.find_by_account(&account.id)?
    };

    for feed in &feeds {
        if let Err(e) = sync_greader_feed_entries(db, provider, account, feed).await {
            warn!("Failed to pull entries for feed {}: {e}", feed.url);
        }
    }

    // Step 5: Push pending mutations to server one by one
    let pending_mutations = {
        let db_guard = lock_db(db)?;
        let pending_repo = SqlitePendingMutationRepository::new(db_guard.reader());
        pending_repo.find_by_account(&account.id)?
    };

    let mut pushed_remote_ids: Vec<String> = Vec::new();
    for pm in &pending_mutations {
        let mutation = match pm.mutation_type.as_str() {
            "mark_read" => Mutation::MarkRead {
                remote_entry_id: pm.remote_entry_id.clone(),
            },
            "mark_unread" => Mutation::MarkUnread {
                remote_entry_id: pm.remote_entry_id.clone(),
            },
            "star" => Mutation::SetStarred {
                remote_entry_id: pm.remote_entry_id.clone(),
                starred: true,
            },
            "unstar" => Mutation::SetStarred {
                remote_entry_id: pm.remote_entry_id.clone(),
                starred: false,
            },
            other => {
                warn!("Unknown mutation type: {other}");
                continue;
            }
        };

        match provider.push_mutations(&[mutation]).await {
            Ok(()) => {
                pushed_remote_ids.push(pm.remote_entry_id.clone());
                if let Some(id) = pm.id {
                    let db_guard = lock_db(db)?;
                    let pending_repo = SqlitePendingMutationRepository::new(db_guard.writer());
                    pending_repo.delete(&[id])?;
                }
            }
            Err(e) => {
                warn!(
                    "Failed to push mutation {} for entry {}: {e}. Will retry next sync.",
                    pm.mutation_type, pm.remote_entry_id
                );
            }
        }
    }

    // Step 6: Pull remote state and apply (skip articles with pending or just-pushed mutations)
    let pending_remote_ids: Vec<String> = {
        let db_guard = lock_db(db)?;
        let pending_repo = SqlitePendingMutationRepository::new(db_guard.reader());
        let mut ids: Vec<String> = pending_repo
            .find_by_account(&account.id)?
            .into_iter()
            .map(|pm| pm.remote_entry_id)
            .collect();
        // Merge with successfully pushed IDs to prevent stale remote data from overwriting
        ids.extend(pushed_remote_ids);
        ids.sort();
        ids.dedup();
        ids
    };

    let remote_state = provider.pull_state().await?;
    {
        let db_guard = lock_db(db)?;
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        article_repo.apply_remote_state(
            &account.id,
            &remote_state.read_ids,
            &remote_state.starred_ids,
            &pending_remote_ids,
        )?;
    }

    // Step 7: Recalculate unread counts
    {
        let db_guard = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        for feed in &feeds {
            let _ = feed_repo.recalculate_unread_count(&feed.id);
        }
    }

    Ok(())
}

fn feed_scope_key(remote_id: &str) -> String {
    format!("feed:{remote_id}")
}

fn cursor_from_state(state: Option<&SyncState>) -> Option<SyncCursor> {
    state.map(|state| SyncCursor {
        continuation: state.continuation.clone(),
        since: state
            .timestamp_usec
            .and_then(chrono::DateTime::from_timestamp_micros),
        etag: state.etag.clone(),
        last_modified: state.last_modified.clone(),
    })
}

async fn sync_greader_feed_entries(
    db: &Mutex<DbManager>,
    provider: &GReaderProvider,
    account: &Account,
    feed: &Feed,
) -> Result<(), AppError> {
    let Some(remote_id) = feed.remote_id.as_ref() else {
        return Ok(());
    };

    let scope_key = feed_scope_key(remote_id);
    let saved_state = {
        let db_guard = lock_db(db)?;
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
        sync_state_repo.get(&account.id, &scope_key)?
    };
    let initial_cursor = cursor_from_state(saved_state.as_ref());
    let mut cursor = initial_cursor.clone();
    let mut latest_timestamp_usec = saved_state.as_ref().and_then(|state| state.timestamp_usec);

    loop {
        let scope = PullScope::Feed(FeedIdentifier::Remote {
            remote_id: remote_id.clone(),
        });
        let result = provider.pull_entries(scope, cursor.clone()).await?;

        if let Some(next_cursor) = result.next_cursor.as_ref() {
            if let Some(next_timestamp_usec) = next_cursor.since.map(|ts| ts.timestamp_micros()) {
                latest_timestamp_usec = Some(
                    latest_timestamp_usec
                        .map(|current| current.max(next_timestamp_usec))
                        .unwrap_or(next_timestamp_usec),
                );
            }
        }

        let articles: Vec<Article> = result
            .entries
            .iter()
            .map(|entry| {
                let id = generate_entry_id(
                    account.id.as_ref(),
                    entry.id.as_deref(),
                    &feed.url,
                    entry.url.as_deref(),
                    Some(&entry.title),
                );
                Article {
                    id,
                    feed_id: feed.id.clone(),
                    remote_id: entry.id.clone(),
                    title: entry.title.clone(),
                    content_raw: entry.content.clone(),
                    content_sanitized: sanitizer::sanitize_html(&entry.content),
                    sanitizer_version: sanitizer::SANITIZER_VERSION,
                    summary: entry.summary.clone(),
                    url: entry.url.clone(),
                    author: entry.author.clone(),
                    published_at: entry.published_at.unwrap_or_else(chrono::Utc::now),
                    thumbnail: entry.thumbnail.clone(),
                    is_read: entry.is_read.unwrap_or(false),
                    is_starred: entry.is_starred.unwrap_or(false),
                    fetched_at: chrono::Utc::now(),
                }
            })
            .collect();

        if !articles.is_empty() {
            let db_guard = lock_db(db)?;
            let article_repo = SqliteArticleRepository::new(db_guard.writer());
            article_repo.upsert(&articles)?;
        }

        if !result.has_more {
            break;
        }

        cursor = result.next_cursor.clone();
    }

    let next_state = SyncState {
        account_id: account.id.clone(),
        scope_key,
        timestamp_usec: latest_timestamp_usec,
        continuation: None,
        etag: saved_state.as_ref().and_then(|state| state.etag.clone()),
        last_modified: saved_state
            .as_ref()
            .and_then(|state| state.last_modified.clone()),
        last_success_at: Some(chrono::Utc::now().to_rfc3339()),
        last_error: None,
        error_count: 0,
        next_retry_at: None,
    };
    let db_guard = lock_db(db)?;
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
    sync_state_repo.save(&next_state)?;

    Ok(())
}
