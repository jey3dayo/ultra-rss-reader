use std::sync::Mutex;

use tauri::State;

use crate::commands::dto::{AppError, FeedDto, FolderDto};
use crate::commands::AppState;
use crate::domain::feed::Feed;
use crate::domain::types::{AccountId, FeedId, FolderId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_folder::SqliteFolderRepository;
use crate::infra::provider::local::LocalProvider;
use crate::infra::provider::traits::FeedProvider;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;

use crate::commands::dto::DiscoveredFeedDto;
use crate::infra::feed_discovery;

const FEED_TITLE_MAX_CHARS: usize = 200;
const FOLDER_NAME_MAX_CHARS: usize = 100;

pub(super) fn lock_db(
    db: &Mutex<DbManager>,
) -> Result<std::sync::MutexGuard<'_, DbManager>, AppError> {
    db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })
}

fn validate_feed_title(title: &str) -> Result<String, AppError> {
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

fn validate_folder_name(name: &str, existing_names: &[String]) -> Result<String, AppError> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::UserVisible {
            message: "Folder name cannot be empty".into(),
        });
    }
    if name.chars().count() > FOLDER_NAME_MAX_CHARS {
        return Err(AppError::UserVisible {
            message: format!("Folder name must be {FOLDER_NAME_MAX_CHARS} characters or less"),
        });
    }
    if existing_names
        .iter()
        .any(|existing| existing.eq_ignore_ascii_case(name))
    {
        return Err(AppError::UserVisible {
            message: format!("Folder name \"{name}\" is already in use"),
        });
    }
    Ok(name.to_string())
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
    use crate::domain::folder::Folder;

    let db = lock_db(&state.db)?;
    let account_id = AccountId(account_id);
    let folder_repo = SqliteFolderRepository::new(db.writer());

    // Determine next sort_order
    let existing = folder_repo.find_by_account(&account_id)?;
    let name = validate_folder_name(
        &name,
        &existing
            .iter()
            .map(|folder| folder.name.clone())
            .collect::<Vec<_>>(),
    )?;
    let sort_order = existing.len() as i32;

    // NOTE: Local-only folder; remote sync will be handled in a future iteration
    let folder = Folder {
        id: FolderId::new(),
        account_id,
        remote_id: None,
        name,
        sort_order,
    };
    folder_repo.save(&folder)?;
    Ok(FolderDto::from(folder))
}

#[tauri::command]
pub fn delete_feed(state: State<'_, AppState>, feed_id: String) -> Result<(), AppError> {
    let db = lock_db(&state.db)?;
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
    let repo = SqliteFeedRepository::new(db.writer());
    let fid = folder_id.map(FolderId);
    repo.update_folder(&FeedId(feed_id), fid.as_ref())?;
    Ok(())
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
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    };

    {
        let db = lock_db(&state.db)?;
        let feed_repo = SqliteFeedRepository::new(db.writer());
        feed_repo.save(&feed)?;
    }

    let persisted_feed = {
        let db = lock_db(&state.db)?;
        let feed_repo = SqliteFeedRepository::new(db.reader());
        feed_repo
            .find_by_url(&account_id, &feed.url)?
            .ok_or_else(|| AppError::UserVisible {
                message: "Saved feed could not be reloaded".into(),
            })?
    };

    // 3. Fetch initial articles for the new feed
    super::sync_providers::sync_local_feed(&state.db, &provider, &account_id, &persisted_feed)
        .await?;

    // 4. Re-read unread count from DB
    let unread_count = {
        let db = lock_db(&state.db)?;
        let feed_repo = SqliteFeedRepository::new(db.reader());
        feed_repo
            .recalculate_unread_count(&persisted_feed.id)
            .unwrap_or(0)
    };
    let mut updated_feed = persisted_feed;
    updated_feed.unread_count = unread_count;
    Ok(FeedDto::from(updated_feed))
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
    let db = lock_db(&state.db)?;
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

    use super::update_feed_folder_in_db;
    use crate::domain::types::{AccountId, FeedId, FolderId};
    use crate::infra::db::connection::DbManager;

    fn test_db() -> DbManager {
        DbManager::new_in_memory().unwrap()
    }

    fn insert_test_account(db: &DbManager, name: &str) -> AccountId {
        let id = AccountId::new();
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                params![id.0, "Local", name],
            )
            .unwrap();
        id
    }

    #[test]
    fn update_feed_folder_command_does_not_assign_folder_from_another_account() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let other_account_id = insert_test_account(&db, "Other");
        let feed_id = FeedId::new();
        let other_folder_id = FolderId::new();

        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, title, url) VALUES (?1, ?2, ?3, ?4)",
                params![feed_id.0, account_id.0, "Feed", "http://example.com/rss"],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![other_folder_id.0, other_account_id.0, "Other", 0],
            )
            .unwrap();

        update_feed_folder_in_db(&db, feed_id.0.clone(), Some(other_folder_id.0)).unwrap();

        let saved_folder_id: Option<String> = db
            .reader()
            .query_row(
                "SELECT folder_id FROM feeds WHERE id = ?1",
                params![feed_id.0],
                |row| row.get(0),
            )
            .unwrap();

        assert!(saved_folder_id.is_none());
    }
}
