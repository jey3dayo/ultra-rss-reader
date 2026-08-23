use std::sync::Mutex;

use tauri::State;

use crate::commands::dto::{AppError, FeedDto};
use crate::commands::AppState;
use crate::domain::feed::Feed;
use crate::domain::provider::ProviderKind;
use crate::domain::types::{AccountId, FeedId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::local::LocalProvider;
use crate::infra::provider::traits::{Credentials, FeedProvider};
use crate::repository::account::AccountRepository;
use crate::repository::feed::FeedRepository;

use super::lock_db;

pub(crate) fn recalculate_feed_unread_count_in_db(
    db: &DbManager,
    feed_id: &FeedId,
) -> Result<i32, AppError> {
    let feed_repo = SqliteFeedRepository::new(db.writer());
    Ok(feed_repo.recalculate_unread_count(feed_id)?)
}

pub(crate) fn validate_add_local_feed_account_in_db(
    db: &DbManager,
    account_id: &AccountId,
) -> Result<crate::domain::account::Account, AppError> {
    let account_repo = SqliteAccountRepository::new(db.reader());
    let account = account_repo
        .find_by_id(account_id)?
        .ok_or_else(|| AppError::UserVisible {
            message: "Account not found".into(),
        })?;

    if !matches!(account.kind, ProviderKind::Local | ProviderKind::FreshRss) {
        return Err(AppError::UserVisible {
            message: "Feed can only be added to a Local or FreshRSS account".into(),
        });
    }

    Ok(account)
}

fn validate_add_local_feed_account_still_local_in_db(
    db: &DbManager,
    account_id: &AccountId,
) -> Result<(), AppError> {
    let account = validate_add_local_feed_account_in_db(db, account_id)?;
    if !matches!(account.kind, ProviderKind::Local) {
        return Err(AppError::UserVisible {
            message: "Feed can only be added to a Local account".into(),
        });
    }
    Ok(())
}

pub(crate) fn validate_add_freshrss_feed_preflight_in_db(
    db: &DbManager,
    account_id: &AccountId,
    url: &str,
) -> Result<(), AppError> {
    let account = validate_add_local_feed_account_in_db(db, account_id)?;
    if !matches!(account.kind, ProviderKind::FreshRss) {
        return Err(AppError::UserVisible {
            message: "Feed can only be added to a FreshRSS account".into(),
        });
    }
    validate_add_local_feed_duplicate_url_in_db(db, account_id, url)
}

pub(crate) fn validate_add_freshrss_subscription_unique_in_db(
    db: &DbManager,
    account_id: &AccountId,
    url: &str,
    remote_id: &str,
) -> Result<(), AppError> {
    validate_add_local_feed_duplicate_url_in_db(db, account_id, url)?;
    let feed_repo = SqliteFeedRepository::new(db.reader());
    if feed_repo
        .find_by_remote_id(account_id, remote_id)?
        .is_some()
    {
        return Err(AppError::UserVisible {
            message: "Feed URL is already subscribed".into(),
        });
    }
    Ok(())
}

#[tauri::command]
pub async fn add_local_feed(
    state: State<'_, AppState>,
    account_id: String,
    url: String,
) -> Result<FeedDto, AppError> {
    add_local_feed_with_db(&state.db, account_id, url).await
}

pub(crate) async fn add_local_feed_with_db(
    db: &Mutex<DbManager>,
    account_id: String,
    url: String,
) -> Result<FeedDto, AppError> {
    let provider = LocalProvider::new();
    add_local_feed_with_provider(db, account_id, url, &provider).await
}

pub(crate) async fn add_local_feed_with_provider(
    db: &Mutex<DbManager>,
    account_id: String,
    url: String,
    provider: &LocalProvider,
) -> Result<FeedDto, AppError> {
    let account_id = AccountId(account_id);

    let account = {
        let db = lock_db(db)?;
        validate_add_local_feed_account_in_db(&db, &account_id)?
    };

    if matches!(account.kind, ProviderKind::FreshRss) {
        return add_freshrss_feed_with_account(db, account, url).await;
    }

    // 1. Validate by fetching the feed
    let sub = provider.create_subscription(&url, None).await?;

    // 2. Save to DB
    let feed = Feed {
        id: FeedId::new(),
        account_id: account_id.clone(),
        folder_id: None,
        remote_id: Some(sub.remote_id),
        title: sub.title,
        url: sub.url,
        site_url: sub.site_url,
        icon: None,
        icon_url: sub.icon_url,
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    };

    {
        let db = lock_db(db)?;
        validate_add_local_feed_account_still_local_in_db(&db, &account_id)?;
        validate_add_local_feed_duplicate_url_in_db(&db, &account_id, &feed.url)?;
        let feed_repo = SqliteFeedRepository::new(db.writer());
        feed_repo.save(&feed)?;
    }

    let persisted_feed = {
        let db = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db.reader());
        let persisted_feed = feed_repo
            .find_by_url(&account_id, &feed.url)?
            .ok_or_else(|| AppError::UserVisible {
                message: "Saved feed could not be reloaded".into(),
            })?;
        if persisted_feed.id != feed.id {
            return Err(AppError::UserVisible {
                message: "Feed URL is already subscribed".into(),
            });
        }
        persisted_feed
    };

    // 3. Fetch initial articles for the new feed
    if let Err(error) =
        crate::commands::sync_providers::sync_local_feed(db, provider, &account_id, &persisted_feed)
            .await
    {
        rollback_added_feed(db, &persisted_feed.id, &error);
        return Err(error);
    }

    // 4. Re-read unread count from DB
    let unread_count_result = {
        let db_guard = lock_db(db)?;
        recalculate_feed_unread_count_in_db(&db_guard, &persisted_feed.id)
    };
    let unread_count = match unread_count_result {
        Ok(unread_count) => unread_count,
        Err(error) => {
            rollback_added_feed_after_command_error(db, &persisted_feed.id, &error);
            return Err(error);
        }
    };
    let mut updated_feed = persisted_feed;
    updated_feed.unread_count = unread_count;
    Ok(FeedDto::from(updated_feed))
}

async fn add_freshrss_feed_with_account(
    db: &Mutex<DbManager>,
    account: crate::domain::account::Account,
    url: String,
) -> Result<FeedDto, AppError> {
    {
        let db = lock_db(db)?;
        validate_add_freshrss_feed_preflight_in_db(&db, &account.id, &url)?;
    }

    let username = account
        .username
        .clone()
        .ok_or_else(|| AppError::UserVisible {
            message: "FreshRSS username is required".into(),
        })?;
    let server_url = account
        .server_url
        .as_deref()
        .ok_or_else(|| AppError::UserVisible {
            message: "FreshRSS server URL is required".into(),
        })?;

    let mut provider = GReaderProvider::for_freshrss(server_url);
    let password = crate::commands::sync_providers::get_greader_password(&account).await?;
    provider
        .authenticate(&Credentials {
            token: Some(username),
            password: Some(password),
        })
        .await?;

    let sub = provider.create_subscription(&url, None).await?;
    let feed = Feed {
        id: FeedId::new(),
        account_id: account.id.clone(),
        folder_id: None,
        remote_id: Some(sub.remote_id),
        title: sub.title,
        url: sub.url,
        site_url: sub.site_url,
        icon: None,
        icon_url: sub.icon_url,
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    };

    {
        let db = lock_db(db)?;
        validate_add_freshrss_feed_preflight_in_db(&db, &account.id, &feed.url)?;
        if let Some(remote_id) = feed.remote_id.as_deref() {
            validate_add_freshrss_subscription_unique_in_db(
                &db,
                &account.id,
                &feed.url,
                remote_id,
            )?;
        }
        let feed_repo = SqliteFeedRepository::new(db.writer());
        feed_repo.save(&feed)?;
    }

    let persisted_feed = {
        let db = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db.reader());
        let persisted_feed = feed_repo
            .find_by_url(&account.id, &feed.url)?
            .ok_or_else(|| AppError::UserVisible {
                message: "Saved feed could not be reloaded".into(),
            })?;
        if persisted_feed.id != feed.id {
            return Err(AppError::UserVisible {
                message: "Feed URL is already subscribed".into(),
            });
        }
        persisted_feed
    };

    if let Err(error) =
        crate::commands::sync_providers::sync_greader_feed(db, &account, &persisted_feed, provider)
            .await
    {
        tracing::warn!("FreshRSS feed was added but initial article sync failed: {error}");
    }

    let unread_count = {
        let db_guard = lock_db(db)?;
        recalculate_feed_unread_count_in_db(&db_guard, &persisted_feed.id)?
    };
    let mut updated_feed = persisted_feed;
    updated_feed.unread_count = unread_count;
    Ok(FeedDto::from(updated_feed))
}

pub(crate) fn validate_add_local_feed_duplicate_url_in_db(
    db: &DbManager,
    account_id: &AccountId,
    url: &str,
) -> Result<(), AppError> {
    let feed_repo = SqliteFeedRepository::new(db.reader());
    if feed_repo.find_by_url(account_id, url)?.is_some() {
        return Err(AppError::UserVisible {
            message: "Feed URL is already subscribed".into(),
        });
    }
    Ok(())
}

fn rollback_added_feed(db: &Mutex<DbManager>, feed_id: &FeedId, error: &AppError) {
    if let Err(cleanup_error) = rollback_added_feed_in_db(db, feed_id) {
        tracing::warn!(
            "Failed to roll back added local feed after initial sync failure: {cleanup_error}; original error: {error}"
        );
    }
}

fn rollback_added_feed_after_command_error(
    db: &Mutex<DbManager>,
    feed_id: &FeedId,
    error: &AppError,
) {
    if let Err(cleanup_error) = rollback_added_feed_in_db(db, feed_id) {
        tracing::warn!(
            "Failed to roll back added local feed after command failure: {cleanup_error}; original error: {error}"
        );
    }
}

fn rollback_added_feed_in_db(db: &Mutex<DbManager>, feed_id: &FeedId) -> Result<(), AppError> {
    let db = lock_db(db)?;
    let feed_repo = SqliteFeedRepository::new(db.writer());
    feed_repo.delete(feed_id)?;
    Ok(())
}
