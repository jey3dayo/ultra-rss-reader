use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
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
const OPML_GENERATE_ERROR_MESSAGE: &str = "Failed to generate OPML export";
const OPML_GENERATE_LOG_ERROR: &str = "redacted";
pub(crate) const OPML_IMPORT_CONTENT_MAX_BYTES: usize = 4096 * 1024;
const OPML_IMPORT_CONTENT_TOO_LARGE_MESSAGE: &str = "OPML import file is too large";
const OPML_EXPORT_PATH_EMPTY_MESSAGE: &str = "OPML export path cannot be empty";
const OPML_EXPORT_WRITE_ERROR_PREFIX: &str = "Failed to write OPML export";
const OPML_EXPORT_EXTENSION_CONFLICT_PREFIX: &str =
    "A file already exists at the auto-generated .opml path";
const OPML_EXPORT_FILE_EXTENSION: &str = "opml";

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
    let parsed_feeds = parse_import_opml(opml_content)?;

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

fn refresh_import_query_statistics(db: &DbManager) {
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

fn parse_import_opml(opml_content: &str) -> Result<Vec<OpmlFeed>, AppError> {
    if opml_content.len() > OPML_IMPORT_CONTENT_MAX_BYTES {
        return Err(AppError::UserVisible {
            message: OPML_IMPORT_CONTENT_TOO_LARGE_MESSAGE.to_string(),
        });
    }

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

    validate_discovery_request_url(&parsed).map_err(|error| match error {
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
pub fn export_opml_to_file(
    state: State<'_, AppState>,
    account_id: String,
    path: String,
) -> Result<(), AppError> {
    let path = validate_opml_export_path(path)?;
    let db = crate::commands::lock_db(&state.db)?;
    export_opml_to_file_in_db(&db, account_id, &path)
}

fn export_opml_to_file_in_db(
    db: &DbManager,
    account_id: String,
    path: &Path,
) -> Result<(), AppError> {
    let opml = generate_export_opml_in_db(db, account_id)?;
    write_opml_export_atomic(path, &opml)
}

fn generate_export_opml_in_db(db: &DbManager, account_id: String) -> Result<String, AppError> {
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

fn validate_opml_export_path(path: String) -> Result<PathBuf, AppError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppError::UserVisible {
            message: OPML_EXPORT_PATH_EMPTY_MESSAGE.to_string(),
        });
    }
    let requested = PathBuf::from(trimmed);
    let resolved = ensure_opml_extension(requested.clone());

    // The OS save dialog only confirms overwrite for the exact name the user
    // typed. When we auto-append ".opml" the resolved path is a different
    // file the dialog never asked about, so silently replacing it here would
    // bypass that confirmation. Only the auto-append case needs this check:
    // an explicit ".opml" path already went through the dialog's own prompt.
    if resolved != requested && resolved.exists() {
        return Err(AppError::UserVisible {
            message: format!(
                "{OPML_EXPORT_EXTENSION_CONFLICT_PREFIX}: {}",
                crate::infra::db::backup::redacted_path_label(&resolved)
            ),
        });
    }

    Ok(resolved)
}

/// Contract: auto_appends_extension. Append ".opml" when the selected path
/// does not already have the extension; never replace a user-provided
/// extension because the OS dialog confirmed overwrite for that exact name.
fn ensure_opml_extension(path: PathBuf) -> PathBuf {
    let has_opml_extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case(OPML_EXPORT_FILE_EXTENSION));
    if has_opml_extension {
        return path;
    }

    let Some(file_name) = path.file_name() else {
        return path.with_file_name("feeds.opml");
    };
    let mut file_name = file_name.to_os_string();
    file_name.push(".opml");
    path.with_file_name(file_name)
}

fn opml_export_temp_path(path: &Path) -> PathBuf {
    let mut file_name = path
        .file_name()
        .map(std::ffi::OsStr::to_os_string)
        .unwrap_or_else(|| std::ffi::OsString::from("feeds.opml"));
    file_name.push(".tmp");
    path.with_file_name(file_name)
}

/// Contract: TempFileThenRename with temp cleanup on failure
/// (same shape as infra/db/backup.rs::copy_backup_file_atomic).
fn write_opml_export_atomic(path: &Path, contents: &str) -> Result<(), AppError> {
    let temp_path = opml_export_temp_path(path);
    if temp_path.exists() {
        std::fs::remove_file(&temp_path)
            .map_err(|error| opml_export_write_error(&temp_path, &error))?;
    }
    std::fs::write(&temp_path, contents).map_err(|error| {
        let _ = std::fs::remove_file(&temp_path);
        opml_export_write_error(path, &error)
    })?;
    std::fs::rename(&temp_path, path).map_err(|error| {
        let _ = std::fs::remove_file(&temp_path);
        opml_export_write_error(path, &error)
    })?;
    Ok(())
}

fn opml_export_write_error(path: &Path, error: &std::io::Error) -> AppError {
    tracing::error!(
        error = %error,
        path = %crate::infra::db::backup::redacted_path_label(path),
        "failed to write OPML export"
    );
    AppError::UserVisible {
        message: format!(
            "{OPML_EXPORT_WRITE_ERROR_PREFIX}: {error} ({})",
            crate::infra::db::backup::redacted_path_label(path)
        ),
    }
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
    let folder_map: HashMap<FolderId, String> = folders
        .iter()
        .map(|f| (f.id.clone(), f.name.clone()))
        .collect();
    let feed_count = feeds.len();
    let mut foldered_feeds: HashMap<FolderId, Vec<Feed>> = HashMap::new();
    let mut remaining_feeds = Vec::new();

    for feed in feeds {
        if let Some(folder_id) = feed
            .folder_id
            .as_ref()
            .filter(|folder_id| folder_map.contains_key(*folder_id))
            .cloned()
        {
            foldered_feeds.entry(folder_id).or_default().push(feed);
        } else {
            remaining_feeds.push(feed);
        }
    }

    let mut opml_feeds = Vec::with_capacity(feed_count);

    for folder in folders {
        if let Some(mut feeds) = foldered_feeds.remove(&folder.id) {
            feeds.sort_by(compare_export_feeds);
            opml_feeds.extend(
                feeds
                    .into_iter()
                    .map(|feed| feed_to_opml_feed(feed, Some(folder.name.clone()))),
            );
        }
    }

    remaining_feeds.sort_by(compare_export_feeds);
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
thread_local! {
    static FORCE_IMPORT_QUERY_STATISTICS_REFRESH_FAILURE: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

#[cfg(test)]
mod tests;
