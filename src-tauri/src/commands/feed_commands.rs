use std::sync::{atomic::AtomicBool, Mutex};

use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

use crate::commands::dto::{AppError, FeedDto, FolderDto};
use crate::commands::AppState;
use crate::domain::account::Account;
use crate::domain::error::DomainError;
use crate::domain::feed::Feed;
use crate::domain::folder::normalize_folder_name as normalize_folder_domain_name;
use crate::domain::provider::{FeedIdentifier, ProviderKind};
use crate::domain::types::{AccountId, FeedId, FolderId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_folder::SqliteFolderRepository;
use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::local::LocalProvider;
use crate::infra::provider::traits::{Credentials, FeedProvider};
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;

use crate::commands::dto::DiscoveredFeedDto;
use crate::infra::feed_discovery;
use crate::repository::account::AccountRepository;

const FEED_TITLE_MAX_CHARS: usize = 200;
const UPDATE_FEED_FOLDER_TARGET_VALIDATION_MESSAGE: &str =
    "feed not found or folder does not belong to feed account";
const FOLDER_NAME_UNIQUE_INDEX: &str = "idx_folders_account_name_nocase_unique";
const FOLDER_LOCAL_NAME_UNIQUE_INDEX: &str = "idx_folders_account_local_name_nocase_unique";
const FOLDER_SORT_ORDER_UNIQUE_INDEX: &str = "idx_folders_account_sort_order_unique";

pub(super) fn lock_db(
    db: &Mutex<DbManager>,
) -> Result<std::sync::MutexGuard<'_, DbManager>, AppError> {
    crate::commands::lock_db(db)
}

pub(super) fn validate_feed_title(title: &str) -> Result<String, AppError> {
    let title = title.trim();
    if title.is_empty() {
        return Err(AppError::UserVisible {
            message: "Feed title cannot be empty".into(),
        });
    }
    if title.chars().count() > FEED_TITLE_MAX_CHARS {
        return Err(AppError::UserVisible {
            message: format!("Feed title must be {FEED_TITLE_MAX_CHARS} characters or less"),
        });
    }
    Ok(title.to_string())
}

pub(super) fn normalize_folder_name(name: &str) -> Result<String, AppError> {
    normalize_folder_domain_name(name).map_err(|error| match error {
        DomainError::Validation(message) => AppError::UserVisible { message },
        error => AppError::from(error),
    })
}

fn validate_folder_name(name: &str, existing_names: &[String]) -> Result<String, AppError> {
    let name = normalize_folder_name(name)?;
    if existing_names
        .iter()
        .any(|existing| existing.eq_ignore_ascii_case(&name))
    {
        return Err(AppError::UserVisible {
            message: format!("Folder name \"{name}\" is already in use"),
        });
    }
    Ok(name.to_string())
}

fn classify_create_folder_persistence_error(error: DomainError, name: &str) -> AppError {
    match &error {
        DomainError::Persistence(message)
            if message.contains(FOLDER_NAME_UNIQUE_INDEX)
                || message.contains(FOLDER_LOCAL_NAME_UNIQUE_INDEX) =>
        {
            AppError::UserVisible {
                message: format!("Folder name \"{name}\" is already in use"),
            }
        }
        DomainError::Persistence(message)
            if message.contains(FOLDER_SORT_ORDER_UNIQUE_INDEX)
                || message.contains("folders.account_id, folders.sort_order") =>
        {
            AppError::UserVisible {
                message: "Folder order changed while creating the folder. Please retry.".into(),
            }
        }
        _ => AppError::from(error),
    }
}

#[tauri::command]
pub fn list_folders(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<Vec<FolderDto>, AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteFolderRepository::new(db.reader());
    let folders = repo.find_by_account(&AccountId(account_id))?;
    Ok(folders.into_iter().map(FolderDto::from).collect())
}

#[tauri::command]
pub fn list_feeds(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<Vec<FeedDto>, AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteFeedRepository::new(db.reader());
    let feeds = repo.find_by_account(&AccountId(account_id))?;
    Ok(feeds.into_iter().map(FeedDto::from).collect())
}

#[tauri::command]
pub fn create_folder(
    state: State<'_, AppState>,
    account_id: String,
    name: String,
) -> Result<FolderDto, AppError> {
    let db = lock_db(&state.db)?;
    create_folder_in_db(&db, account_id, name)
}

fn create_folder_in_db(
    db: &DbManager,
    account_id: String,
    name: String,
) -> Result<FolderDto, AppError> {
    use crate::domain::folder::Folder;

    let account_id = AccountId(account_id);
    let tx = db
        .writer()
        .unchecked_transaction()
        .map_err(|error| DomainError::Persistence(error.to_string()))?;
    let account_repo = SqliteAccountRepository::new(&tx);
    if account_repo.find_by_id(&account_id)?.is_none() {
        return Err(AppError::UserVisible {
            message: "Account not found".into(),
        });
    }

    let folder_repo = SqliteFolderRepository::new(&tx);
    let existing = folder_repo.find_by_account(&account_id)?;
    for (sort_order, folder) in existing.iter().enumerate() {
        let sort_order = i32::try_from(sort_order).map_err(|error| {
            DomainError::Persistence(format!("Folder sort order overflow: {error}"))
        })?;
        if folder.sort_order != sort_order {
            tx.execute(
                "UPDATE folders SET sort_order = ?1 WHERE id = ?2",
                params![sort_order, &folder.id.0],
            )
            .map_err(|error| DomainError::Persistence(error.to_string()))?;
        }
    }
    let name = validate_folder_name(
        &name,
        &existing
            .iter()
            .filter(|folder| folder.remote_id.is_none())
            .map(|folder| folder.name.clone())
            .collect::<Vec<_>>(),
    )?;
    let sort_order = i32::try_from(existing.len()).map_err(|error| {
        DomainError::Persistence(format!("Folder sort order overflow: {error}"))
    })?;

    // NOTE: Local-only folder; remote sync will be handled in a future iteration
    let folder = Folder {
        id: FolderId::new(),
        account_id,
        remote_id: None,
        name,
        sort_order,
    };
    folder_repo
        .save(&folder)
        .map_err(|error| classify_create_folder_persistence_error(error, &folder.name))?;
    tx.commit()
        .map_err(|error| DomainError::Persistence(error.to_string()))?;
    Ok(FolderDto::from(folder))
}

#[tauri::command]
pub async fn delete_feed(state: State<'_, AppState>, feed_id: String) -> Result<(), AppError> {
    delete_feed_with_remote_sync_boundary(&state.db, state.syncing.as_ref(), feed_id).await
}

#[cfg(test)]
fn delete_feed_with_sync_boundary(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    feed_id: String,
) -> Result<(), AppError> {
    let _guard = crate::commands::start_database_maintenance(syncing)?;
    let db = lock_db(db)?;
    delete_feed_in_db(&db, feed_id)
}

fn delete_feed_in_db(db: &DbManager, feed_id: String) -> Result<(), AppError> {
    let repo = SqliteFeedRepository::new(db.writer());
    repo.delete(&FeedId(feed_id))?;
    Ok(())
}

fn load_feed_for_delete(db: &DbManager, feed_id: &FeedId) -> Result<Feed, AppError> {
    let repo = SqliteFeedRepository::new(db.reader());
    repo.find_by_id(feed_id)?
        .ok_or_else(|| AppError::UserVisible {
            message: "Validation error: feed not found".into(),
        })
}

fn load_delete_feed_account(db: &DbManager, account_id: &AccountId) -> Result<Account, AppError> {
    let repo = SqliteAccountRepository::new(db.reader());
    repo.find_by_id(account_id)?
        .ok_or_else(|| AppError::UserVisible {
            message: "Account not found".into(),
        })
}

#[cfg(test)]
async fn delete_feed_with_provider_sync_boundary<P: FeedProvider>(
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

async fn delete_feed_with_remote_sync_boundary(
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
        let provider = authenticated_freshrss_provider(&account).await?;
        return delete_feed_after_provider_unsubscribe(db, feed_id.0, &provider).await;
    }

    let db = lock_db(db)?;
    delete_feed_in_db(&db, feed_id.0)
}

async fn authenticated_freshrss_provider(account: &Account) -> Result<GReaderProvider, AppError> {
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
    let password = super::sync_providers::get_greader_password(account).await?;
    provider
        .authenticate(&Credentials {
            token: Some(username),
            password: Some(password),
        })
        .await?;
    Ok(provider)
}

#[tauri::command]
pub async fn rename_feed(
    state: State<'_, AppState>,
    feed_id: String,
    title: String,
) -> Result<(), AppError> {
    rename_feed_with_remote_sync_boundary(&state.db, state.syncing.as_ref(), feed_id, title).await
}

async fn rename_feed_with_remote_sync_boundary(
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
            let provider = authenticated_freshrss_provider(&account).await?;
            provider
                .edit_subscription(&remote_id, Some(&title), None, None)
                .await?;
        }
    }

    let db = lock_db(db)?;
    rename_feed_in_db(&db, feed_id, title)
}

fn rename_feed_in_db(db: &DbManager, feed_id: String, title: String) -> Result<(), AppError> {
    let title = validate_feed_title(&title)?;
    let repo = SqliteFeedRepository::new(db.writer());
    repo.rename(&FeedId(feed_id), &title)?;
    Ok(())
}

#[tauri::command]
pub async fn update_feed_folder(
    state: State<'_, AppState>,
    feed_id: String,
    folder_id: Option<String>,
) -> Result<(), AppError> {
    update_feed_folder_with_remote_sync_boundary(
        &state.db,
        state.syncing.as_ref(),
        feed_id,
        folder_id,
    )
    .await
}

async fn update_feed_folder_with_remote_sync_boundary(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    feed_id: String,
    folder_id: Option<String>,
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

    if matches!(account.kind, ProviderKind::FreshRss) {
        if let Some(remote_id) = feed.remote_id.clone() {
            let (add_label, remove_label) = {
                let db = lock_db(db)?;
                resolve_folder_edit_labels(&db, &feed, folder_id.as_deref())?
            };
            if add_label.is_some() || remove_label.is_some() {
                let provider = authenticated_freshrss_provider(&account).await?;
                provider
                    .edit_subscription(
                        &remote_id,
                        None,
                        add_label.as_deref(),
                        remove_label.as_deref(),
                    )
                    .await?;
            }
        }
    }

    let db = lock_db(db)?;
    update_feed_folder_in_db(&db, feed_id, folder_id)
}

fn lookup_folder_name(db: &DbManager, folder_id: &str) -> Result<String, AppError> {
    db.reader()
        .query_row(
            "SELECT name FROM folders WHERE id = ?1",
            params![folder_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| AppError::UserVisible {
            message: format!("Failed to resolve folder name: {error}"),
        })?
        .ok_or_else(|| AppError::UserVisible {
            message: "Folder not found".to_string(),
        })
}

fn resolve_folder_edit_labels(
    db: &DbManager,
    feed: &Feed,
    new_folder_id: Option<&str>,
) -> Result<(Option<String>, Option<String>), AppError> {
    validate_update_feed_folder_target(db.reader(), &feed.id.0, new_folder_id)?;

    let add_label = match new_folder_id {
        Some(folder_id) => Some(lookup_folder_name(db, folder_id)?),
        None => None,
    };
    let remove_label = match feed.folder_id.as_ref() {
        Some(old_folder_id) if Some(old_folder_id.0.as_str()) != new_folder_id => {
            Some(lookup_folder_name(db, &old_folder_id.0)?)
        }
        _ => None,
    };
    Ok((add_label, remove_label))
}

fn update_feed_folder_in_db(
    db: &DbManager,
    feed_id: String,
    folder_id: Option<String>,
) -> Result<(), AppError> {
    let tx = db
        .writer()
        .unchecked_transaction()
        .map_err(DomainError::from)?;
    validate_update_feed_folder_target(&tx, &feed_id, folder_id.as_deref())?;
    let repo = SqliteFeedRepository::new(&tx);
    let fid = folder_id.as_ref().map(|id| FolderId(id.clone()));
    if let Err(error) = repo.update_folder(&FeedId(feed_id.clone()), fid.as_ref()) {
        return Err(classify_update_feed_folder_error(
            &tx,
            &feed_id,
            folder_id.as_deref(),
            error,
        ));
    }
    tx.commit().map_err(DomainError::from)?;
    Ok(())
}

fn classify_update_feed_folder_error(
    conn: &Connection,
    feed_id: &str,
    folder_id: Option<&str>,
    error: DomainError,
) -> AppError {
    let is_target_validation_error = matches!(
        &error,
        DomainError::Validation(message)
            if message == UPDATE_FEED_FOLDER_TARGET_VALIDATION_MESSAGE
    );
    if !is_target_validation_error {
        return error.into();
    }

    match validate_update_feed_folder_target(conn, feed_id, folder_id) {
        Ok(()) => error.into(),
        Err(classified_error) => classified_error,
    }
}

fn validate_update_feed_folder_target(
    conn: &Connection,
    feed_id: &str,
    folder_id: Option<&str>,
) -> Result<(), AppError> {
    let feed_repo = SqliteFeedRepository::new(conn);
    let feed = feed_repo
        .find_by_id(&FeedId(feed_id.to_string()))?
        .ok_or_else(|| AppError::UserVisible {
            message: "Feed not found".to_string(),
        })?;

    let Some(folder_id) = folder_id else {
        return Ok(());
    };

    let folder_account_id = conn
        .query_row(
            "SELECT account_id FROM folders WHERE id = ?1",
            params![folder_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| AppError::UserVisible {
            message: format!("Failed to validate target folder: {error}"),
        })?;

    match folder_account_id {
        None => Err(AppError::UserVisible {
            message: "Folder not found".to_string(),
        }),
        Some(folder_account_id) if folder_account_id != feed.account_id.0 => {
            Err(AppError::UserVisible {
                message: "Folder belongs to another account".to_string(),
            })
        }
        Some(_) => Ok(()),
    }
}

fn recalculate_feed_unread_count_in_db(db: &DbManager, feed_id: &FeedId) -> Result<i32, AppError> {
    let feed_repo = SqliteFeedRepository::new(db.writer());
    Ok(feed_repo.recalculate_unread_count(feed_id)?)
}

fn validate_add_local_feed_account_in_db(
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

fn validate_add_freshrss_feed_preflight_in_db(
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

fn validate_add_freshrss_subscription_unique_in_db(
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

async fn add_local_feed_with_db(
    db: &Mutex<DbManager>,
    account_id: String,
    url: String,
) -> Result<FeedDto, AppError> {
    let provider = LocalProvider::new();
    add_local_feed_with_provider(db, account_id, url, &provider).await
}

async fn add_local_feed_with_provider(
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
        super::sync_providers::sync_local_feed(db, provider, &account_id, &persisted_feed).await
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
    let password = super::sync_providers::get_greader_password(&account).await?;
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
        super::sync_providers::sync_greader_feed(db, &account, &persisted_feed, provider).await
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

fn validate_add_local_feed_duplicate_url_in_db(
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

#[cfg(test)]
mod validation_tests {
    use super::{validate_feed_title, validate_folder_name};

    #[test]
    fn validates_feed_rename_title() {
        assert_eq!(validate_feed_title("  Blog  ").unwrap(), "Blog");
        assert!(validate_feed_title("   ").is_err());
        assert!(validate_feed_title(&"a".repeat(201)).is_err());
    }

    #[test]
    fn validates_folder_create_name() {
        let existing = vec!["Tech".to_string()];
        assert_eq!(validate_folder_name("  News  ", &existing).unwrap(), "News");
        assert_eq!(
            validate_folder_name("\u{3000}News\u{00a0}", &existing).unwrap(),
            "News"
        );
        assert_eq!(
            validate_folder_name("Dev\u{3000}\tNews", &existing).unwrap(),
            "Dev\u{3000}\tNews"
        );
        assert_eq!(
            validate_folder_name("Ｆｅｅｄ", &existing).unwrap(),
            "Ｆｅｅｄ"
        );
        assert!(validate_folder_name("   ", &existing).is_err());
        assert!(validate_folder_name(&"a".repeat(101), &existing).is_err());
        assert!(validate_folder_name("tech", &existing).is_err());
    }
}

#[tauri::command]
pub fn update_feed_display_settings(
    state: State<'_, AppState>,
    feed_id: String,
    reader_mode: String,
    web_preview_mode: String,
) -> Result<(), AppError> {
    let db = lock_db(&state.db)?;
    update_feed_display_settings_in_db(&db, feed_id, reader_mode, web_preview_mode)
}

fn update_feed_display_settings_in_db(
    db: &DbManager,
    feed_id: String,
    reader_mode: String,
    web_preview_mode: String,
) -> Result<(), AppError> {
    if !matches!(reader_mode.as_str(), "inherit" | "on" | "off") {
        return Err(AppError::UserVisible {
            message: format!("Unknown reader mode: {reader_mode}"),
        });
    }
    if !matches!(web_preview_mode.as_str(), "inherit" | "on" | "off") {
        return Err(AppError::UserVisible {
            message: format!("Unknown web preview mode: {web_preview_mode}"),
        });
    }
    let repo = SqliteFeedRepository::new(db.writer());
    repo.update_display_settings(&FeedId(feed_id), &reader_mode, &web_preview_mode)?;
    Ok(())
}

#[tauri::command]
pub async fn discover_feeds(url: String) -> Result<Vec<DiscoveredFeedDto>, AppError> {
    let feeds = feed_discovery::discover_feeds(&url).await?;
    Ok(feeds.into_iter().map(DiscoveredFeedDto::from).collect())
}

#[cfg(test)]
mod tests;
