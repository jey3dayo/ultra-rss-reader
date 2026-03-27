use tauri::State;

use crate::commands::dto::{AppError, FeedDto, FolderDto};
use crate::commands::AppState;
use crate::domain::account::Account;
use crate::domain::feed::Feed;
use crate::domain::provider::ProviderKind;
use crate::domain::types::{AccountId, FeedId};
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_folder::SqliteFolderRepository;
use crate::infra::keyring_store;
use crate::infra::provider::freshrss::FreshRssProvider;
use crate::infra::provider::local::LocalProvider;
use crate::infra::provider::traits::{Credentials, FeedProvider};
use crate::repository::account::AccountRepository;
use crate::repository::article::ArticleRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;
use tracing::warn;

#[tauri::command]
pub fn list_folders(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<Vec<FolderDto>, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteFolderRepository::new(db.reader());
    let folders = repo.find_by_account(&AccountId(account_id))?;
    Ok(folders.into_iter().map(FolderDto::from).collect())
}

#[tauri::command]
pub fn list_feeds(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<Vec<FeedDto>, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteFeedRepository::new(db.reader());
    let feeds = repo.find_by_account(&AccountId(account_id))?;
    Ok(feeds.into_iter().map(FeedDto::from).collect())
}

#[tauri::command]
pub async fn add_local_feed(
    state: State<'_, AppState>,
    account_id: String,
    url: String,
) -> Result<FeedDto, AppError> {
    // 1. Validate by fetching the feed
    let provider = LocalProvider::new();
    let sub = provider.create_subscription(&url, None).await?;

    // 2. Save to DB
    let account_id = AccountId(account_id);
    let feed = Feed {
        id: FeedId::new(),
        account_id: account_id.clone(),
        folder_id: None,
        remote_id: Some(sub.remote_id),
        title: sub.title,
        url: sub.url,
        site_url: sub.site_url,
        icon: None,
        unread_count: 0,
    };

    {
        let db = state.db.lock().map_err(|e| AppError::UserVisible {
            message: format!("Lock error: {e}"),
        })?;
        let feed_repo = SqliteFeedRepository::new(db.writer());
        feed_repo.save(&feed)?;
    }

    // 3. Fetch initial articles for the new feed
    sync_local_feed(&state, &provider, &account_id, &feed).await?;

    // 4. Re-read unread count from DB
    let unread_count = {
        let db = state.db.lock().map_err(|e| AppError::UserVisible {
            message: format!("Lock error: {e}"),
        })?;
        let feed_repo = SqliteFeedRepository::new(db.reader());
        feed_repo.recalculate_unread_count(&feed.id).unwrap_or(0)
    };
    let mut updated_feed = feed;
    updated_feed.unread_count = unread_count;
    Ok(FeedDto::from(updated_feed))
}

/// Fetch articles for a single local feed and save them to DB.
async fn sync_local_feed(
    state: &State<'_, AppState>,
    provider: &LocalProvider,
    account_id: &AccountId,
    feed: &Feed,
) -> Result<(), AppError> {
    let scope = if let Some(ref remote_id) = feed.remote_id {
        crate::domain::provider::PullScope::Feed(crate::domain::provider::FeedIdentifier::Remote {
            remote_id: remote_id.clone(),
        })
    } else {
        crate::domain::provider::PullScope::Feed(crate::domain::provider::FeedIdentifier::Local {
            feed_url: feed.url.clone(),
        })
    };

    let result = provider.pull_entries(scope, None).await?;

    let articles: Vec<crate::domain::article::Article> = result
        .entries
        .iter()
        .map(|entry| {
            let id = crate::domain::article::generate_entry_id(
                account_id.as_ref(),
                entry.id.as_deref(),
                &feed.url,
                entry.url.as_deref(),
                Some(&entry.title),
            );
            crate::domain::article::Article {
                id,
                feed_id: feed.id.clone(),
                remote_id: entry.id.clone(),
                title: entry.title.clone(),
                content_raw: entry.content.clone(),
                content_sanitized: crate::infra::sanitizer::sanitize_html(&entry.content),
                sanitizer_version: crate::infra::sanitizer::SANITIZER_VERSION,
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
        let db = state.db.lock().map_err(|e| AppError::UserVisible {
            message: format!("Lock error: {e}"),
        })?;
        let article_repo = SqliteArticleRepository::new(db.writer());
        let feed_repo_w = SqliteFeedRepository::new(db.writer());
        article_repo.upsert(&articles)?;
        let _ = feed_repo_w.recalculate_unread_count(&feed.id);
    }
    Ok(())
}

/// Sync a FreshRSS account: authenticate, sync folders, subscriptions, entries, state, unread counts.
async fn sync_freshrss_account(
    state: &State<'_, AppState>,
    account: &Account,
) -> Result<(), AppError> {
    use crate::domain::folder::Folder;
    use crate::domain::types::FolderId;

    let server_url = match &account.server_url {
        Some(url) => url.clone(),
        None => {
            warn!(
                "FreshRSS account {} has no server_url, skipping",
                account.id.as_ref()
            );
            return Ok(());
        }
    };
    let username = match &account.username {
        Some(u) => u.clone(),
        None => {
            warn!(
                "FreshRSS account {} has no username, skipping",
                account.id.as_ref()
            );
            return Ok(());
        }
    };

    // Step 1: Authenticate (no DB lock)
    let password = keyring_store::get_password(account.id.as_ref())?;
    let mut provider = FreshRssProvider::new(&server_url);
    provider
        .authenticate(&Credentials {
            token: Some(username),
            password: Some(password),
        })
        .await?;

    // Step 2: Sync folders
    let remote_folders = provider.get_folders().await?;
    {
        let db = state.db.lock().map_err(|e| AppError::UserVisible {
            message: format!("Lock error: {e}"),
        })?;
        let folder_repo = SqliteFolderRepository::new(db.writer());
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

    // Steps 3-6
    sync_freshrss_feeds(state, &provider, account).await?;

    Ok(())
}

/// Steps 3-6: sync subscriptions, pull entries, apply remote state, recalculate unread counts.
async fn sync_freshrss_feeds(
    state: &State<'_, AppState>,
    provider: &FreshRssProvider,
    account: &Account,
) -> Result<(), AppError> {
    use std::collections::HashMap;

    use crate::domain::article::{generate_entry_id, Article};
    use crate::domain::provider::{FeedIdentifier, PullScope};
    use crate::domain::types::FolderId;
    use crate::infra::sanitizer;

    // Build remote_id -> FolderId map from existing folders
    let folder_remote_id_map: HashMap<String, FolderId> = {
        let db = state.db.lock().map_err(|e| AppError::UserVisible {
            message: format!("Lock error: {e}"),
        })?;
        let folder_repo = SqliteFolderRepository::new(db.reader());
        let folders = folder_repo.find_by_account(&account.id)?;
        folders
            .into_iter()
            .filter_map(|f| f.remote_id.map(|rid| (rid, f.id)))
            .collect()
    };

    // Step 3: Sync subscriptions
    let remote_subs = provider.get_subscriptions().await?;
    {
        let db = state.db.lock().map_err(|e| AppError::UserVisible {
            message: format!("Lock error: {e}"),
        })?;
        let feed_repo = SqliteFeedRepository::new(db.writer());
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
                    .or_else(|| existing.and_then(|f| f.folder_id)),
                remote_id: Some(rs.remote_id.clone()),
                title: rs.title.clone(),
                url: rs.url.clone(),
                site_url: rs.site_url.clone(),
                icon: None,
                unread_count: 0,
            };
            feed_repo.save(&feed)?;
        }
    }

    // Step 4: Pull entries per feed
    let feeds = {
        let db = state.db.lock().map_err(|e| AppError::UserVisible {
            message: format!("Lock error: {e}"),
        })?;
        let feed_repo = SqliteFeedRepository::new(db.reader());
        feed_repo.find_by_account(&account.id)?
    };

    for feed in &feeds {
        let scope = if let Some(ref remote_id) = feed.remote_id {
            PullScope::Feed(FeedIdentifier::Remote {
                remote_id: remote_id.clone(),
            })
        } else {
            continue; // Skip feeds without remote_id for FreshRSS
        };

        let result = match provider.pull_entries(scope, None).await {
            Ok(r) => r,
            Err(e) => {
                warn!("Failed to pull entries for feed {}: {e}", feed.url);
                continue;
            }
        };

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
            let db = state.db.lock().map_err(|e| AppError::UserVisible {
                message: format!("Lock error: {e}"),
            })?;
            let article_repo = SqliteArticleRepository::new(db.writer());
            article_repo.upsert(&articles)?;
        }
    }

    // Step 5: Pull remote state and apply
    let remote_state = provider.pull_state().await?;
    {
        let db = state.db.lock().map_err(|e| AppError::UserVisible {
            message: format!("Lock error: {e}"),
        })?;
        let article_repo = SqliteArticleRepository::new(db.writer());
        article_repo.apply_remote_state(
            &account.id,
            &remote_state.read_ids,
            &remote_state.starred_ids,
            &[], // no pending mutation IDs (out of scope)
        )?;
    }

    // Step 6: Recalculate unread counts
    {
        let db = state.db.lock().map_err(|e| AppError::UserVisible {
            message: format!("Lock error: {e}"),
        })?;
        let feed_repo = SqliteFeedRepository::new(db.writer());
        for feed in &feeds {
            let _ = feed_repo.recalculate_unread_count(&feed.id);
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn trigger_sync(state: State<'_, AppState>) -> Result<(), AppError> {
    let accounts: Vec<Account> = {
        let db = state.db.lock().map_err(|e| AppError::UserVisible {
            message: format!("Lock error: {e}"),
        })?;
        let account_repo = SqliteAccountRepository::new(db.reader());
        account_repo.find_all()?
    };

    for account in &accounts {
        match account.kind {
            ProviderKind::Local => {
                let provider = LocalProvider::new();
                let feeds = {
                    let db = state.db.lock().map_err(|e| AppError::UserVisible {
                        message: format!("Lock error: {e}"),
                    })?;
                    let feed_repo = SqliteFeedRepository::new(db.reader());
                    feed_repo.find_by_account(&account.id)?
                };
                for feed in &feeds {
                    let _ = sync_local_feed(&state, &provider, &account.id, feed).await;
                }
            }
            ProviderKind::FreshRss => {
                if let Err(e) = sync_freshrss_account(&state, account).await {
                    warn!(
                        "FreshRSS sync failed for account {}: {e}",
                        account.id.as_ref()
                    );
                }
            }
            ProviderKind::Inoreader => {
                warn!(
                    "Inoreader sync not yet implemented, skipping account {}",
                    account.id.as_ref()
                );
            }
        }
    }
    Ok(())
}
