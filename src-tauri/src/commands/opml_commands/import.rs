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
use crate::infra::feed_discovery::validate_discovery_request_url;
use crate::infra::opml;
use crate::infra::opml::OpmlFeed;
use crate::repository::account::AccountRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;

const UNSUPPORTED_URL_VALIDATION_MESSAGE: &str = "Only http:// and https:// URLs are supported";
pub(crate) const OPML_IMPORT_CONTENT_TOO_LARGE_MESSAGE: &str = "OPML import file is too large";

#[tauri::command]
pub fn import_opml(
    state: State<'_, AppState>,
    opml_content: String,
    account_id: String,
) -> Result<Vec<FeedDto>, AppError> {
    import_opml_inner(&state.db, &state.syncing, &opml_content, account_id)
}

pub(crate) fn import_opml_inner(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    opml_content: &str,
    account_id: String,
) -> Result<Vec<FeedDto>, AppError> {
    let _maintenance_guard = start_database_maintenance(syncing)?;
    let parsed_feeds = parse_import_opml(opml_content)?;

    let db = try_lock_db(db)?;

    import_opml_in_db(&db, &parsed_feeds, account_id)
}

pub(crate) fn folder_cache_key(name: &str) -> String {
    name.trim().to_lowercase()
}

pub(crate) fn import_opml_in_db(
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
            icon_url: None,
            unread_count: 0,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        };

        feed_repo.save(&feed).map_err(AppError::from)?;
        created_feeds.push(FeedDto::from(feed));
    }

    tx.commit().map_err(DomainError::from)?;
    if !created_feeds.is_empty() {
        refresh_import_query_statistics(db);
    }
    Ok(created_feeds)
}

pub(crate) fn refresh_import_query_statistics(db: &DbManager) {
    if let Err(error) = refresh_import_query_statistics_inner(db) {
        tracing::warn!(
            error = %error,
            "OPML import committed, but query statistics refresh failed"
        );
    }
}

#[cfg(not(test))]
fn refresh_import_query_statistics_inner(db: &DbManager) -> crate::domain::error::DomainResult<()> {
    db.refresh_query_statistics()
}

#[cfg(test)]
fn refresh_import_query_statistics_inner(db: &DbManager) -> crate::domain::error::DomainResult<()> {
    if FORCE_IMPORT_QUERY_STATISTICS_REFRESH_FAILURE.with(std::cell::Cell::get) {
        return Err(DomainError::Persistence(
            "forced OPML import query statistics refresh failure".to_string(),
        ));
    }

    db.refresh_query_statistics()
}

pub(crate) fn parse_import_opml(opml_content: &str) -> Result<Vec<OpmlFeed>, AppError> {
    if opml_content.len() > super::OPML_IMPORT_CONTENT_MAX_BYTES {
        return Err(AppError::UserVisible {
            message: OPML_IMPORT_CONTENT_TOO_LARGE_MESSAGE.to_string(),
        });
    }

    let feeds =
        opml::parse_opml(opml_content).map_err(|message| AppError::UserVisible { message })?;
    normalize_import_opml_feeds(feeds)
}

pub(crate) fn normalize_import_opml_feeds(feeds: Vec<OpmlFeed>) -> Result<Vec<OpmlFeed>, AppError> {
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

pub(crate) fn validate_opml_feed_url(url: &str) -> Result<String, AppError> {
    let parsed = reqwest::Url::parse(url).map_err(|_| AppError::UserVisible {
        message: UNSUPPORTED_URL_VALIDATION_MESSAGE.to_string(),
    })?;

    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(AppError::UserVisible {
            message: UNSUPPORTED_URL_VALIDATION_MESSAGE.to_string(),
        });
    }

    validate_discovery_request_url(&parsed).map_err(|error| match error {
        DomainError::Validation(message) => AppError::UserVisible { message },
        other => AppError::from(other),
    })?;

    Ok(url.to_string())
}

pub(crate) fn normalized_feed_url_key(raw_url: &str) -> Option<String> {
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

pub(crate) fn normalize_feed_url_key_path(path: &str) -> String {
    let mut normalized = normalize_unreserved_percent_encoding(path);
    while normalized.len() > 1 && normalized.ends_with('/') {
        normalized.pop();
    }
    normalized
}

pub(crate) fn normalize_unreserved_percent_encoding(value: &str) -> String {
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

pub(crate) fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
thread_local! {
    pub(crate) static FORCE_IMPORT_QUERY_STATISTICS_REFRESH_FAILURE: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

pub(crate) fn next_import_folder_sort_order(existing_folders: &[Folder]) -> i32 {
    existing_folders
        .iter()
        .map(|folder| folder.sort_order)
        .max()
        .map_or(0, |sort_order| sort_order.saturating_add(1))
}
