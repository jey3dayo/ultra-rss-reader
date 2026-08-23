use std::cmp::Ordering;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::domain::feed::Feed;
use crate::domain::folder::Folder;
use crate::domain::types::{AccountId, FolderId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_folder::SqliteFolderRepository;
use crate::infra::opml;
use crate::infra::opml::OpmlFeed;
use crate::repository::account::AccountRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;

const OPML_GENERATE_ERROR_MESSAGE: &str = "Failed to generate OPML export";
pub(crate) const OPML_GENERATE_LOG_ERROR: &str = "redacted";
const OPML_EXPORT_PATH_EMPTY_MESSAGE: &str = "OPML export path cannot be empty";
const OPML_EXPORT_WRITE_ERROR_PREFIX: &str = "Failed to write OPML export";
const OPML_EXPORT_EXTENSION_CONFLICT_PREFIX: &str =
    "A file already exists at the auto-generated .opml path";
const OPML_EXPORT_FILE_EXTENSION: &str = "opml";

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

pub(crate) fn export_opml_to_file_in_db(
    db: &DbManager,
    account_id: String,
    path: &Path,
) -> Result<(), AppError> {
    let opml = generate_export_opml_in_db(db, account_id)?;
    write_opml_export_atomic(path, &opml)
}

pub(crate) fn generate_export_opml_in_db(
    db: &DbManager,
    account_id: String,
) -> Result<String, AppError> {
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

pub(crate) fn validate_opml_export_path(path: String) -> Result<PathBuf, AppError> {
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
pub(crate) fn ensure_opml_extension(path: PathBuf) -> PathBuf {
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

pub(crate) fn opml_export_temp_path(path: &Path) -> PathBuf {
    let mut file_name = path
        .file_name()
        .map(std::ffi::OsStr::to_os_string)
        .unwrap_or_else(|| std::ffi::OsString::from("feeds.opml"));
    file_name.push(".tmp");
    path.with_file_name(file_name)
}

/// Contract: TempFileThenRename with temp cleanup on failure
/// (same shape as infra/db/backup/mod.rs::copy_backup_file_atomic).
pub(crate) fn write_opml_export_atomic(path: &Path, contents: &str) -> Result<(), AppError> {
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

pub(crate) fn opml_export_write_error(path: &Path, error: &std::io::Error) -> AppError {
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

pub(crate) fn build_export_opml_feeds(feeds: Vec<Feed>, folders: Vec<Folder>) -> Vec<OpmlFeed> {
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

pub(crate) fn feed_to_opml_feed(feed: Feed, folder: Option<String>) -> OpmlFeed {
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

pub(crate) fn compare_export_feeds(a: &Feed, b: &Feed) -> Ordering {
    a.title
        .as_bytes()
        .cmp(b.title.as_bytes())
        .then_with(|| a.id.0.cmp(&b.id.0))
}

#[cfg(test)]
pub(crate) fn opml_generate_log_error_for_test() -> &'static str {
    OPML_GENERATE_LOG_ERROR
}
