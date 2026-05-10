use std::cmp::Ordering;
use std::collections::HashSet;
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;

use tauri::State;

use crate::commands::dto::{AppError, FeedDto};
use crate::commands::feed_commands::{normalize_folder_name, validate_feed_title};
use crate::commands::start_database_maintenance;
use crate::commands::try_lock_db;
use crate::commands::AppState;
use crate::domain::error::DomainError;
use crate::domain::feed::Feed;
use crate::domain::folder::Folder;
use crate::domain::types::{AccountId, FeedId, FolderId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_folder::SqliteFolderRepository;
use crate::infra::feed_discovery::validate_discovery_url;
use crate::infra::opml;
use crate::infra::opml::OpmlFeed;
use crate::repository::account::AccountRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;

const UNSUPPORTED_URL_VALIDATION_MESSAGE: &str = "Only http:// and https:// URLs are supported";
const OPML_GENERATE_ERROR_MESSAGE: &str = "Failed to generate OPML export";
const OPML_GENERATE_LOG_ERROR: &str = "redacted";

#[tauri::command]
pub fn import_opml(
    state: State<'_, AppState>,
    opml_content: String,
    account_id: String,
) -> Result<Vec<FeedDto>, AppError> {
    import_opml_inner(&state.db, &state.syncing, &opml_content, account_id)
}

fn import_opml_inner(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    opml_content: &str,
    account_id: String,
) -> Result<Vec<FeedDto>, AppError> {
    let _maintenance_guard = start_database_maintenance(syncing)?;
    let parsed_feeds = parse_import_opml(&opml_content)?;

    let db = try_lock_db(db)?;

    import_opml_in_db(&db, &parsed_feeds, account_id)
}

fn folder_cache_key(name: &str) -> String {
    name.trim().to_lowercase()
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
    let existing_feeds = feed_repo
        .find_by_account(&account_id)
        .map_err(AppError::from)?;
    let mut imported_feed_url_keys: HashSet<String> = existing_feeds
        .iter()
        .filter_map(|feed| normalized_feed_url_key(&feed.url))
        .collect();

    // Pre-populate cache with existing folders
    for f in &existing_folders {
        folder_cache.insert(folder_cache_key(&f.name), f.id.clone());
    }

    let mut sort_order = next_import_folder_sort_order(&existing_folders);

    for opml_feed in parsed_feeds {
        let Some(feed_url_key) = normalized_feed_url_key(&opml_feed.xml_url) else {
            continue;
        };

        if !imported_feed_url_keys.insert(feed_url_key) {
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
    if !created_feeds.is_empty() {
        db.refresh_query_statistics()?;
    }
    Ok(created_feeds)
}

fn parse_import_opml(opml_content: &str) -> Result<Vec<OpmlFeed>, AppError> {
    let feeds =
        opml::parse_opml(opml_content).map_err(|message| AppError::UserVisible { message })?;
    normalize_import_opml_feeds(feeds)
}

fn normalize_import_opml_feeds(feeds: Vec<OpmlFeed>) -> Result<Vec<OpmlFeed>, AppError> {
    feeds
        .into_iter()
        .map(|feed| {
            let title = validate_feed_title(&feed.title)?;
            let xml_url = validate_opml_feed_url(&feed.xml_url)?;
            let html_url = feed
                .html_url
                .as_deref()
                .map(validate_opml_feed_url)
                .transpose()?;
            let folder = feed
                .folder
                .as_deref()
                .map(normalize_folder_name)
                .transpose()?;
            Ok(OpmlFeed {
                title,
                xml_url,
                html_url,
                folder,
            })
        })
        .collect()
}

fn validate_opml_feed_url(url: &str) -> Result<String, AppError> {
    let parsed = reqwest::Url::parse(url).map_err(|_| AppError::UserVisible {
        message: UNSUPPORTED_URL_VALIDATION_MESSAGE.to_string(),
    })?;

    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(AppError::UserVisible {
            message: UNSUPPORTED_URL_VALIDATION_MESSAGE.to_string(),
        });
    }

    validate_discovery_url(&parsed).map_err(|error| match error {
        DomainError::Validation(message) => AppError::UserVisible { message },
        other => AppError::from(other),
    })?;

    Ok(url.to_string())
}

fn normalized_feed_url_key(raw_url: &str) -> Option<String> {
    let mut url = reqwest::Url::parse(raw_url).ok()?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return None;
    }

    url.set_fragment(None);

    let mut query_pairs: Vec<(String, String)> = url.query_pairs().into_owned().collect();
    query_pairs.sort();
    url.set_query(None);
    if !query_pairs.is_empty() {
        let mut pairs = url.query_pairs_mut();
        for (key, value) in &query_pairs {
            pairs.append_pair(key, value);
        }
    }

    let host = url.host_str()?.to_ascii_lowercase();
    let host = if host.contains(':') {
        format!("[{host}]")
    } else {
        host
    };
    let port = url.port().map_or(String::new(), |port| format!(":{port}"));
    let path = normalize_feed_url_key_path(url.path());
    let query = url
        .query()
        .map_or(String::new(), |query| format!("?{query}"));

    Some(format!("{}://{host}{port}{path}{query}", url.scheme()))
}

fn normalize_feed_url_key_path(path: &str) -> String {
    let mut normalized = normalize_unreserved_percent_encoding(path);
    while normalized.len() > 1 && normalized.ends_with('/') {
        normalized.pop();
    }
    normalized
}

fn normalize_unreserved_percent_encoding(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut normalized = String::with_capacity(value.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let high = bytes[index + 1];
            let low = bytes[index + 2];
            if let (Some(high), Some(low)) = (hex_value(high), hex_value(low)) {
                let byte = (high << 4) | low;
                if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~') {
                    normalized.push(byte as char);
                    index += 3;
                    continue;
                }
            }
        }

        normalized.push(bytes[index] as char);
        index += 1;
    }

    normalized
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

#[tauri::command]
pub fn export_opml(state: State<'_, AppState>, account_id: String) -> Result<String, AppError> {
    let db = crate::commands::lock_db(&state.db)?;

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

    opml::generate_opml(&title, &opml_feeds).map_err(|_message| {
        tracing::error!(
            error = OPML_GENERATE_LOG_ERROR,
            "failed to generate OPML export"
        );
        AppError::UserVisible {
            message: OPML_GENERATE_ERROR_MESSAGE.to_string(),
        }
    })
}

fn next_import_folder_sort_order(existing_folders: &[Folder]) -> i32 {
    existing_folders
        .iter()
        .map(|folder| folder.sort_order)
        .max()
        .map_or(0, |sort_order| sort_order.saturating_add(1))
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
    remaining_feeds.sort_by(compare_export_feeds);
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

fn compare_export_feeds(a: &Feed, b: &Feed) -> Ordering {
    a.title
        .as_bytes()
        .cmp(b.title.as_bytes())
        .then_with(|| a.id.0.cmp(&b.id.0))
}

#[cfg(test)]
fn opml_generate_log_error_for_test() -> &'static str {
    OPML_GENERATE_LOG_ERROR
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;
    use std::sync::atomic::{AtomicBool, Ordering as AtomicOrdering};
    use std::sync::Mutex;

    use crate::commands::DATABASE_MAINTENANCE_BUSY_ERROR;
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
        insert_test_folder_with_sort_order(db, account_id, name, 0)
    }

    fn insert_test_folder_with_sort_order(
        db: &DbManager,
        account_id: &AccountId,
        name: &str,
        sort_order: i32,
    ) -> FolderId {
        let id = FolderId::new();
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![id.0, account_id.0, name, sort_order],
            )
            .unwrap();
        id
    }

    fn insert_test_feed(
        db: &DbManager,
        account_id: &AccountId,
        folder_id: Option<&FolderId>,
        title: &str,
        url: &str,
    ) -> FeedId {
        let id = FeedId::new();
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, folder_id, title, url, site_url)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    id.0,
                    account_id.0,
                    folder_id.map(|id| id.0.as_str()),
                    title,
                    url,
                    ""
                ],
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
    fn import_parser_malformed_xml_error_matches_toast_surface() {
        let error = parse_import_opml(r#"<?xml version="1.0"?><opml><body><outline text="Feed">"#)
            .unwrap_err();

        match error {
            AppError::UserVisible { message } => {
                assert_eq!(message, "OPML document is malformed XML");
            }
            AppError::Retryable { message } => {
                panic!("OPML malformed XML errors should not be retryable: {message}");
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
    fn import_parser_normalizes_feed_title_and_folder_like_regular_validation() {
        let opml = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="  Engineering  ">
      <outline text="  Rust Blog  " type="rss" xmlUrl="https://blog.rust-lang.org/feed.xml"/>
    </outline>
  </body>
</opml>"#;

        let feeds = parse_import_opml(opml).unwrap();

        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].title, "Rust Blog");
        assert_eq!(feeds[0].folder, Some("Engineering".to_string()));
    }

    #[test]
    fn import_parser_rejects_invalid_feed_title_and_folder_like_regular_validation() {
        let blank_title = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="   " type="rss" xmlUrl="https://example.com/blank.xml"/>
  </body>
</opml>"#;
        let blank_folder = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="   ">
      <outline text="Feed" type="rss" xmlUrl="https://example.com/feed.xml"/>
    </outline>
  </body>
</opml>"#;

        assert!(matches!(
            parse_import_opml(blank_title),
            Err(AppError::UserVisible { message }) if message == "Feed title cannot be empty"
        ));
        assert!(matches!(
            parse_import_opml(blank_folder),
            Err(AppError::UserVisible { message }) if message == "Folder name cannot be empty"
        ));
    }

    #[test]
    fn import_parser_rejects_opml_feed_urls_with_regular_backend_scheme_policy() {
        let unsupported_xml_url = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="Feed" type="rss" xmlUrl="file:///tmp/feed.xml"/>
  </body>
</opml>"#;
        let unsupported_html_url = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="Feed" type="rss" xmlUrl="https://example.com/feed.xml" htmlUrl="javascript:alert(1)"/>
  </body>
</opml>"#;

        for opml in [unsupported_xml_url, unsupported_html_url] {
            assert!(matches!(
                parse_import_opml(opml),
                Err(AppError::UserVisible { message }) if message == "Only http:// and https:// URLs are supported"
            ));
        }
    }

    #[test]
    fn import_parser_rejects_opml_private_feed_urls_like_regular_backend_policy() {
        let private_xml_url = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="Feed" type="rss" xmlUrl="http://127.0.0.1/feed.xml"/>
  </body>
</opml>"#;
        let private_html_url = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="Feed" type="rss" xmlUrl="https://example.com/feed.xml" htmlUrl="http://localhost/"/>
  </body>
</opml>"#;

        for opml in [private_xml_url, private_html_url] {
            assert!(matches!(
                parse_import_opml(opml),
                Err(AppError::UserVisible { message }) if message == "Requests to private/loopback addresses are not allowed"
            ));
        }
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
    fn import_opml_command_uses_maintenance_guard_before_db_lock() {
        let db = Mutex::new(test_db());
        let account_id = {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, "Primary")
        };
        let syncing = AtomicBool::new(true);
        let opml = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="Rust Blog" type="rss" xmlUrl="https://blog.rust-lang.org/feed.xml"/>
  </body>
</opml>"#;

        let error = import_opml_inner(&db, &syncing, opml, account_id.0)
            .expect_err("syncing should block OPML import before writes");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == DATABASE_MAINTENANCE_BUSY_ERROR
        ));
        assert!(
            syncing.load(AtomicOrdering::SeqCst),
            "failed maintenance start should not clear the active sync flag"
        );
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
    fn import_folder_cache_uses_ascii_lowercase_and_trimmed_names() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let ascii_folder_id =
            insert_test_folder_with_sort_order(&db, &account_id, "Engineering", 0);
        let accent_folder_id = insert_test_folder_with_sort_order(&db, &account_id, "Cafe", 1);
        insert_test_folder_with_sort_order(&db, &account_id, "ＡＢＣ", 2);
        insert_test_folder_with_sort_order(&db, &account_id, "İstanbul", 3);
        let parsed_feeds = vec![
            OpmlFeed {
                title: "ASCII".to_string(),
                xml_url: "https://example.com/ascii.xml".to_string(),
                html_url: None,
                folder: Some("  engineering  ".to_string()),
            },
            OpmlFeed {
                title: "Accent".to_string(),
                xml_url: "https://example.com/accent.xml".to_string(),
                html_url: None,
                folder: Some("cafe".to_string()),
            },
            OpmlFeed {
                title: "Fullwidth".to_string(),
                xml_url: "https://example.com/fullwidth.xml".to_string(),
                html_url: None,
                folder: Some("ａｂｃ".to_string()),
            },
            OpmlFeed {
                title: "Turkish".to_string(),
                xml_url: "https://example.com/turkish.xml".to_string(),
                html_url: None,
                folder: Some("istanbul".to_string()),
            },
        ];

        let feeds = import_opml_in_db(&db, &parsed_feeds, account_id.0.clone()).unwrap();

        assert_eq!(feeds.len(), 4);
        let folder_names = db
            .reader()
            .prepare("SELECT name FROM folders ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get::<_, String>(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        let feed_folders = db
            .reader()
            .prepare(
                "SELECT feeds.title, folders.id, folders.name
                 FROM feeds
                 JOIN folders ON feeds.folder_id = folders.id
                 ORDER BY feeds.title",
            )
            .unwrap()
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        let feed_folder_names = feed_folders
            .iter()
            .map(|(title, _, folder_name)| (title.as_str(), folder_name.as_str()))
            .collect::<Vec<_>>();

        assert_eq!(
            folder_names,
            vec!["Cafe", "Engineering", "istanbul", "İstanbul", "ＡＢＣ"]
        );
        assert_eq!(
            feed_folder_names,
            vec![
                ("ASCII", "Engineering"),
                ("Accent", "Cafe"),
                ("Fullwidth", "ＡＢＣ"),
                ("Turkish", "istanbul"),
            ]
        );
        assert_eq!(feed_folders[0].1, ascii_folder_id.0);
        assert_eq!(feed_folders[1].1, accent_folder_id.0);
    }

    #[test]
    fn import_refreshes_query_statistics_after_creating_feeds() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let parsed_feeds = vec![OpmlFeed {
            title: "Rust Blog".to_string(),
            xml_url: "https://blog.rust-lang.org/feed.xml".to_string(),
            html_url: None,
            folder: Some("Engineering".to_string()),
        }];

        let feeds = import_opml_in_db(&db, &parsed_feeds, account_id.0.clone()).unwrap();

        assert_eq!(feeds.len(), 1);
        let stats_rows: i64 = db
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_stat1 WHERE tbl IN ('feeds', 'folders')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            stats_rows > 0,
            "OPML import should refresh planner statistics after writing feeds"
        );
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
    fn import_skips_duplicate_urls_within_same_file_and_keeps_first_feed() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let parsed_feeds = vec![
            OpmlFeed {
                title: "First Title".to_string(),
                xml_url: "https://example.com/shared.xml".to_string(),
                html_url: Some("https://example.com/first".to_string()),
                folder: Some("First Folder".to_string()),
            },
            OpmlFeed {
                title: "Second Title".to_string(),
                xml_url: "https://example.com/shared.xml".to_string(),
                html_url: Some("https://example.com/second".to_string()),
                folder: Some("Second Folder".to_string()),
            },
        ];

        let feeds = import_opml_in_db(&db, &parsed_feeds, account_id.0.clone()).unwrap();

        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].title, "First Title");
        assert_eq!(feeds[0].url, "https://example.com/shared.xml");
        let saved = db
            .reader()
            .query_row(
                "SELECT feeds.title, feeds.site_url, folders.name
                 FROM feeds
                 LEFT JOIN folders ON feeds.folder_id = folders.id
                 WHERE feeds.url = ?1",
                params!["https://example.com/shared.xml"],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                },
            )
            .unwrap();
        let folder_names = db
            .reader()
            .prepare("SELECT name FROM folders ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get::<_, String>(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(
            saved,
            (
                "First Title".to_string(),
                "https://example.com/first".to_string(),
                "First Folder".to_string()
            )
        );
        assert_eq!(folder_names, vec!["First Folder"]);
    }

    #[test]
    fn import_skips_duplicate_urls_within_same_file_by_normalized_url_key() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let parsed_feeds = vec![
            OpmlFeed {
                title: "First Title".to_string(),
                xml_url: "HTTPS://EXAMPLE.COM:443/%7Efeed/?b=2&a=1".to_string(),
                html_url: Some("https://example.com/first".to_string()),
                folder: Some("First Folder".to_string()),
            },
            OpmlFeed {
                title: "Second Title".to_string(),
                xml_url: "https://example.com/~feed?a=1&b=2".to_string(),
                html_url: Some("https://example.com/second".to_string()),
                folder: Some("Second Folder".to_string()),
            },
        ];

        let feeds = import_opml_in_db(&db, &parsed_feeds, account_id.0.clone()).unwrap();

        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].title, "First Title");
        assert_eq!(feeds[0].url, "HTTPS://EXAMPLE.COM:443/%7Efeed/?b=2&a=1");
        let folder_names = db
            .reader()
            .prepare("SELECT name FROM folders ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get::<_, String>(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(folder_names, vec!["First Folder"]);
    }

    #[test]
    fn import_skips_existing_url_without_overwriting_or_moving_folder() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let existing_folder_id = insert_test_folder(&db, &account_id, "Existing Folder");
        insert_test_feed(
            &db,
            &account_id,
            Some(&existing_folder_id),
            "Existing Title",
            "https://example.com/shared.xml",
        );
        let parsed_feeds = vec![OpmlFeed {
            title: "Imported Title".to_string(),
            xml_url: "https://example.com/shared.xml".to_string(),
            html_url: Some("https://example.com/imported".to_string()),
            folder: Some("Imported Folder".to_string()),
        }];

        let feeds = import_opml_in_db(&db, &parsed_feeds, account_id.0.clone()).unwrap();

        assert!(feeds.is_empty());
        let saved = db
            .reader()
            .query_row(
                "SELECT feeds.title, feeds.site_url, folders.name
                 FROM feeds
                 LEFT JOIN folders ON feeds.folder_id = folders.id
                 WHERE feeds.url = ?1",
                params!["https://example.com/shared.xml"],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                },
            )
            .unwrap();
        let folder_count: i64 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM folders", [], |row| row.get(0))
            .unwrap();

        assert_eq!(
            saved,
            (
                "Existing Title".to_string(),
                String::new(),
                "Existing Folder".to_string()
            )
        );
        assert_eq!(folder_count, 1);
    }

    #[test]
    fn import_skips_existing_url_by_normalized_url_key_without_overwriting_or_moving_folder() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let existing_folder_id = insert_test_folder(&db, &account_id, "Existing Folder");
        insert_test_feed(
            &db,
            &account_id,
            Some(&existing_folder_id),
            "Existing Title",
            "https://example.com/~feed?a=1&b=2",
        );
        let parsed_feeds = vec![OpmlFeed {
            title: "Imported Title".to_string(),
            xml_url: "HTTPS://EXAMPLE.COM:443/%7Efeed/?b=2&a=1".to_string(),
            html_url: Some("https://example.com/imported".to_string()),
            folder: Some("Imported Folder".to_string()),
        }];

        let feeds = import_opml_in_db(&db, &parsed_feeds, account_id.0.clone()).unwrap();

        assert!(feeds.is_empty());
        let saved = db
            .reader()
            .query_row(
                "SELECT feeds.title, feeds.site_url, folders.name
                 FROM feeds
                 LEFT JOIN folders ON feeds.folder_id = folders.id
                 WHERE feeds.url = ?1",
                params!["https://example.com/~feed?a=1&b=2"],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                },
            )
            .unwrap();
        let folder_count: i64 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM folders", [], |row| row.get(0))
            .unwrap();

        assert_eq!(
            saved,
            (
                "Existing Title".to_string(),
                String::new(),
                "Existing Folder".to_string()
            )
        );
        assert_eq!(folder_count, 1);
    }

    #[test]
    fn import_assigns_new_folder_sort_order_after_existing_max_order() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        insert_test_folder_with_sort_order(&db, &account_id, "Low", 2);
        insert_test_folder_with_sort_order(&db, &account_id, "Middle", 5);
        insert_test_folder_with_sort_order(&db, &account_id, "Gap High", 10);
        let parsed_feeds = vec![
            OpmlFeed {
                title: "Alpha".to_string(),
                xml_url: "https://example.com/alpha.xml".to_string(),
                html_url: None,
                folder: Some("Imported A".to_string()),
            },
            OpmlFeed {
                title: "Beta".to_string(),
                xml_url: "https://example.com/beta.xml".to_string(),
                html_url: None,
                folder: Some("Imported B".to_string()),
            },
        ];

        let feeds = import_opml_in_db(&db, &parsed_feeds, account_id.0.clone()).unwrap();

        assert_eq!(feeds.len(), 2);
        let imported_orders = db
            .reader()
            .prepare(
                "SELECT name, sort_order FROM folders
                 WHERE name LIKE 'Imported %'
                 ORDER BY sort_order, name",
            )
            .unwrap()
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?))
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(
            imported_orders,
            vec![
                ("Imported A".to_string(), 11),
                ("Imported B".to_string(), 12)
            ]
        );
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
    fn import_rolls_back_new_folder_after_duplicate_skip_when_feed_save_fails() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let existing_folder_id = insert_test_folder(&db, &account_id, "Existing Folder");
        insert_test_feed(
            &db,
            &account_id,
            Some(&existing_folder_id),
            "Existing Title",
            "https://example.com/existing.xml",
        );
        db.writer()
            .execute_batch(
                "CREATE TEMP TRIGGER fail_opml_feed_insert
                 BEFORE INSERT ON feeds
                 WHEN NEW.url = 'https://example.com/new.xml'
                 BEGIN
                   SELECT RAISE(FAIL, 'feed save failed');
                 END;",
            )
            .unwrap();
        let parsed_feeds = vec![
            OpmlFeed {
                title: "Duplicate".to_string(),
                xml_url: "https://example.com/existing.xml".to_string(),
                html_url: None,
                folder: Some("Skipped Folder".to_string()),
            },
            OpmlFeed {
                title: "New".to_string(),
                xml_url: "https://example.com/new.xml".to_string(),
                html_url: None,
                folder: Some("New Folder".to_string()),
            },
        ];

        let error = import_opml_in_db(&db, &parsed_feeds, account_id.0.clone())
            .expect_err("feed save failure should reject OPML import");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message.contains("feed save failed")
        ));
        let folders = db
            .reader()
            .prepare("SELECT name FROM folders ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get::<_, String>(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        let feeds = db
            .reader()
            .prepare("SELECT title, url FROM feeds ORDER BY title")
            .unwrap()
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(folders, vec!["Existing Folder"]);
        assert_eq!(
            feeds,
            vec![(
                "Existing Title".to_string(),
                "https://example.com/existing.xml".to_string()
            )]
        );
    }

    #[test]
    fn import_rolls_back_when_folder_save_fails_before_any_feed_is_saved() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        db.writer()
            .execute_batch(
                "CREATE TEMP TRIGGER fail_opml_folder_insert
                 BEFORE INSERT ON folders
                 BEGIN
                   SELECT RAISE(FAIL, 'folder save failed');
                 END;",
            )
            .unwrap();
        let parsed_feeds = vec![OpmlFeed {
            title: "New".to_string(),
            xml_url: "https://example.com/new.xml".to_string(),
            html_url: None,
            folder: Some("New Folder".to_string()),
        }];

        let error = import_opml_in_db(&db, &parsed_feeds, account_id.0.clone())
            .expect_err("folder save failure should reject OPML import");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message.contains("folder save failed")
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

    #[test]
    fn export_feed_order_is_locale_independent_utf8_order_with_id_tie_breaker() {
        let folder_news = folder("folder-news", "News", 0);
        let feeds = vec![
            feed("folder-emoji", Some(&folder_news.id), "🍎"),
            feed("folder-lower", Some(&folder_news.id), "alpha"),
            feed("folder-japanese", Some(&folder_news.id), "あ"),
            feed("folder-upper", Some(&folder_news.id), "Alpha"),
            feed("folder-alpha-2", Some(&folder_news.id), "Alpha"),
            feed("folder-alpha-1", Some(&folder_news.id), "Alpha"),
            feed(
                "top-orphan",
                Some(&FolderId("missing-folder".to_string())),
                "Orphan",
            ),
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
                (
                    "Alpha",
                    "https://example.com/folder-upper.xml",
                    Some("News"),
                ),
                (
                    "alpha",
                    "https://example.com/folder-lower.xml",
                    Some("News"),
                ),
                (
                    "あ",
                    "https://example.com/folder-japanese.xml",
                    Some("News")
                ),
                ("🍎", "https://example.com/folder-emoji.xml", Some("News")),
                ("Orphan", "https://example.com/top-orphan.xml", None),
            ],
        );
    }

    #[test]
    fn export_folder_order_tie_breaks_by_id_without_locale_collation() {
        let folder_beta = folder("folder-beta", "beta", 0);
        let folder_alpha = folder("folder-alpha", "Alpha", 0);
        let folder_japanese = folder("folder-japanese", "あ", 0);
        let feeds = vec![
            feed("japanese", Some(&folder_japanese.id), "Japanese feed"),
            feed("beta", Some(&folder_beta.id), "Beta feed"),
            feed("alpha", Some(&folder_alpha.id), "Alpha feed"),
        ];

        let opml_feeds = build_export_opml_feeds(
            feeds,
            vec![
                folder_beta.clone(),
                folder_japanese.clone(),
                folder_alpha.clone(),
            ],
        );

        let order = opml_feeds
            .iter()
            .map(|feed| feed.folder.as_deref())
            .collect::<Vec<_>>();
        assert_eq!(
            order,
            vec![
                Some(folder_alpha.name.as_str()),
                Some(folder_beta.name.as_str()),
                Some(folder_japanese.name.as_str()),
            ],
        );
    }

    #[test]
    fn export_generate_error_log_uses_redacted_sentinel() {
        assert_eq!(opml_generate_log_error_for_test(), "redacted");
        assert_ne!(
            opml_generate_log_error_for_test(),
            "Primary Account With Token https://example.com/?token=secret"
        );
    }

    #[test]
    fn export_build_output_round_trips_escaped_xml_in_stable_order() {
        let folder_news = folder("folder-news", "News & Research", 0);
        let folder_tools = folder("folder-tools", "Tools <Daily>", 1);
        let feeds = vec![
            Feed {
                site_url: "https://example.com/zulu?x=1&y=2".to_string(),
                ..feed("folder-zulu", Some(&folder_news.id), "Zulu & Friends")
            },
            Feed {
                site_url: "https://example.com/alpha?x=1&y=2".to_string(),
                ..feed("folder-alpha", Some(&folder_news.id), "Alpha & Friends")
            },
            feed("top-beta", None, "Beta <Top>"),
            feed("folder-tools", Some(&folder_tools.id), "Tools \"Daily\""),
        ];

        let opml_feeds = build_export_opml_feeds(feeds, vec![folder_tools, folder_news]);
        let xml = opml::generate_opml("Primary & Local", &opml_feeds).unwrap();
        let parsed = opml::parse_opml(&xml).unwrap();

        assert!(xml.contains("<title>Primary &amp; Local</title>"));
        assert_eq!(parsed, opml_feeds);
        assert_eq!(
            parsed
                .iter()
                .map(|feed| (feed.title.as_str(), feed.folder.as_deref()))
                .collect::<Vec<_>>(),
            vec![
                ("Alpha & Friends", Some("News & Research")),
                ("Zulu & Friends", Some("News & Research")),
                ("Tools \"Daily\"", Some("Tools <Daily>")),
                ("Beta <Top>", None),
            ],
        );
    }

    #[test]
    fn export_sanitizes_invalid_xml_chars_in_account_feed_and_folder_titles() {
        let replacement = char::REPLACEMENT_CHARACTER;
        let folder_news = folder("folder-news", "News\u{0}Research", 0);
        let feeds = vec![feed(
            "folder-alpha",
            Some(&folder_news.id),
            "Alpha\u{8}Friends",
        )];

        let opml_feeds = build_export_opml_feeds(feeds, vec![folder_news]);
        let xml = opml::generate_opml("Primary\u{C}Local", &opml_feeds).unwrap();
        let parsed = opml::parse_opml(&xml).unwrap();

        assert!(!xml.contains('\u{0}'));
        assert!(!xml.contains('\u{8}'));
        assert!(!xml.contains('\u{C}'));
        assert!(xml.contains(&format!("<title>Primary{replacement}Local</title>")));
        assert_eq!(parsed[0].title, format!("Alpha{replacement}Friends"));
        assert_eq!(parsed[0].folder, Some(format!("News{replacement}Research")));
    }
}
