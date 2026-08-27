use std::sync::{atomic::AtomicBool, Mutex};

use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::sync_providers::{GReaderSession, SessionError};
use crate::commands::AppState;
use crate::domain::account::Account;
use crate::domain::feed::Feed;
use crate::domain::provider::{FeedIdentifier, ProviderKind};
use crate::domain::types::{AccountId, FeedId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::provider::traits::FeedProvider;
use crate::repository::account::AccountRepository;
use crate::repository::feed::FeedRepository;

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
        let session = GReaderSession::establish(&account)
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
            let session = GReaderSession::establish(&account)
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
