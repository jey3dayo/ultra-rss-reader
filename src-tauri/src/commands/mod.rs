pub mod account_commands;
pub mod article_commands;
pub mod browser_webview_commands;
pub mod database_commands;
pub mod dto;
pub mod feed_commands;
pub mod log_commands;
pub mod mute_keyword_commands;
pub mod opml_commands;
pub mod platform_commands;
pub mod preference_commands;
pub mod share_commands;
pub mod sync_commands;
mod sync_providers;
pub mod tag_commands;
pub mod updater_commands;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, TryLockError};

use dto::AppError;
use tauri::Url;

use crate::browser_webview::BrowserWebviewTracker;
use crate::infra::db::connection::DbManager;

const BROWSER_URL_SCHEME_ERROR: &str = "Only http:// and https:// URLs are supported";
const DATABASE_BUSY_ERROR: &str =
    "Database is busy. Wait for the current operation to finish and try again.";
pub(crate) const APP_STATE_POISONED_ERROR: &str =
    "Application state needs recovery. Restart the application and check diagnostics if it happens again.";
pub(crate) const DATABASE_MAINTENANCE_BUSY_ERROR: &str =
    "Database maintenance is unavailable while syncing. Try again after sync completes.";

#[cfg(test)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CommandDbLockPolicy {
    TryLockDb,
    BlockingLock,
    NoDatabaseLock,
}

#[cfg(test)]
pub(crate) fn command_db_lock_policy(command_name: &str) -> Option<CommandDbLockPolicy> {
    let policy = match command_name {
        "get_database_info" | "vacuum_database" => CommandDbLockPolicy::TryLockDb,
        "open_in_browser"
        | "check_browser_embed_support"
        | "create_or_update_browser_webview"
        | "set_browser_webview_bounds"
        | "focus_browser_webview"
        | "go_back_browser_webview"
        | "go_forward_browser_webview"
        | "reload_browser_webview"
        | "close_browser_webview"
        | "copy_to_clipboard"
        | "add_to_reading_list"
        | "get_platform_info"
        | "get_dev_runtime_options"
        | "get_platform_permission_denied_recovery"
        | "check_for_update"
        | "download_and_install_update"
        | "restart_app"
        | "open_log_dir" => CommandDbLockPolicy::NoDatabaseLock,
        "list_accounts"
        | "add_account"
        | "update_account_sync"
        | "update_account_credentials"
        | "rename_account"
        | "test_account_connection"
        | "delete_account"
        | "list_folders"
        | "create_folder"
        | "list_feeds"
        | "add_local_feed"
        | "delete_feed"
        | "rename_feed"
        | "update_feed_folder"
        | "update_feed_display_settings"
        | "discover_feeds"
        | "trigger_sync"
        | "trigger_startup_sync"
        | "get_account_sync_status"
        | "trigger_sync_account"
        | "trigger_sync_feed"
        | "trigger_automatic_sync"
        | "list_articles"
        | "list_account_articles"
        | "list_feed_article_summaries"
        | "list_folder_articles"
        | "list_starred_articles"
        | "list_recent_articles"
        | "count_account_unread_articles"
        | "count_account_starred_articles"
        | "mark_account_read"
        | "mark_account_starred_read"
        | "count_old_unread_articles"
        | "mark_old_unread_read"
        | "unstar_account_articles"
        | "get_feed_integrity_report"
        | "cleanup_feed_integrity_orphans"
        | "mark_article_read"
        | "record_article_view"
        | "clear_article_view_history"
        | "mark_articles_read"
        | "mark_feed_read"
        | "mark_folder_read"
        | "toggle_article_star"
        | "import_opml"
        | "export_opml"
        | "search_articles"
        | "list_mute_keywords"
        | "create_mute_keyword"
        | "update_mute_keyword"
        | "delete_mute_keyword"
        | "set_mute_auto_mark_read"
        | "get_preferences"
        | "set_preference"
        | "list_tags"
        | "create_tag"
        | "rename_tag"
        | "delete_tag"
        | "create_tag_and_assign_article"
        | "tag_article"
        | "untag_article"
        | "get_article_tags"
        | "list_articles_by_tag"
        | "get_tag_article_counts" => CommandDbLockPolicy::BlockingLock,
        _ => return None,
    };
    Some(policy)
}

#[derive(Debug)]
pub(crate) struct DatabaseMaintenanceGuard<'a>(&'a AtomicBool);

impl Drop for DatabaseMaintenanceGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

pub(crate) fn start_database_maintenance(
    syncing: &AtomicBool,
) -> Result<DatabaseMaintenanceGuard<'_>, AppError> {
    syncing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .map(|_| DatabaseMaintenanceGuard(syncing))
        .map_err(|_| AppError::UserVisible {
            message: DATABASE_MAINTENANCE_BUSY_ERROR.to_string(),
        })
}

pub(crate) fn parse_browser_http_url(url: &str) -> Result<Url, AppError> {
    let parsed: Url = url.parse().map_err(|_| AppError::UserVisible {
        message: BROWSER_URL_SCHEME_ERROR.to_string(),
    })?;

    match parsed.scheme() {
        "http" | "https" if parsed.username().is_empty() && parsed.password().is_none() => {
            Ok(parsed)
        }
        _ => Err(AppError::UserVisible {
            message: BROWSER_URL_SCHEME_ERROR.to_string(),
        }),
    }
}

pub(crate) fn redacted_browser_url_for_display(raw_url: &str) -> String {
    match raw_url.parse::<Url>() {
        Ok(mut url) if url.scheme() == "http" || url.scheme() == "https" => {
            let has_non_origin_parts =
                url.path() != "/" || url.query().is_some() || url.fragment().is_some();
            let _ = url.set_username("");
            let _ = url.set_password(None);
            url.set_path("/");
            url.set_query(None);
            url.set_fragment(None);
            let origin = url.to_string().trim_end_matches('/').to_string();
            if has_non_origin_parts {
                return format!("{origin}/...");
            }
            url.to_string()
        }
        Ok(url) => format!("{}://<redacted>", url.scheme()),
        Err(_) => "<invalid-url>".to_string(),
    }
}

pub(crate) fn redacted_browser_diagnostic_text(value: &str) -> String {
    value
        .split_whitespace()
        .map(redacted_browser_diagnostic_token)
        .collect::<Vec<_>>()
        .join(" ")
}

fn redacted_browser_diagnostic_token(token: &str) -> String {
    let trailing_punctuation = token
        .chars()
        .rev()
        .take_while(|c| matches!(c, ')' | ',' | '.' | ';' | '!' | '?' | ':'))
        .count();
    let (url_token, trailing) = token.split_at(token.len().saturating_sub(trailing_punctuation));

    match url_token.parse::<Url>() {
        Ok(url) if url.scheme() == "http" || url.scheme() == "https" => {
            format!(
                "{}{}",
                redacted_browser_url_for_display(url_token),
                trailing
            )
        }
        _ => token.to_string(),
    }
}

pub(crate) fn try_lock_db(db: &Mutex<DbManager>) -> Result<MutexGuard<'_, DbManager>, AppError> {
    match db.try_lock() {
        Ok(guard) => Ok(guard),
        Err(TryLockError::WouldBlock) => Err(AppError::UserVisible {
            message: DATABASE_BUSY_ERROR.to_string(),
        }),
        Err(TryLockError::Poisoned(error)) => {
            tracing::error!("Database mutex poisoned: {error}");
            Err(AppError::UserVisible {
                message: APP_STATE_POISONED_ERROR.to_string(),
            })
        }
    }
}

pub(crate) fn lock_db(db: &Mutex<DbManager>) -> Result<MutexGuard<'_, DbManager>, AppError> {
    db.lock().map_err(|error| {
        tracing::error!("Database mutex poisoned: {error}");
        AppError::UserVisible {
            message: APP_STATE_POISONED_ERROR.to_string(),
        }
    })
}

pub(crate) fn lock_browser_webview(
    browser_webview: &Mutex<BrowserWebviewTracker>,
) -> Result<MutexGuard<'_, BrowserWebviewTracker>, AppError> {
    browser_webview.lock().map_err(|error| {
        tracing::error!("Browser webview mutex poisoned: {error}");
        AppError::UserVisible {
            message: APP_STATE_POISONED_ERROR.to_string(),
        }
    })
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

    use super::{
        command_db_lock_policy, lock_browser_webview, lock_db, parse_browser_http_url,
        redacted_browser_diagnostic_text, redacted_browser_url_for_display, try_lock_db,
        CommandDbLockPolicy, APP_STATE_POISONED_ERROR, DATABASE_BUSY_ERROR,
    };
    use crate::browser_webview::BrowserWebviewTracker;
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

    #[test]
    fn try_lock_db_returns_recovery_message_when_poisoned() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let poison_result = std::panic::catch_unwind(|| {
            let _guard = db.lock().unwrap();
            panic!("poison test database lock");
        });
        assert!(poison_result.is_err());

        let error = match try_lock_db(&db) {
            Ok(_) => panic!("poisoned DB should return an error"),
            Err(error) => error,
        };

        match error {
            AppError::UserVisible { message } => {
                assert_eq!(message, APP_STATE_POISONED_ERROR);
                assert!(!message.contains("poison"));
                assert!(!message.contains("Lock error"));
            }
            other => panic!("expected user-visible error, got {other:?}"),
        }
    }

    #[test]
    fn lock_db_returns_recovery_message_when_poisoned() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let poison_result = std::panic::catch_unwind(|| {
            let _guard = db.lock().unwrap();
            panic!("poison test database lock");
        });
        assert!(poison_result.is_err());

        let error = match lock_db(&db) {
            Ok(_) => panic!("poisoned DB should return an error"),
            Err(error) => error,
        };

        match error {
            AppError::UserVisible { message } => {
                assert_eq!(message, APP_STATE_POISONED_ERROR);
                assert!(!message.contains("poison"));
                assert!(!message.contains("Lock error"));
            }
            other => panic!("expected user-visible error, got {other:?}"),
        }
    }

    #[test]
    fn lock_browser_webview_returns_same_recovery_message_when_poisoned() {
        let browser_webview = Mutex::new(BrowserWebviewTracker::default());
        let poison_result = std::panic::catch_unwind(|| {
            let _guard = browser_webview.lock().unwrap();
            panic!("poison test browser webview lock");
        });
        assert!(poison_result.is_err());

        let error = match lock_browser_webview(&browser_webview) {
            Ok(_) => panic!("poisoned browser webview should return an error"),
            Err(error) => error,
        };

        match error {
            AppError::UserVisible { message } => {
                assert_eq!(message, APP_STATE_POISONED_ERROR);
                assert!(!message.contains("poison"));
                assert!(!message.contains("Lock error"));
            }
            other => panic!("expected user-visible error, got {other:?}"),
        }
    }

    #[test]
    fn command_db_lock_policy_classifies_command_categories() {
        let cases = [
            ("get_database_info", CommandDbLockPolicy::TryLockDb),
            ("vacuum_database", CommandDbLockPolicy::TryLockDb),
            ("import_opml", CommandDbLockPolicy::BlockingLock),
            ("export_opml", CommandDbLockPolicy::BlockingLock),
            ("search_articles", CommandDbLockPolicy::BlockingLock),
            ("list_articles", CommandDbLockPolicy::BlockingLock),
            ("add_account", CommandDbLockPolicy::BlockingLock),
            ("test_account_connection", CommandDbLockPolicy::BlockingLock),
            ("list_accounts", CommandDbLockPolicy::BlockingLock),
            ("delete_feed", CommandDbLockPolicy::BlockingLock),
            ("trigger_sync", CommandDbLockPolicy::BlockingLock),
            ("open_in_browser", CommandDbLockPolicy::NoDatabaseLock),
            ("check_for_update", CommandDbLockPolicy::NoDatabaseLock),
        ];

        for (command_name, expected_policy) in cases {
            assert_eq!(
                command_db_lock_policy(command_name),
                Some(expected_policy),
                "{command_name} should keep the documented DB lock policy"
            );
        }
    }

    #[test]
    fn command_db_lock_policy_rejects_unclassified_commands() {
        assert_eq!(command_db_lock_policy("unknown_command"), None);
    }

    #[test]
    fn parse_browser_http_url_rejects_credentials() {
        for url in [
            "https://user@example.com/article",
            "https://user:pass@example.com/article",
        ] {
            let error = parse_browser_http_url(url).unwrap_err();

            match error {
                AppError::UserVisible { message } => {
                    assert_eq!(message, super::BROWSER_URL_SCHEME_ERROR);
                }
                other => panic!("expected user-visible error, got {other:?}"),
            }
        }
    }

    #[test]
    fn redacted_browser_display_url_hides_secret_bearing_parts() {
        let redacted = redacted_browser_url_for_display(
            "https://user:pass@example.com/private?token=raw&utm=1#secret",
        );

        assert_eq!(redacted, "https://example.com/...");
        assert!(!redacted.contains("user"));
        assert!(!redacted.contains("pass"));
        assert!(!redacted.contains("/private"));
        assert!(!redacted.contains("token=raw"));
        assert!(!redacted.contains("secret"));
    }

    #[test]
    fn redacted_browser_diagnostic_text_only_redacts_url_tokens() {
        let redacted = redacted_browser_diagnostic_text(
            "failed for https://user:pass@example.com/private?token=raw#frag, retry later",
        );

        assert_eq!(redacted, "failed for https://example.com/..., retry later");
    }
}
