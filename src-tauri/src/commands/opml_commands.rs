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
    let parsed_feeds = parse_import_opml(&opml_content)?;

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
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        };

        feed_repo.save(&feed).map_err(AppError::from)?;
        created_feeds.push(FeedDto::from(feed));
    }

    Ok(created_feeds)
}

fn parse_import_opml(opml_content: &str) -> Result<Vec<OpmlFeed>, AppError> {
    opml::parse_opml(opml_content).map_err(|message| AppError::UserVisible { message })
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
    // Load feeds and convert to OpmlFeed
    let feed_repo = SqliteFeedRepository::new(db.reader());
    let feeds = feed_repo
        .find_by_account(&account_id)
        .map_err(AppError::from)?;

    let opml_feeds = build_export_opml_feeds(feeds, folders);

    Ok(opml::generate_opml(&title, &opml_feeds))
}

fn build_export_opml_feeds(feeds: Vec<Feed>, folders: Vec<Folder>) -> Vec<OpmlFeed> {
    let mut folders = folders;
    folders.sort_by(|a, b| {
        a.sort_order
            .cmp(&b.sort_order)
            .then_with(|| a.id.0.cmp(&b.id.0))
    });
    let folder_map: std::collections::HashMap<FolderId, String> = folders
        .iter()
        .map(|f| (f.id.clone(), f.name.clone()))
        .collect();
    let mut remaining_feeds = feeds;
    let mut opml_feeds = Vec::with_capacity(remaining_feeds.len());

    for folder in folders {
        let mut index = 0;
        while index < remaining_feeds.len() {
            if remaining_feeds[index].folder_id.as_ref() == Some(&folder.id) {
                opml_feeds.push(feed_to_opml_feed(
                    remaining_feeds.remove(index),
                    Some(folder.name.clone()),
                ));
            } else {
                index += 1;
            }
        }
    }

    opml_feeds.extend(remaining_feeds.into_iter().map(|feed| {
        let folder_name = feed
            .folder_id
            .as_ref()
            .and_then(|folder_id| folder_map.get(folder_id).cloned());
        feed_to_opml_feed(feed, folder_name)
    }));
    opml_feeds
}

fn feed_to_opml_feed(feed: Feed, folder: Option<String>) -> OpmlFeed {
    OpmlFeed {
        title: feed.title,
        xml_url: feed.url,
        html_url: if feed.site_url.is_empty() {
            None
        } else {
            Some(feed.site_url)
        },
        folder,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn feed(id: &str, folder_id: Option<&FolderId>, title: &str) -> Feed {
        Feed {
            id: FeedId(id.to_string()),
            account_id: AccountId("account-1".to_string()),
            folder_id: folder_id.cloned(),
            remote_id: None,
            title: title.to_string(),
            url: format!("https://example.com/{id}.xml"),
            site_url: String::new(),
            icon: None,
            unread_count: 0,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        }
    }

    fn folder(id: &str, name: &str, sort_order: i32) -> Folder {
        Folder {
            id: FolderId(id.to_string()),
            account_id: AccountId("account-1".to_string()),
            remote_id: None,
            name: name.to_string(),
            sort_order,
        }
    }

    #[test]
    fn import_parser_errors_are_user_visible() {
        let error = parse_import_opml("not xml at all").unwrap_err();

        match error {
            AppError::UserVisible { message } => {
                assert_eq!(message, "OPML document must contain an <opml> root element");
            }
            AppError::Retryable { message } => {
                panic!("OPML parser errors should not be retryable: {message}");
            }
        }
    }

    #[test]
    fn export_groups_foldered_feeds_by_folder_sort_order_then_keeps_top_level_feeds() {
        let folder_early = folder("folder-early", "Early", 0);
        let folder_late = folder("folder-late", "Late", 1);
        let feeds = vec![
            feed("top", None, "Top level"),
            feed("late", Some(&folder_late.id), "Late feed"),
            feed("early", Some(&folder_early.id), "Early feed"),
        ];

        let opml_feeds = build_export_opml_feeds(feeds, vec![folder_late, folder_early]);

        let order = opml_feeds
            .iter()
            .map(|feed| (feed.title.as_str(), feed.folder.as_deref()))
            .collect::<Vec<_>>();
        assert_eq!(
            order,
            vec![
                ("Early feed", Some("Early")),
                ("Late feed", Some("Late")),
                ("Top level", None),
            ],
        );
    }
}
