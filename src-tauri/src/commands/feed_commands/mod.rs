use std::sync::Mutex;

use tauri::State;

use crate::commands::dto::{AppError, DiscoveredFeedDto, FeedDto, FolderDto};
use crate::commands::AppState;
use crate::domain::error::DomainError;
use crate::domain::folder::normalize_folder_name as normalize_folder_domain_name;
use crate::domain::types::{AccountId, FeedId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_folder::SqliteFolderRepository;
use crate::infra::feed_discovery;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;

mod feed_add;
mod feed_mutations;
mod folders;

pub use feed_add::{__cmd__add_local_feed, __tauri_command_name_add_local_feed, add_local_feed};
pub use feed_mutations::{
    __cmd__delete_feed, __cmd__rename_feed, __tauri_command_name_delete_feed,
    __tauri_command_name_rename_feed, delete_feed, rename_feed,
};
pub use folders::{
    __cmd__create_folder, __cmd__update_feed_folder, __tauri_command_name_create_folder,
    __tauri_command_name_update_feed_folder, create_folder, update_feed_folder,
};

#[cfg(test)]
mod tests;

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
pub fn update_feed_display_settings(
    state: State<'_, AppState>,
    feed_id: String,
    reader_mode: String,
    web_preview_mode: String,
) -> Result<(), AppError> {
    let db = lock_db(&state.db)?;
    update_feed_display_settings_in_db(&db, feed_id, reader_mode, web_preview_mode)
}

pub(crate) fn update_feed_display_settings_in_db(
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

#[cfg(test)]
pub(super) use feed_add::{
    add_local_feed_with_db, add_local_feed_with_provider, recalculate_feed_unread_count_in_db,
    validate_add_freshrss_feed_preflight_in_db, validate_add_freshrss_subscription_unique_in_db,
    validate_add_local_feed_account_in_db, validate_add_local_feed_duplicate_url_in_db,
};
pub(super) use feed_mutations::{
    authenticated_freshrss_provider, load_delete_feed_account, load_feed_for_delete,
};
#[cfg(test)]
pub(super) use feed_mutations::{
    delete_feed_in_db, delete_feed_with_provider_sync_boundary,
    delete_feed_with_remote_sync_boundary, delete_feed_with_sync_boundary, rename_feed_in_db,
    rename_feed_with_remote_sync_boundary,
};
#[cfg(test)]
pub(super) use folders::{
    classify_update_feed_folder_error, create_folder_in_db, update_feed_folder_in_db,
    update_feed_folder_with_remote_sync_boundary, validate_folder_name,
};
