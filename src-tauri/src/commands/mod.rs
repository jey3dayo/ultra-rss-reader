pub mod account_commands;
pub mod article_commands;
pub mod browser_webview_commands;
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
use std::sync::{Arc, Mutex};

use dto::AppError;
use tauri::Url;

use crate::browser_webview::BrowserWebviewTracker;
use crate::infra::db::connection::DbManager;

const BROWSER_URL_SCHEME_ERROR: &str = "Only http:// and https:// URLs are supported";

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

pub struct AppState {
    pub db: Mutex<DbManager>,
    pub syncing: Arc<AtomicBool>,
    pub automatic_sync_enabled: Arc<AtomicBool>,
    pub automatic_sync_notify: Arc<tokio::sync::Notify>,
    pub browser_webview: Mutex<BrowserWebviewTracker>,
}
