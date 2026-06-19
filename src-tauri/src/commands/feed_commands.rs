use std::sync::{atomic::AtomicBool, Mutex};

use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

use crate::commands::dto::{AppError, FeedDto, FolderDto};
use crate::commands::AppState;
use crate::domain::error::DomainError;
use crate::domain::feed::Feed;
use crate::domain::folder::normalize_folder_name as normalize_folder_domain_name;
use crate::domain::provider::ProviderKind;
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
        DomainError::Persistence(message) if message.contains(FOLDER_NAME_UNIQUE_INDEX) => {
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
pub fn delete_feed(state: State<'_, AppState>, feed_id: String) -> Result<(), AppError> {
    delete_feed_with_sync_boundary(&state.db, state.syncing.as_ref(), feed_id)
}

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

#[tauri::command]
pub fn rename_feed(
    state: State<'_, AppState>,
    feed_id: String,
    title: String,
) -> Result<(), AppError> {
    let db = lock_db(&state.db)?;
    rename_feed_in_db(&db, feed_id, title)
}

fn rename_feed_in_db(db: &DbManager, feed_id: String, title: String) -> Result<(), AppError> {
    let title = validate_feed_title(&title)?;
    let repo = SqliteFeedRepository::new(db.writer());
    repo.rename(&FeedId(feed_id), &title)?;
    Ok(())
}

#[tauri::command]
pub fn update_feed_folder(
    state: State<'_, AppState>,
    feed_id: String,
    folder_id: Option<String>,
) -> Result<(), AppError> {
    let db = lock_db(&state.db)?;
    update_feed_folder_in_db(&db, feed_id, folder_id)
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
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    };

    {
        let db = lock_db(db)?;
        validate_add_local_feed_account_in_db(&db, &account.id)?;
        validate_add_local_feed_duplicate_url_in_db(&db, &account.id, &feed.url)?;
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
        rollback_added_feed(db, &persisted_feed.id, &error);
        return Err(error);
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
mod tests {
    use rusqlite::params;
    use std::net::TcpListener;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{mpsc, Arc, Barrier, Mutex};
    use std::thread;
    use std::time::{Duration, Instant};

    use super::{
        add_local_feed_with_db, add_local_feed_with_provider, classify_update_feed_folder_error,
        create_folder_in_db, delete_feed_in_db, delete_feed_with_sync_boundary, lock_db,
        recalculate_feed_unread_count_in_db, rename_feed_in_db, update_feed_display_settings_in_db,
        update_feed_folder_in_db, validate_add_local_feed_account_in_db,
        validate_add_local_feed_duplicate_url_in_db, UPDATE_FEED_FOLDER_TARGET_VALIDATION_MESSAGE,
    };
    use crate::commands::dto::AppError;
    use crate::domain::error::DomainError;
    use crate::domain::types::{AccountId, FeedId, FolderId};
    use crate::infra::db::connection::DbManager;
    use crate::infra::provider::local::LocalProvider;

    const SAMPLE_RSS: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>Local Feed</title>
        <item>
          <title>Local Article</title>
          <link>https://example.com/1</link>
          <guid>local-guid-1</guid>
        </item>
      </channel>
    </rss>"#;

    fn test_db() -> DbManager {
        DbManager::new_in_memory().unwrap()
    }

    fn insert_test_account_with_kind(db: &DbManager, name: &str, kind: &str) -> AccountId {
        let id = AccountId::new();
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                params![id.0, kind, name],
            )
            .unwrap();
        id
    }

    fn insert_test_account(db: &DbManager, name: &str) -> AccountId {
        insert_test_account_with_kind(db, name, "Local")
    }

    fn insert_test_feed(db: &DbManager, account_id: &AccountId) -> FeedId {
        let id = FeedId::new();
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, title, url) VALUES (?1, ?2, ?3, ?4)",
                params![id.0, account_id.0, "Feed", "http://example.com/rss"],
            )
            .unwrap();
        id
    }

    #[test]
    fn update_feed_folder_command_rejects_folder_from_another_account() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let other_account_id = insert_test_account(&db, "Other");
        let feed_id = insert_test_feed(&db, &account_id);
        let other_folder_id = FolderId::new();

        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![other_folder_id.0, other_account_id.0, "Other", 0],
            )
            .unwrap();

        let error = update_feed_folder_in_db(&db, feed_id.0.clone(), Some(other_folder_id.0))
            .expect_err("folder from another account should be returned as command error");

        let saved_folder_id: Option<String> = db
            .reader()
            .query_row(
                "SELECT folder_id FROM feeds WHERE id = ?1",
                params![feed_id.0],
                |row| row.get(0),
            )
            .unwrap();

        assert!(saved_folder_id.is_none());
        assert!(matches!(
            error,
            AppError::UserVisible { message }
                if message == "Folder belongs to another account"
        ));
    }

    #[test]
    fn delete_feed_command_rejects_missing_feed() {
        let db = test_db();

        let error = delete_feed_in_db(&db, "missing-feed".to_string())
            .expect_err("missing feed delete should be returned as command error");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Validation error: feed not found"
        ));
    }

    #[test]
    fn delete_feed_command_rejects_while_sync_boundary_is_busy() {
        let db = Mutex::new(test_db());
        let syncing = AtomicBool::new(true);

        let error = delete_feed_with_sync_boundary(&db, &syncing, "missing-feed".to_string())
            .expect_err("feed delete should not run while sync boundary is busy");

        assert!(matches!(error, AppError::UserVisible { .. }));
        assert!(syncing.load(Ordering::SeqCst));
    }

    #[test]
    fn delete_feed_command_releases_sync_boundary_after_delete() {
        let db = Mutex::new(test_db());
        let account_id = {
            let guard = db.lock().unwrap();
            insert_test_account(&guard, "Primary")
        };
        let feed_id = {
            let guard = db.lock().unwrap();
            insert_test_feed(&guard, &account_id)
        };
        let syncing = AtomicBool::new(false);

        delete_feed_with_sync_boundary(&db, &syncing, feed_id.0)
            .expect("feed delete should succeed");

        assert!(!syncing.load(Ordering::SeqCst));
    }

    #[test]
    fn rename_feed_command_rejects_missing_feed() {
        let db = test_db();

        let error = rename_feed_in_db(&db, "missing-feed".to_string(), "Renamed Feed".to_string())
            .expect_err("missing feed rename should be returned as command error");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Validation error: feed not found"
        ));
    }

    #[test]
    fn update_feed_folder_command_rejects_missing_feed() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let folder_id = FolderId::new();
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![folder_id.0, account_id.0, "Folder", 0],
            )
            .unwrap();

        let error = update_feed_folder_in_db(&db, "missing-feed".to_string(), Some(folder_id.0))
            .expect_err("missing feed folder mutation should be returned as command error");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Feed not found"
        ));
    }

    #[test]
    fn update_feed_folder_command_rejects_missing_folder() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let feed_id = insert_test_feed(&db, &account_id);

        let error = update_feed_folder_in_db(&db, feed_id.0, Some("missing-folder".to_string()))
            .expect_err("missing folder mutation should be returned as command error");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Folder not found"
        ));
    }

    #[test]
    fn update_feed_folder_command_classifies_concurrent_folder_delete() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let feed_id = insert_test_feed(&db, &account_id);
        let folder_id = FolderId::new();
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![folder_id.0, account_id.0, "Folder", 0],
            )
            .unwrap();
        db.writer()
            .execute("DELETE FROM folders WHERE id = ?1", params![folder_id.0])
            .unwrap();

        let error = classify_update_feed_folder_error(
            db.writer(),
            &feed_id.0,
            Some(&folder_id.0),
            DomainError::Validation(UPDATE_FEED_FOLDER_TARGET_VALIDATION_MESSAGE.to_string()),
        );

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Folder not found"
        ));
    }

    #[test]
    fn update_feed_folder_command_rejects_folder_account_mismatch() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let other_account_id = insert_test_account(&db, "Other");
        let feed_id = insert_test_feed(&db, &account_id);
        let other_folder_id = FolderId::new();
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![other_folder_id.0, other_account_id.0, "Other", 0],
            )
            .unwrap();

        let error = update_feed_folder_in_db(&db, feed_id.0, Some(other_folder_id.0))
            .expect_err("folder account mismatch should be returned as command error");

        assert!(matches!(
            error,
            AppError::UserVisible { message }
                if message == "Folder belongs to another account"
        ));
    }

    #[test]
    fn update_feed_display_settings_command_rejects_missing_feed() {
        let db = test_db();

        let error = update_feed_display_settings_in_db(
            &db,
            "missing-feed".to_string(),
            "on".to_string(),
            "off".to_string(),
        )
        .expect_err("missing feed display settings mutation should be returned as command error");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Validation error: feed not found"
        ));
    }

    #[test]
    fn create_folder_rejects_missing_account_before_saving() {
        let db = test_db();

        let error = create_folder_in_db(&db, "missing".to_string(), "Inbox".to_string())
            .expect_err("missing account should be rejected before folder save");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Account not found"
        ));

        let folder_count: i64 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM folders", [], |row| row.get(0))
            .unwrap();
        assert_eq!(folder_count, 0);
    }

    #[test]
    fn create_folder_compacts_existing_order_before_allocating_next_order() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");

        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params!["existing-low", account_id.0, "Low", 0],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params!["existing-high", account_id.0, "High", 7],
            )
            .unwrap();

        let first = create_folder_in_db(&db, account_id.0.clone(), "First".to_string()).unwrap();
        let second = create_folder_in_db(&db, account_id.0.clone(), "Second".to_string()).unwrap();

        assert_eq!(first.sort_order, 2);
        assert_eq!(second.sort_order, 3);

        let orders = db
            .reader()
            .prepare(
                "SELECT sort_order
                 FROM folders
                 WHERE account_id = ?1
                 ORDER BY sort_order",
            )
            .unwrap()
            .query_map(params![account_id.0.clone()], |row| row.get::<_, i32>(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(orders, vec![0, 1, 2, 3]);

        let duplicate_order_count: i64 = db
            .reader()
            .query_row(
                "SELECT COUNT(*)
                 FROM (
                   SELECT sort_order
                   FROM folders
                   WHERE account_id = ?1
                   GROUP BY sort_order
                   HAVING COUNT(*) > 1
                 )",
                params![account_id.0],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(duplicate_order_count, 0);
    }

    #[test]
    fn create_folder_command_db_lock_serializes_sort_order_allocation() {
        let db = Arc::new(Mutex::new(test_db()));
        let account_id = {
            let db = lock_db(&db).unwrap();
            insert_test_account(&db, "Primary")
        };
        let start = Arc::new(Barrier::new(2));
        let handles = ["First", "Second"].map(|name| {
            let db = Arc::clone(&db);
            let account_id = account_id.0.clone();
            let start = Arc::clone(&start);

            thread::spawn(move || {
                start.wait();
                let db = lock_db(&db).unwrap();
                create_folder_in_db(&db, account_id, name.to_string()).unwrap()
            })
        });

        let mut created = handles
            .into_iter()
            .map(|handle| handle.join().unwrap())
            .collect::<Vec<_>>();
        created.sort_by_key(|folder| folder.sort_order);

        assert_eq!(
            created
                .iter()
                .map(|folder| folder.sort_order)
                .collect::<Vec<_>>(),
            vec![0, 1]
        );

        let db = lock_db(&db).unwrap();
        let duplicate_order_count: i64 = db
            .reader()
            .query_row(
                "SELECT COUNT(*)
                 FROM (
                   SELECT sort_order
                   FROM folders
                   WHERE account_id = ?1
                   GROUP BY sort_order
                   HAVING COUNT(*) > 1
                 )",
                params![account_id.0],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(duplicate_order_count, 0);
    }

    #[test]
    fn create_folder_classifies_concurrent_duplicate_name_constraint() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        db.writer()
            .execute_batch(
                "CREATE TRIGGER simulate_folder_name_race
                 BEFORE INSERT ON folders
                 WHEN NEW.name = 'Raced'
                 BEGIN
                   INSERT INTO folders (id, account_id, name, sort_order)
                   VALUES ('raced-folder', NEW.account_id, 'raced', NEW.sort_order + 1);
                 END;",
            )
            .unwrap();

        let error = create_folder_in_db(&db, account_id.0.clone(), "Raced".to_string())
            .expect_err("concurrent same-name insert should be returned as command error");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Folder name \"Raced\" is already in use"
        ));

        let folder_count: i64 = db
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM folders WHERE account_id = ?1",
                params![account_id.0],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(folder_count, 0);
    }

    #[test]
    fn create_folder_classifies_concurrent_sort_order_constraint() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        db.writer()
            .execute_batch(
                "CREATE TRIGGER simulate_folder_sort_order_race
                 BEFORE INSERT ON folders
                 WHEN NEW.name = 'Raced'
                 BEGIN
                   INSERT INTO folders (id, account_id, name, sort_order)
                   VALUES ('raced-folder', NEW.account_id, 'Other', NEW.sort_order);
                 END;",
            )
            .unwrap();

        let error = create_folder_in_db(&db, account_id.0.clone(), "Raced".to_string())
            .expect_err("concurrent same-order insert should be returned as command error");

        assert!(matches!(
            error,
            AppError::UserVisible { message }
                if message == "Folder order changed while creating the folder. Please retry."
        ));

        let folder_count: i64 = db
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM folders WHERE account_id = ?1",
                params![account_id.0],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(folder_count, 0);
    }

    #[test]
    fn update_feed_display_settings_command_persists_inherit_on_and_off_values() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let feed_id = insert_test_feed(&db, &account_id);

        for (reader_mode, web_preview_mode) in
            [("inherit", "inherit"), ("on", "off"), ("off", "on")]
        {
            update_feed_display_settings_in_db(
                &db,
                feed_id.0.clone(),
                reader_mode.to_string(),
                web_preview_mode.to_string(),
            )
            .unwrap();

            let (saved_reader_mode, saved_web_preview_mode): (String, String) = db
                .reader()
                .query_row(
                    "SELECT reader_mode, web_preview_mode FROM feeds WHERE id = ?1",
                    params![feed_id.0],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .unwrap();

            assert_eq!(saved_reader_mode, reader_mode);
            assert_eq!(saved_web_preview_mode, web_preview_mode);
        }
    }

    #[test]
    fn update_feed_display_settings_command_rejects_unknown_reader_mode() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let feed_id = insert_test_feed(&db, &account_id);

        let error = update_feed_display_settings_in_db(
            &db,
            feed_id.0,
            "enabled".to_string(),
            "inherit".to_string(),
        )
        .expect_err("unknown reader mode should be rejected");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Unknown reader mode: enabled"
        ));
    }

    #[test]
    fn update_feed_display_settings_command_rejects_unknown_web_preview_mode() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let feed_id = insert_test_feed(&db, &account_id);

        let error = update_feed_display_settings_in_db(
            &db,
            feed_id.0,
            "inherit".to_string(),
            "enabled".to_string(),
        )
        .expect_err("unknown web preview mode should be rejected");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Unknown web preview mode: enabled"
        ));
    }

    #[test]
    fn add_local_feed_preflight_accepts_local_accounts() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");

        validate_add_local_feed_account_in_db(&db, &account_id).unwrap();
    }

    #[test]
    fn add_local_feed_preflight_rejects_missing_accounts() {
        let db = test_db();
        let error = validate_add_local_feed_account_in_db(&db, &AccountId("missing".to_string()))
            .expect_err("missing account should be rejected");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Account not found"
        ));
    }

    #[test]
    fn add_local_feed_preflight_accepts_freshrss_accounts() {
        let db = test_db();
        let account_id = insert_test_account_with_kind(&db, "FreshRSS", "FreshRss");

        validate_add_local_feed_account_in_db(&db, &account_id).unwrap();
    }

    #[test]
    fn add_local_feed_preflight_rejects_quarantined_accounts() {
        let db = test_db();
        let account_id = insert_test_account_with_kind(&db, "Quarantined", "Quarantined");
        let error = validate_add_local_feed_account_in_db(&db, &account_id)
            .expect_err("quarantined account should be rejected");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Feed can only be added to a Local or FreshRSS account"
        ));
    }

    #[test]
    fn add_local_feed_duplicate_url_preflight_rejects_existing_subscription() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        insert_test_feed(&db, &account_id);

        let error =
            validate_add_local_feed_duplicate_url_in_db(&db, &account_id, "http://example.com/rss")
                .expect_err("duplicate URL should be rejected before save");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Feed URL is already subscribed"
        ));
    }

    #[tokio::test]
    async fn add_local_feed_rejects_missing_account_before_network_request() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let url = format!("http://{}/feed.xml", listener.local_addr().unwrap());
        let (connection_tx, connection_rx) = mpsc::channel();
        let listener_thread = thread::spawn(move || {
            let deadline = Instant::now() + Duration::from_millis(250);
            while Instant::now() < deadline {
                match listener.accept() {
                    Ok(_) => {
                        let _ = connection_tx.send(());
                        return;
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(10));
                    }
                    Err(_) => return,
                }
            }
        });

        let db = Mutex::new(test_db());
        let error = add_local_feed_with_db(&db, "missing".to_string(), url)
            .await
            .expect_err("missing account should be rejected before fetching");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Account not found"
        ));
        listener_thread.join().unwrap();
        assert!(
            connection_rx.try_recv().is_err(),
            "missing account must not trigger an HTTP request"
        );
    }

    #[tokio::test]
    async fn add_local_feed_rejects_account_kind_drift_after_fetch() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/feed.xml", listener.local_addr().unwrap());
        let (accepted_tx, accepted_rx) = mpsc::channel();
        let (respond_tx, respond_rx) = mpsc::channel();
        let listener_thread = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            accepted_tx.send(()).unwrap();
            respond_rx.recv().unwrap();
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/rss+xml\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                SAMPLE_RSS.len(),
                SAMPLE_RSS
            );
            std::io::Write::write_all(&mut stream, response.as_bytes()).unwrap();
        });

        let db = Arc::new(Mutex::new(test_db()));
        let account_id = {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, "Primary")
        };

        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
        let add_db = Arc::clone(&db);
        let add_account_id = account_id.0.clone();
        let add_task = tokio::spawn(async move {
            add_local_feed_with_provider(&add_db, add_account_id, url, &provider).await
        });

        tokio::task::spawn_blocking(move || accepted_rx.recv().unwrap())
            .await
            .unwrap();
        {
            let db_guard = db.lock().unwrap();
            db_guard
                .writer()
                .execute(
                    "UPDATE accounts SET kind = 'FreshRss' WHERE id = ?1",
                    params![account_id.0.clone()],
                )
                .unwrap();
        }
        respond_tx.send(()).unwrap();

        let error = add_task
            .await
            .unwrap()
            .expect_err("account kind drift should reject add feed");
        listener_thread.join().unwrap();

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Feed can only be added to a Local account"
        ));

        let saved_feed_count: i64 = {
            let db_guard = db.lock().unwrap();
            db_guard
                .reader()
                .query_row("SELECT COUNT(*) FROM feeds", [], |row| row.get(0))
                .unwrap()
        };
        assert_eq!(saved_feed_count, 0);
    }

    #[tokio::test]
    async fn add_local_feed_returns_unread_count_recalculation_errors() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .with_status(200)
            .with_header("content-type", "application/rss+xml")
            .with_body(SAMPLE_RSS)
            .expect(2)
            .create_async()
            .await;

        let db = Mutex::new(test_db());
        let account_id = {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, "Primary")
        };
        {
            let db_guard = db.lock().unwrap();
            db_guard
                .writer()
                .execute("CREATE TABLE recalc_attempts (n INTEGER NOT NULL)", [])
                .unwrap();
            db_guard
                .writer()
                .execute("INSERT INTO recalc_attempts (n) VALUES (0)", [])
                .unwrap();
            db_guard
                .writer()
                .execute(
                    "CREATE TRIGGER fail_second_unread_recalc
                     BEFORE UPDATE OF unread_count ON feeds
                     BEGIN
                       UPDATE recalc_attempts SET n = n + 1;
                       SELECT CASE
                         WHEN (SELECT n FROM recalc_attempts) > 1
                         THEN RAISE(FAIL, 'unread recalc failed')
                       END;
                     END",
                    [],
                )
                .unwrap();
        }

        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
        let error = add_local_feed_with_provider(&db, account_id.0, feed_url, &provider)
            .await
            .expect_err("final unread count recalculation failure should be returned");

        mock.assert_async().await;
        assert!(
            matches!(error, AppError::UserVisible { message } if message.contains("unread recalc failed"))
        );
    }

    #[tokio::test]
    async fn add_local_feed_rolls_back_persisted_feed_when_initial_sync_fails() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .with_status(200)
            .with_header("content-type", "application/rss+xml")
            .with_body(SAMPLE_RSS)
            .expect(2)
            .create_async()
            .await;

        let db = Mutex::new(test_db());
        let account_id = {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, "Primary")
        };
        {
            let db_guard = db.lock().unwrap();
            db_guard
                .writer()
                .execute(
                    "CREATE TRIGGER fail_initial_article_sync
                     BEFORE INSERT ON articles
                     BEGIN
                       SELECT RAISE(FAIL, 'initial sync failed');
                     END",
                    [],
                )
                .unwrap();
        }

        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
        let error =
            add_local_feed_with_provider(&db, account_id.0.clone(), feed_url.clone(), &provider)
                .await
                .expect_err("initial sync failure should reject add feed");

        mock.assert_async().await;
        assert!(matches!(
            error,
            AppError::UserVisible { message } if message.contains("initial sync failed")
        ));

        let saved_feed_count: i64 = {
            let db_guard = db.lock().unwrap();
            db_guard
                .reader()
                .query_row(
                    "SELECT COUNT(*) FROM feeds WHERE account_id = ?1 AND url = ?2",
                    params![account_id.0, feed_url],
                    |row| row.get(0),
                )
                .unwrap()
        };
        assert_eq!(saved_feed_count, 0);
    }

    #[tokio::test]
    async fn add_local_feed_uses_create_fetch_for_metadata_and_pull_fetch_for_articles() {
        let create_feed = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Create Fetch Title</title>
    <link>https://example.com/create</link>
  </channel>
</rss>"#;
        let pull_feed = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Pull Fetch Title</title>
    <link>https://example.com/pull</link>
    <item>
      <title>Pull Fetch Article</title>
      <link>https://example.com/articles/pull</link>
      <guid>pull-guid</guid>
    </item>
  </channel>
</rss>"#;
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let create_mock = server
            .mock("GET", "/feed.xml")
            .with_status(200)
            .with_header("content-type", "application/rss+xml")
            .with_header("etag", "\"create-etag\"")
            .with_body(create_feed)
            .expect(1)
            .create_async()
            .await;
        let pull_mock = server
            .mock("GET", "/feed.xml")
            .with_status(200)
            .with_header("content-type", "application/rss+xml")
            .with_header("etag", "\"pull-etag\"")
            .with_body(pull_feed)
            .expect(1)
            .create_async()
            .await;

        let db = Mutex::new(test_db());
        let account_id = {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, "Primary")
        };

        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
        let feed =
            add_local_feed_with_provider(&db, account_id.0.clone(), feed_url.clone(), &provider)
                .await
                .unwrap();

        create_mock.assert_async().await;
        pull_mock.assert_async().await;
        assert_eq!(feed.title, "Create Fetch Title");
        assert_eq!(feed.site_url, "https://example.com/create");
        assert_eq!(feed.unread_count, 1);

        let (article_title, article_url, saved_etag): (String, String, String) = {
            let db_guard = db.lock().unwrap();
            let article = db_guard
                .reader()
                .query_row(
                    "SELECT a.title, a.url
                     FROM articles a
                     JOIN feeds f ON f.id = a.feed_id
                     WHERE f.account_id = ?1 AND f.url = ?2",
                    params![account_id.0.clone(), feed_url.clone()],
                    |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
                )
                .unwrap();
            let etag = db_guard
                .reader()
                .query_row(
                    "SELECT etag FROM sync_state WHERE account_id = ?1 AND scope_key = ?2",
                    params![account_id.0, format!("local_feed:{feed_url}")],
                    |row| row.get::<_, String>(0),
                )
                .unwrap();
            (article.0, article.1, etag)
        };

        assert_eq!(article_title, "Pull Fetch Article");
        assert_eq!(article_url, "https://example.com/articles/pull");
        assert_eq!(saved_etag, "\"pull-etag\"");
    }

    #[tokio::test]
    async fn add_local_feed_rejects_duplicate_url_without_deleting_existing_feed() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .with_status(200)
            .with_header("content-type", "application/rss+xml")
            .with_body(SAMPLE_RSS)
            .expect(1)
            .create_async()
            .await;

        let db = Mutex::new(test_db());
        let account_id = {
            let db_guard = db.lock().unwrap();
            let account_id = insert_test_account(&db_guard, "Primary");
            db_guard
                .writer()
                .execute(
                    "INSERT INTO feeds (id, account_id, title, url) VALUES (?1, ?2, ?3, ?4)",
                    params!["existing-feed", account_id.0, "Existing", feed_url],
                )
                .unwrap();
            account_id
        };

        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
        let error =
            add_local_feed_with_provider(&db, account_id.0.clone(), feed_url.clone(), &provider)
                .await
                .expect_err("duplicate URL should reject add feed");

        mock.assert_async().await;
        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Feed URL is already subscribed"
        ));

        let saved_feed_count: i64 = {
            let db_guard = db.lock().unwrap();
            db_guard
                .reader()
                .query_row(
                    "SELECT COUNT(*) FROM feeds WHERE account_id = ?1 AND url = ?2",
                    params![account_id.0, feed_url],
                    |row| row.get(0),
                )
                .unwrap()
        };
        assert_eq!(saved_feed_count, 1);
    }

    #[tokio::test]
    async fn add_local_feed_duplicate_race_does_not_roll_back_existing_feed() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .with_status(200)
            .with_header("content-type", "application/rss+xml")
            .with_body(SAMPLE_RSS)
            .expect(1)
            .create_async()
            .await;

        let db = Mutex::new(test_db());
        let account_id = {
            let db_guard = db.lock().unwrap();
            let account_id = insert_test_account(&db_guard, "Primary");
            db_guard
                .writer()
                .execute(
                    "CREATE TRIGGER simulate_duplicate_feed_race
                     BEFORE INSERT ON feeds
                     WHEN NEW.url LIKE 'http://127.0.0.1:%/feed.xml'
                     BEGIN
                       INSERT OR IGNORE INTO feeds (id, account_id, title, url)
                       VALUES ('race-existing-feed', NEW.account_id, 'Existing', NEW.url);
                     END",
                    [],
                )
                .unwrap();
            db_guard
                .writer()
                .execute(
                    "CREATE TRIGGER fail_if_duplicate_race_reaches_initial_sync
                     BEFORE INSERT ON articles
                     BEGIN
                       SELECT RAISE(FAIL, 'duplicate race reached initial sync');
                     END",
                    [],
                )
                .unwrap();
            account_id
        };

        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
        let error =
            add_local_feed_with_provider(&db, account_id.0.clone(), feed_url.clone(), &provider)
                .await
                .expect_err("duplicate URL race should reject add feed");

        mock.assert_async().await;
        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Feed URL is already subscribed"
        ));

        let saved_feed_id: String = {
            let db_guard = db.lock().unwrap();
            db_guard
                .reader()
                .query_row(
                    "SELECT id FROM feeds WHERE account_id = ?1 AND url = ?2",
                    params![account_id.0, feed_url],
                    |row| row.get(0),
                )
                .unwrap()
        };
        assert_eq!(saved_feed_id, "race-existing-feed");
    }

    #[test]
    fn recalculate_feed_unread_count_command_returns_recalculation_errors() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let feed_id = insert_test_feed(&db, &account_id);

        db.writer().execute("DROP TABLE articles", []).unwrap();

        let error = recalculate_feed_unread_count_in_db(&db, &feed_id)
            .expect_err("unread count recalculation failure should be returned");

        assert!(matches!(error, AppError::UserVisible { message } if message.contains("articles")));
    }
}
