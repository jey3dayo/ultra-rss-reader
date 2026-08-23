use std::sync::Mutex;

use super::{
    command_db_lock_policy, lock_browser_webview, lock_db, parse_browser_http_url,
    redacted_browser_diagnostic_text, redacted_browser_url_for_display, try_lock_db,
    CommandDbLockPolicy, APP_STATE_POISONED_ERROR, DATABASE_BUSY_ERROR,
};
use crate::browser_webview::BrowserWebviewTracker;
use crate::commands::dto::AppError;
use crate::infra::db::connection::DbManager;

fn assert_app_state_poisoned_error(error: AppError) {
    match error {
        AppError::UserVisible { message } => {
            assert_eq!(message, APP_STATE_POISONED_ERROR);
            assert!(!message.contains("poison"));
            assert!(!message.contains("Lock error"));
        }
        other => panic!("expected user-visible app state recovery error, got {other:?}"),
    }
}

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

    assert_app_state_poisoned_error(error);
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

    assert_app_state_poisoned_error(error);
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

    assert_app_state_poisoned_error(error);
}

#[test]
fn poisonable_app_state_mutex_helpers_share_recovery_error_contract() {
    let db_for_try_lock = Mutex::new(DbManager::new_in_memory().unwrap());
    let try_lock_poison_result = std::panic::catch_unwind(|| {
        let _guard = db_for_try_lock.lock().unwrap();
        panic!("poison test database try-lock");
    });
    assert!(try_lock_poison_result.is_err());

    let db_for_lock = Mutex::new(DbManager::new_in_memory().unwrap());
    let lock_poison_result = std::panic::catch_unwind(|| {
        let _guard = db_for_lock.lock().unwrap();
        panic!("poison test database lock");
    });
    assert!(lock_poison_result.is_err());

    let browser_webview = Mutex::new(BrowserWebviewTracker::default());
    let browser_poison_result = std::panic::catch_unwind(|| {
        let _guard = browser_webview.lock().unwrap();
        panic!("poison test browser webview lock");
    });
    assert!(browser_poison_result.is_err());

    let cases = [
        (
            "try_lock_db",
            match try_lock_db(&db_for_try_lock) {
                Ok(_) => panic!("poisoned DB try-lock should return an error"),
                Err(error) => error,
            },
        ),
        (
            "lock_db",
            match lock_db(&db_for_lock) {
                Ok(_) => panic!("poisoned DB lock should return an error"),
                Err(error) => error,
            },
        ),
        (
            "lock_browser_webview",
            lock_browser_webview(&browser_webview)
                .expect_err("poisoned browser webview lock should return an error"),
        ),
    ];

    for (helper_name, error) in cases {
        assert_app_state_poisoned_error(error);
        assert!(
            matches!(
                command_db_lock_policy("check_for_update"),
                Some(CommandDbLockPolicy::NoDatabaseLock)
            ),
            "{helper_name} poison contract should stay independent of non-DB update commands"
        );
    }
}

#[test]
fn command_db_lock_policy_classifies_command_categories() {
    let cases = [
        ("get_database_info", CommandDbLockPolicy::TryLockDb),
        ("vacuum_database", CommandDbLockPolicy::TryLockDb),
        ("backup_database", CommandDbLockPolicy::TryLockDb),
        ("import_opml", CommandDbLockPolicy::TryLockDb),
        ("import_settings_profile", CommandDbLockPolicy::TryLockDb),
        (
            "cleanup_feed_integrity_orphans",
            CommandDbLockPolicy::TryLockDb,
        ),
        (
            "get_feed_integrity_report",
            CommandDbLockPolicy::BlockingLock,
        ),
        ("export_opml_to_file", CommandDbLockPolicy::BlockingLock),
        ("export_settings_profile", CommandDbLockPolicy::BlockingLock),
        (
            "export_settings_profile_to_file",
            CommandDbLockPolicy::BlockingLock,
        ),
        ("search_articles", CommandDbLockPolicy::BlockingLock),
        ("get_article", CommandDbLockPolicy::BlockingLock),
        ("list_articles", CommandDbLockPolicy::BlockingLock),
        (
            "list_feed_article_summaries",
            CommandDbLockPolicy::BlockingLock,
        ),
        ("add_account", CommandDbLockPolicy::AsyncCommandBlockingLock),
        (
            "test_account_connection",
            CommandDbLockPolicy::AsyncCommandBlockingLock,
        ),
        ("list_accounts", CommandDbLockPolicy::BlockingLock),
        ("delete_feed", CommandDbLockPolicy::AsyncCommandBlockingLock),
        (
            "trigger_sync",
            CommandDbLockPolicy::AsyncCommandBlockingLock,
        ),
        (
            "trigger_sync_account",
            CommandDbLockPolicy::AsyncCommandBlockingLock,
        ),
        ("open_in_browser", CommandDbLockPolicy::NoDatabaseLock),
        ("discover_feeds", CommandDbLockPolicy::NoDatabaseLock),
        ("check_for_update", CommandDbLockPolicy::NoDatabaseLock),
        ("download_update", CommandDbLockPolicy::NoDatabaseLock),
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
fn parse_browser_http_url_accepts_private_and_loopback_hosts() {
    // Web Preview intentionally does not reject private/loopback hosts (unlike
    // `validate_public_http_url`, which this helper must not call). LAN self-hosted
    // publishers must remain previewable; see docs/feed-content-privacy.md's
    // "Web Preview Navigation Contract".
    for url in ["http://127.0.0.1/", "http://localhost/"] {
        let parsed = parse_browser_http_url(url)
            .unwrap_or_else(|_| panic!("{url} should be accepted by parse_browser_http_url"));

        assert_eq!(parsed.as_str(), url);
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
