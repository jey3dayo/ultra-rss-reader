use tauri::State;

use crate::commands::dto::{AppError, FeedDto};
use crate::commands::AppState;
use crate::domain::feed::Feed;
use crate::domain::folder::Folder;
use crate::domain::types::{AccountId, FeedId, FolderId};
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_folder::SqliteFolderRepository;
use crate::infra::opml;
use crate::infra::opml::OpmlFeed;
use crate::repository::account::AccountRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;

#[tauri::command]
pub fn import_opml(
    state: State<'_, AppState>,
    opml_content: String,
    account_id: String,
) -> Result<Vec<FeedDto>, AppError> {
    let parsed_feeds =
        opml::parse_opml(&opml_content).map_err(|e| AppError::UserVisible { message: e })?;

    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;

    let account_id = AccountId(account_id);
    let feed_repo = SqliteFeedRepository::new(db.writer());
    let folder_repo = SqliteFolderRepository::new(db.writer());

    // Load existing folders to avoid duplicates
    let existing_folders = folder_repo
        .find_by_account(&account_id)
        .map_err(AppError::from)?;

    let mut created_feeds = Vec::new();
    let mut folder_cache: std::collections::HashMap<String, FolderId> =
        std::collections::HashMap::new();

    // Pre-populate cache with existing folders
    for f in &existing_folders {
        folder_cache.insert(f.name.clone(), f.id.clone());
    }

    let mut sort_order = existing_folders.len() as i32;

    for opml_feed in &parsed_feeds {
        // Skip if feed with same URL already exists
        if feed_repo
            .find_by_url(&account_id, &opml_feed.xml_url)
            .map_err(AppError::from)?
            .is_some()
        {
            continue;
        }

        // Resolve or create folder
        let folder_id = if let Some(ref folder_name) = opml_feed.folder {
            if let Some(id) = folder_cache.get(folder_name) {
                Some(id.clone())
            } else {
                let folder = Folder {
                    id: FolderId::new(),
                    account_id: account_id.clone(),
                    remote_id: None,
                    name: folder_name.clone(),
                    sort_order,
                };
                sort_order += 1;
                folder_repo.save(&folder).map_err(AppError::from)?;
                folder_cache.insert(folder_name.clone(), folder.id.clone());
                Some(folder.id)
            }
        } else {
            None
        };

        let feed = Feed {
            id: FeedId::new(),
            account_id: account_id.clone(),
            folder_id,
            remote_id: None,
            title: opml_feed.title.clone(),
            url: opml_feed.xml_url.clone(),
            site_url: opml_feed.html_url.clone().unwrap_or_default(),
            icon: None,
            unread_count: 0,
            display_mode: "inherit".to_string(),
        };

        feed_repo.save(&feed).map_err(AppError::from)?;
        created_feeds.push(FeedDto::from(feed));
    }

    Ok(created_feeds)
}

#[tauri::command]
pub fn export_opml(state: State<'_, AppState>, account_id: String) -> Result<String, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;

    let account_id = AccountId(account_id);

    // Get account name for the OPML title
    let account_repo = SqliteAccountRepository::new(db.reader());
    let accounts = account_repo.find_all().map_err(AppError::from)?;
    let account = accounts
        .iter()
        .find(|a| a.id == account_id)
        .ok_or_else(|| AppError::UserVisible {
            message: "Account not found".to_string(),
        })?;
    let title = account.name.clone();

    // Load folders for name lookup
    let folder_repo = SqliteFolderRepository::new(db.reader());
    let folders = folder_repo
        .find_by_account(&account_id)
        .map_err(AppError::from)?;
    let folder_map: std::collections::HashMap<FolderId, String> =
        folders.into_iter().map(|f| (f.id, f.name)).collect();

    // Load feeds and convert to OpmlFeed
    let feed_repo = SqliteFeedRepository::new(db.reader());
    let feeds = feed_repo
        .find_by_account(&account_id)
        .map_err(AppError::from)?;

    let opml_feeds: Vec<OpmlFeed> = feeds
        .into_iter()
        .map(|f| OpmlFeed {
            title: f.title,
            xml_url: f.url,
            html_url: if f.site_url.is_empty() {
                None
            } else {
                Some(f.site_url)
            },
            folder: f.folder_id.and_then(|fid| folder_map.get(&fid).cloned()),
        })
        .collect();

    Ok(opml::generate_opml(&title, &opml_feeds))
}
