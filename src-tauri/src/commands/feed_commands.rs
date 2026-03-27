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
use crate::infra::provider::local::LocalProvider;
use crate::infra::provider::traits::FeedProvider;
use crate::repository::account::AccountRepository;
use crate::repository::article::ArticleRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;

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
        crate::domain::provider::PullScope::Feed(
            crate::domain::provider::FeedIdentifier::Remote {
                remote_id: remote_id.clone(),
            },
        )
    } else {
        crate::domain::provider::PullScope::Feed(
            crate::domain::provider::FeedIdentifier::Local {
                feed_url: feed.url.clone(),
            },
        )
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

#[tauri::command]
pub async fn trigger_sync(state: State<'_, AppState>) -> Result<(), AppError> {
    // Read accounts with lock, then drop lock before async work
    let accounts: Vec<Account> = {
        let db = state.db.lock().map_err(|e| AppError::UserVisible {
            message: format!("Lock error: {e}"),
        })?;
        let account_repo = SqliteAccountRepository::new(db.reader());
        account_repo.find_all()?
    };

    for account in &accounts {
        if account.kind == ProviderKind::Local {
            let provider = LocalProvider::new();

            // Read feed URLs under lock, then drop lock
            let feeds = {
                let db = state.db.lock().map_err(|e| AppError::UserVisible {
                    message: format!("Lock error: {e}"),
                })?;
                let feed_repo = SqliteFeedRepository::new(db.reader());
                feed_repo.find_by_account(&account.id)?
            };

            // Pull entries from network (no lock held)
            for feed in &feeds {
                // Ignore individual feed errors during sync
                let _ = sync_local_feed(&state, &provider, &account.id, feed).await;
            }
        }
        // FreshRSS sync would go here when credentials are available
    }
    Ok(())
}
