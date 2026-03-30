pub mod account_commands;
pub mod article_commands;
pub mod browser_webview_commands;
pub mod dto;
pub mod feed_commands;
pub mod opml_commands;
pub mod preference_commands;
pub mod share_commands;
pub mod tag_commands;
pub mod updater_commands;

use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use crate::browser_webview::BrowserWebviewTracker;
use crate::infra::db::connection::DbManager;

pub struct AppState {
    pub db: Mutex<DbManager>,
    pub syncing: Arc<AtomicBool>,
    pub automatic_sync_enabled: Arc<AtomicBool>,
    pub automatic_sync_notify: Arc<tokio::sync::Notify>,
    pub browser_webview: Mutex<BrowserWebviewTracker>,
}
