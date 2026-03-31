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

pub(super) fn lock_db(
    db: &Mutex<DbManager>,
) -> Result<std::sync::MutexGuard<'_, DbManager>, AppError> {
    db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
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
        display_mode: "inherit".to_string(),
    };

    {
        let db = lock_db(&state.db)?;
        let feed_repo = SqliteFeedRepository::new(db.writer());
        feed_repo.save(&feed)?;
    }

    // 3. Fetch initial articles for the new feed
    super::sync_providers::sync_local_feed(&state.db, &provider, &account_id, &feed).await?;

    // 4. Re-read unread count from DB
    let unread_count = {
        let db = lock_db(&state.db)?;
        let feed_repo = SqliteFeedRepository::new(db.reader());
        feed_repo.recalculate_unread_count(&feed.id).unwrap_or(0)
    };
    let mut updated_feed = feed;
    updated_feed.unread_count = unread_count;
    Ok(FeedDto::from(updated_feed))
}

#[tauri::command]
pub fn update_feed_display_mode(
    state: State<'_, AppState>,
    feed_id: String,
    display_mode: String,
) -> Result<(), AppError> {
    if !matches!(display_mode.as_str(), "inherit" | "normal" | "widescreen") {
        return Err(AppError::UserVisible {
            message: format!("Unknown display mode: {display_mode}"),
        });
    }
    let db = lock_db(&state.db)?;
    let repo = SqliteFeedRepository::new(db.writer());
    repo.update_display_mode(&FeedId(feed_id), &display_mode)?;
    Ok(())
}

#[tauri::command]
pub async fn discover_feeds(url: String) -> Result<Vec<DiscoveredFeedDto>, AppError> {
    let feeds = feed_discovery::discover_feeds(&url).await?;
    Ok(feeds.into_iter().map(DiscoveredFeedDto::from).collect())
}
