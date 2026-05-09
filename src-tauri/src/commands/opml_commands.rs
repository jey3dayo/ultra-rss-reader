use tauri::State;

use crate::commands::dto::{AppError, FeedDto};
use crate::commands::AppState;
use crate::domain::error::DomainError;
use crate::domain::feed::Feed;
use crate::domain::folder::Folder;
use crate::domain::types::{AccountId, FeedId, FolderId};
use crate::infra::db::connection::DbManager;
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

    import_opml_in_db(&db, &parsed_feeds, account_id)
}

fn folder_cache_key(name: &str) -> String {
    name.trim().to_ascii_lowercase()
}

fn import_opml_in_db(
    db: &DbManager,
    parsed_feeds: &[OpmlFeed],
    account_id: String,
) -> Result<Vec<FeedDto>, AppError> {
    let account_id = AccountId(account_id);
    let account_repo = SqliteAccountRepository::new(db.reader());
    if account_repo.find_by_id(&account_id)?.is_none() {
        return Err(AppError::UserVisible {
            message: "Account not found".to_string(),
        });
    }

    let tx = db
        .writer()
        .unchecked_transaction()
        .map_err(DomainError::from)?;
    let feed_repo = SqliteFeedRepository::new(&tx);
    let folder_repo = SqliteFolderRepository::new(&tx);

    // Load existing folders to avoid duplicates
    let existing_folders = folder_repo
        .find_by_account(&account_id)
        .map_err(AppError::from)?;

    let mut created_feeds = Vec::new();
    let mut folder_cache: std::collections::HashMap<String, FolderId> =
        std::collections::HashMap::new();

    // Pre-populate cache with existing folders
    for f in &existing_folders {
        folder_cache.insert(folder_cache_key(&f.name), f.id.clone());
    }

    let mut sort_order = existing_folders.len() as i32;

    for opml_feed in parsed_feeds {
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
            let cache_key = folder_cache_key(folder_name);
            if let Some(id) = folder_cache.get(&cache_key) {
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
                folder_cache.insert(cache_key, folder.id.clone());
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

    tx.commit().map_err(DomainError::from)?;
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
    remaining_feeds.sort_by(|a, b| a.title.cmp(&b.title).then_with(|| a.id.0.cmp(&b.id.0)));
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
    use rusqlite::params;

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

    fn insert_test_folder(db: &DbManager, account_id: &AccountId, name: &str) -> FolderId {
        let id = FolderId::new();
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![id.0, account_id.0, name, 0],
            )
            .unwrap();
        id
    }

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
    fn import_parser_preserves_feed_urls_and_folder_assignment() {
        let opml = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="Engineering">
      <outline text="Rust Blog" type="rss" xmlUrl="https://blog.rust-lang.org/feed.xml" htmlUrl="https://blog.rust-lang.org/"/>
    </outline>
    <outline text="Top Feed" type="rss" xmlUrl="https://example.com/top.xml"/>
  </body>
</opml>"#;

        let feeds = parse_import_opml(opml).unwrap();

        assert_eq!(
            feeds
                .iter()
                .map(|feed| {
                    (
                        feed.title.as_str(),
                        feed.xml_url.as_str(),
                        feed.html_url.as_deref(),
                        feed.folder.as_deref(),
                    )
                })
                .collect::<Vec<_>>(),
            vec![
                (
                    "Rust Blog",
                    "https://blog.rust-lang.org/feed.xml",
                    Some("https://blog.rust-lang.org/"),
                    Some("Engineering"),
                ),
                ("Top Feed", "https://example.com/top.xml", None, None),
            ],
        );
    }

    #[test]
    fn import_rejects_missing_account_before_saving_folders_or_feeds() {
        let db = test_db();
        let parsed_feeds = vec![OpmlFeed {
            title: "Rust Blog".to_string(),
            xml_url: "https://blog.rust-lang.org/feed.xml".to_string(),
            html_url: None,
            folder: Some("Engineering".to_string()),
        }];

        let error = import_opml_in_db(&db, &parsed_feeds, "missing".to_string())
            .expect_err("missing account should be rejected before import writes");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Account not found"
        ));

        let folder_count: i64 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM folders", [], |row| row.get(0))
            .unwrap();
        let feed_count: i64 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM feeds", [], |row| row.get(0))
            .unwrap();
        assert_eq!(folder_count, 0);
        assert_eq!(feed_count, 0);
    }

    #[test]
    fn import_reuses_existing_folder_case_insensitively() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let existing_folder_id = insert_test_folder(&db, &account_id, "Engineering");
        let parsed_feeds = vec![OpmlFeed {
            title: "Rust Blog".to_string(),
            xml_url: "https://blog.rust-lang.org/feed.xml".to_string(),
            html_url: None,
            folder: Some("engineering".to_string()),
        }];

        let feeds = import_opml_in_db(&db, &parsed_feeds, account_id.0.clone()).unwrap();

        assert_eq!(feeds.len(), 1);
        let folder_count: i64 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM folders", [], |row| row.get(0))
            .unwrap();
        let saved_folder_id: String = db
            .reader()
            .query_row(
                "SELECT folder_id FROM feeds WHERE url = ?1",
                params!["https://blog.rust-lang.org/feed.xml"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(folder_count, 1);
        assert_eq!(saved_folder_id, existing_folder_id.0);
    }

    #[test]
    fn import_reuses_new_folder_case_insensitively_within_same_file() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let parsed_feeds = vec![
            OpmlFeed {
                title: "Rust Blog".to_string(),
                xml_url: "https://blog.rust-lang.org/feed.xml".to_string(),
                html_url: None,
                folder: Some("Engineering".to_string()),
            },
            OpmlFeed {
                title: "Cargo Blog".to_string(),
                xml_url: "https://blog.rust-lang.org/cargo.xml".to_string(),
                html_url: None,
                folder: Some("engineering".to_string()),
            },
        ];

        let feeds = import_opml_in_db(&db, &parsed_feeds, account_id.0.clone()).unwrap();

        assert_eq!(feeds.len(), 2);
        let folder_count: i64 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM folders", [], |row| row.get(0))
            .unwrap();
        let feed_folder_count: i64 = db
            .reader()
            .query_row(
                "SELECT COUNT(DISTINCT folder_id) FROM feeds WHERE folder_id IS NOT NULL",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(folder_count, 1);
        assert_eq!(feed_folder_count, 1);
    }

    #[test]
    fn import_rolls_back_created_folders_when_feed_save_fails() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        db.writer()
            .execute_batch(
                "CREATE TEMP TRIGGER fail_opml_feed_insert
                 BEFORE INSERT ON feeds
                 BEGIN
                   SELECT RAISE(FAIL, 'feed save failed');
                 END;",
            )
            .unwrap();
        let parsed_feeds = vec![OpmlFeed {
            title: "Rust Blog".to_string(),
            xml_url: "https://blog.rust-lang.org/feed.xml".to_string(),
            html_url: None,
            folder: Some("Engineering".to_string()),
        }];

        let error = import_opml_in_db(&db, &parsed_feeds, account_id.0.clone())
            .expect_err("feed save failure should reject OPML import");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message.contains("feed save failed")
        ));
        let folder_count: i64 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM folders", [], |row| row.get(0))
            .unwrap();
        let feed_count: i64 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM feeds", [], |row| row.get(0))
            .unwrap();
        assert_eq!(folder_count, 0);
        assert_eq!(feed_count, 0);
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

    #[test]
    fn export_orders_folder_and_top_level_feeds_by_title_then_id() {
        let folder_news = folder("folder-news", "News", 0);
        let feeds = vec![
            feed("top-z", None, "Zulu"),
            feed("folder-beta", Some(&folder_news.id), "Beta"),
            feed("top-a2", None, "Alpha"),
            feed("folder-alpha-2", Some(&folder_news.id), "Alpha"),
            feed("folder-alpha-1", Some(&folder_news.id), "Alpha"),
            feed("top-a1", None, "Alpha"),
        ];

        let opml_feeds = build_export_opml_feeds(feeds, vec![folder_news]);

        let order = opml_feeds
            .iter()
            .map(|feed| {
                (
                    feed.title.as_str(),
                    feed.xml_url.as_str(),
                    feed.folder.as_deref(),
                )
            })
            .collect::<Vec<_>>();
        assert_eq!(
            order,
            vec![
                (
                    "Alpha",
                    "https://example.com/folder-alpha-1.xml",
                    Some("News"),
                ),
                (
                    "Alpha",
                    "https://example.com/folder-alpha-2.xml",
                    Some("News"),
                ),
                ("Beta", "https://example.com/folder-beta.xml", Some("News"),),
                ("Alpha", "https://example.com/top-a1.xml", None),
                ("Alpha", "https://example.com/top-a2.xml", None),
                ("Zulu", "https://example.com/top-z.xml", None),
            ],
        );
    }
}
