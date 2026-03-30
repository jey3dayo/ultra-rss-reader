pub mod account_commands;
pub mod article_commands;
pub mod browser_webview_commands;
pub mod database_commands;
pub mod dto;
pub mod feed_commands;
pub mod opml_commands;
pub mod preference_commands;
pub mod share_commands;
pub mod sync_commands;
mod sync_providers;
pub mod tag_commands;
pub mod updater_commands;

use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex, MutexGuard, TryLockError};

use dto::AppError;
use tauri::Url;

use crate::browser_webview::BrowserWebviewTracker;
use crate::infra::db::connection::DbManager;

const BROWSER_URL_SCHEME_ERROR: &str = "Only http:// and https:// URLs are supported";
const DATABASE_BUSY_ERROR: &str =
    "Database is busy. Wait for the current operation to finish and try again.";

pub(crate) fn parse_browser_http_url(url: &str) -> Result<Url, AppError> {
    let parsed: Url = url.parse().map_err(|_| AppError::UserVisible {
        message: BROWSER_URL_SCHEME_ERROR.to_string(),
    })?;

    match parsed.scheme() {
        "http" | "https" => Ok(parsed),
        _ => Err(AppError::UserVisible {
            message: BROWSER_URL_SCHEME_ERROR.to_string(),
        }),
    }
}

pub(crate) fn try_lock_db(db: &Mutex<DbManager>) -> Result<MutexGuard<'_, DbManager>, AppError> {
    match db.try_lock() {
        Ok(guard) => Ok(guard),
        Err(TryLockError::WouldBlock) => Err(AppError::UserVisible {
            message: DATABASE_BUSY_ERROR.to_string(),
        }),
        Err(TryLockError::Poisoned(error)) => Err(AppError::UserVisible {
            message: format!("Lock error: {error}"),
        }),
    }
}

pub struct AppState {
    pub db: Mutex<DbManager>,
    pub syncing: Arc<AtomicBool>,
    pub automatic_sync_enabled: Arc<AtomicBool>,
    pub automatic_sync_notify: Arc<tokio::sync::Notify>,
    pub browser_webview: Mutex<BrowserWebviewTracker>,
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::{try_lock_db, DATABASE_BUSY_ERROR};
    use crate::commands::dto::AppError;
    use crate::infra::db::connection::DbManager;

    #[test]
    fn try_lock_db_returns_user_visible_error_when_busy() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let _guard = db.lock().unwrap();

        let error = match try_lock_db(&db) {
            Ok(_) => panic!("busy DB should not block"),
            Err(error) => error,
        };

        match error {
            AppError::UserVisible { message } => {
                assert_eq!(message, DATABASE_BUSY_ERROR);
            }
            other => panic!("expected user-visible error, got {other:?}"),
        }
    }
}
