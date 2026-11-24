use std::sync::{atomic::AtomicBool, Mutex};

use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::sync_providers::{GReaderSession, SessionError};
use crate::commands::AppState;
use crate::domain::account::Account;
use crate::domain::feed::Feed;
use crate::domain::provider::{FeedIdentifier, ProviderKind, RemoteEntry};
use crate::domain::types::{AccountId, FeedId};
use crate::domain::url_policy::validate_user_provided_feed_url;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::keyring_store::CredentialLookupMode;
use crate::infra::provider::traits::FeedProvider;
use crate::repository::account::AccountRepository;
use crate::repository::article::{ArticleMutationRepository, ArticleReadRepository, Pagination};
use crate::repository::feed::FeedRepository;
use crate::service::article_materializer::article_from_remote_entry;

use super::{lock_db, validate_feed_title};

#[tauri::command]
pub async fn delete_feed(state: State<'_, AppState>, feed_id: String) -> Result<(), AppError> {
    delete_feed_with_remote_sync_boundary(&state.db, state.syncing.as_ref(), feed_id).await
}

#[cfg(test)]
pub(crate) fn delete_feed_with_sync_boundary(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    feed_id: String,
) -> Result<(), AppError> {
    let _guard = crate::commands::start_database_maintenance(syncing)?;
    let db = lock_db(db)?;
    delete_feed_in_db(&db, feed_id)
}

pub(crate) fn delete_feed_in_db(db: &DbManager, feed_id: String) -> Result<(), AppError> {
    let repo = SqliteFeedRepository::new(db.writer());
    repo.delete(&FeedId(feed_id))?;
    Ok(())
}

pub(crate) fn load_feed_for_delete(db: &DbManager, feed_id: &FeedId) -> Result<Feed, AppError> {
    let repo = SqliteFeedRepository::new(db.reader());
    repo.find_by_id(feed_id)?
        .ok_or_else(|| AppError::UserVisible {
            message: "Validation error: feed not found".into(),
        })
}

pub(crate) fn load_delete_feed_account(
    db: &DbManager,
    account_id: &AccountId,
) -> Result<Account, AppError> {
    let repo = SqliteAccountRepository::new(db.reader());
    repo.find_by_id(account_id)?
        .ok_or_else(|| AppError::UserVisible {
            message: "Account not found".into(),
        })
}

#[cfg(test)]
pub(crate) async fn delete_feed_with_provider_sync_boundary<P: FeedProvider>(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    feed_id: String,
    provider: &P,
) -> Result<(), AppError> {
    let _guard = crate::commands::start_database_maintenance(syncing)?;
    delete_feed_after_provider_unsubscribe(db, feed_id, provider).await
}

async fn delete_feed_after_provider_unsubscribe<P: FeedProvider>(
    db: &Mutex<DbManager>,
    feed_id: String,
    provider: &P,
) -> Result<(), AppError> {
    let feed_id = FeedId(feed_id);
    let feed = {
        let db = lock_db(db)?;
        load_feed_for_delete(&db, &feed_id)?
    };

    let remote_id = resolve_remote_subscription_id_for_delete(provider, &feed)
        .await?
        .ok_or_else(|| AppError::UserVisible {
            message: "Remote subscription could not be found".into(),
        })?;
    provider
        .delete_subscription(&FeedIdentifier::Remote { remote_id })
        .await?;

    let db = lock_db(db)?;
    delete_feed_in_db(&db, feed_id.0)
}

async fn resolve_remote_subscription_id_for_delete<P: FeedProvider>(
    provider: &P,
    feed: &Feed,
) -> Result<Option<String>, AppError> {
    if let Some(remote_id) = feed.remote_id.clone() {
        return Ok(Some(remote_id));
    }

    let subscriptions = provider.get_subscriptions().await?;
    Ok(subscriptions
        .into_iter()
        .find(|subscription| subscription.url == feed.url)
        .map(|subscription| subscription.remote_id))
}

pub(crate) async fn delete_feed_with_remote_sync_boundary(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    feed_id: String,
) -> Result<(), AppError> {
    delete_feed_with_session(db, syncing, feed_id, |account, mode| async move {
        GReaderSession::establish_with_mode(&account, mode).await
    })
    .await
}

pub(super) async fn delete_feed_with_session<F, Fut>(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    feed_id: String,
    establish_session: F,
) -> Result<(), AppError>
where
    F: FnOnce(Account, CredentialLookupMode) -> Fut,
    Fut: std::future::Future<Output = Result<GReaderSession, SessionError>>,
{
    let _guard = crate::commands::start_database_maintenance(syncing)?;
    let feed_id = FeedId(feed_id);
    let feed = {
        let db = lock_db(db)?;
        load_feed_for_delete(&db, &feed_id)?
    };

    let account = {
        let db = lock_db(db)?;
        load_delete_feed_account(&db, &feed.account_id)?
    };
    if matches!(account.kind, ProviderKind::FreshRss) {
        let session = establish_session(account, CredentialLookupMode::Interactive)
            .await
            .map_err(SessionError::into_user_visible)?;
        return delete_feed_after_provider_unsubscribe(db, feed_id.0, session.provider()).await;
    }

    let db = lock_db(db)?;
    delete_feed_in_db(&db, feed_id.0)
}

#[tauri::command]
pub async fn rename_feed(
    state: State<'_, AppState>,
    feed_id: String,
    title: String,
) -> Result<(), AppError> {
    rename_feed_with_remote_sync_boundary(&state.db, state.syncing.as_ref(), feed_id, title).await
}

pub(crate) async fn rename_feed_with_remote_sync_boundary(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    feed_id: String,
    title: String,
) -> Result<(), AppError> {
    rename_feed_with_session(db, syncing, feed_id, title, |account, mode| async move {
        GReaderSession::establish_with_mode(&account, mode).await
    })
    .await
}

pub(super) async fn rename_feed_with_session<F, Fut>(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    feed_id: String,
    title: String,
    establish_session: F,
) -> Result<(), AppError>
where
    F: FnOnce(Account, CredentialLookupMode) -> Fut,
    Fut: std::future::Future<Output = Result<GReaderSession, SessionError>>,
{
    let _guard = crate::commands::start_database_maintenance(syncing)?;
    let title = validate_feed_title(&title)?;
    let feed_id_typed = FeedId(feed_id.clone());
    let feed = {
        let db = lock_db(db)?;
        load_feed_for_delete(&db, &feed_id_typed)?
    };
    let account = {
        let db = lock_db(db)?;
        load_delete_feed_account(&db, &feed.account_id)?
    };

    if matches!(account.kind, ProviderKind::FreshRss) {
        if let Some(remote_id) = feed.remote_id.clone() {
            let session = establish_session(account, CredentialLookupMode::Interactive)
                .await
                .map_err(SessionError::into_user_visible)?;
            session
                .provider()
                .edit_subscription(&remote_id, Some(&title), None, None)
                .await?;
        }
    }

    let db = lock_db(db)?;
    rename_feed_in_db(&db, feed_id, title)
}

pub(crate) fn rename_feed_in_db(
    db: &DbManager,
    feed_id: String,
    title: String,
) -> Result<(), AppError> {
    let title = validate_feed_title(&title)?;
    let repo = SqliteFeedRepository::new(db.writer());
    repo.rename(&FeedId(feed_id), &title)?;
    Ok(())
}

#[tauri::command]
pub async fn update_feed_url(
    state: State<'_, AppState>,
    feed_id: String,
    url: String,
) -> Result<(), AppError> {
    update_feed_url_with_boundary(&state.db, state.syncing.as_ref(), feed_id, url)
}

pub(crate) fn update_feed_url_with_boundary(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    feed_id: String,
    url: String,
) -> Result<(), AppError> {
    let _guard = crate::commands::start_database_maintenance(syncing)?;
    let feed_id_typed = FeedId(feed_id.clone());
    let feed = {
        let db = lock_db(db)?;
        load_feed_for_delete(&db, &feed_id_typed)?
    };
    let account = {
        let db = lock_db(db)?;
        load_delete_feed_account(&db, &feed.account_id)?
    };
    if !matches!(account.kind, ProviderKind::Local) {
        return Err(AppError::UserVisible {
            message: "Feed URL can only be changed for local feeds".into(),
        });
    }
    let url = normalize_feed_url_input(&url)?;
    let db = lock_db(db)?;
    update_feed_url_in_db(&db, &feed, &url)
}

fn normalize_feed_url_input(url: &str) -> Result<String, AppError> {
    let parsed = reqwest::Url::parse(url.trim()).map_err(|_| AppError::UserVisible {
        message: "Feed URL must be a valid URL".into(),
    })?;
    validate_user_provided_feed_url(&parsed)?;
    Ok(parsed.to_string())
}

pub(crate) fn update_feed_url_in_db(
    db: &DbManager,
    feed: &Feed,
    url: &str,
) -> Result<(), AppError> {
    let feed_repo = SqliteFeedRepository::new(db.reader());
    for existing in [
        feed_repo.find_by_url(&feed.account_id, url)?,
        feed_repo.find_by_remote_id(&feed.account_id, url)?,
    ]
    .into_iter()
    .flatten()
    {
        if existing.id != feed.id {
            return Err(AppError::UserVisible {
                message: "Feed URL is already subscribed".into(),
            });
        }
    }

    // Article IDs derive from the feed URL, so re-key the feed's articles to
    // the IDs the materializer will produce for the same entries fetched
    // from the new URL. Otherwise the next sync would insert them again as
    // unread duplicates.
    let article_repo = SqliteArticleRepository::new(db.reader());
    let mut id_pairs = Vec::new();
    let mut moved_feed = feed.clone();
    moved_feed.url = url.to_string();
    moved_feed.remote_id = Some(url.to_string());
    let mut offset = 0;
    loop {
        let page = article_repo.find_by_feed(&feed.id, &Pagination { offset, limit: 500 })?;
        let page_len = page.len();
        for article in page {
            let entry = RemoteEntry {
                id: article.remote_id.clone(),
                source_feed_id: FeedIdentifier::Local {
                    feed_url: url.to_string(),
                },
                title: article.title.clone(),
                content: article.content_raw.clone(),
                summary: article.summary.clone(),
                url: article.url.clone(),
                published_at: Some(article.published_at),
                updated_at: None,
                thumbnail: article.thumbnail.clone(),
                author: article.author.clone(),
                is_read: Some(article.is_read),
                is_starred: Some(article.is_starred),
            };
            let new_id = article_from_remote_entry(&feed.account_id, &moved_feed, &entry).id;
            if new_id != article.id {
                id_pairs.push((article.id, new_id));
            }
        }
        if page_len < 500 {
            break;
        }
        offset += page_len;
    }

    let feed_repo = SqliteFeedRepository::new(db.writer());
    feed_repo.update_url(&feed.id, url)?;
    if !id_pairs.is_empty() {
        let article_repo = SqliteArticleRepository::new(db.writer());
        article_repo.reassign_ids(&id_pairs)?;
    }
    Ok(())
}
