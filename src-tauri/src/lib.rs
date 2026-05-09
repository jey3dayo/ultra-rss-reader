pub mod browser_webview;
pub mod commands;
pub mod domain;
pub mod infra;
pub mod menu;
pub mod menu_i18n;
pub mod platform;
pub mod repository;
pub mod service;

use std::collections::HashMap;
#[cfg(not(test))]
use std::sync::atomic::AtomicBool;
#[cfg(not(test))]
use std::sync::{Arc, Mutex};
#[cfg(not(test))]
use std::time::Duration;

#[cfg(not(test))]
use commands::updater_commands::PendingUpdate;

#[cfg(not(test))]
use commands::AppState;
use domain::error::DomainError;
#[cfg(not(test))]
use infra::db::connection::DbManager;
#[cfg(not(test))]
use infra::db::sqlite_preference::SqlitePreferenceRepository;
#[cfg(not(test))]
use repository::preference::PreferenceRepository;
#[cfg(not(test))]
use tauri::Manager;

fn main_window_title_bar_uses_overlay() -> bool {
    cfg!(target_os = "macos")
}

#[cfg(not(test))]
fn main_window_title_bar_style() -> tauri::TitleBarStyle {
    if main_window_title_bar_uses_overlay() {
        tauri::TitleBarStyle::Overlay
    } else {
        tauri::TitleBarStyle::Visible
    }
}

fn database_init_error_message(error: &DomainError, db_path: &std::path::Path) -> String {
    let backups_dir = db_path
        .parent()
        .map(|p| p.join("backups"))
        .unwrap_or_default();
    match error {
        DomainError::Migration(_) => format!(
            "Failed to initialize database: {error}\n\
             Database path: {}\n\
             Backup directory: {}\n\
             The database may already have been restored automatically. Do not delete the database file.\n\
             If the application still does not start, close it and restore the newest backup from the backup directory to the database path.\n\
             Please update the application or contact support.",
            db_path.display(),
            backups_dir.display()
        ),
        _ => format!(
            "Failed to initialize database: {error}\n\
             Database path: {}\n\
             If the problem persists, try deleting the database file and restarting.",
            db_path.display()
        ),
    }
}

fn startup_preferences_or_default(
    result: Result<HashMap<String, String>, DomainError>,
) -> HashMap<String, String> {
    match result {
        Ok(prefs) => prefs,
        Err(error) => {
            tracing::warn!("{}", startup_preferences_read_warning_message(&error));
            HashMap::new()
        }
    }
}

fn startup_preferences_read_warning_message(error: &DomainError) -> String {
    format!(
        "Failed to read startup preferences; using default menu state and diagnostics settings: {error}"
    )
}

fn startup_main_window_show_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to show main window during startup focus restore: {error}")
}

fn startup_main_window_focus_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to focus main window during startup focus restore: {error}")
}

fn startup_main_webview_focus_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to focus main webview during startup focus restore: {error}")
}

fn startup_focus_main_thread_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to schedule startup focus restore on the main thread: {error}")
}

#[cfg(not(test))]
fn focus_main_webview_on_startup<R: tauri::Runtime>(app_handle: tauri::AppHandle<R>) {
    tauri::async_runtime::spawn(async move {
        // On macOS overlay titlebar windows, the native webview can start unfocused
        // even though the app window is visible. Delay one tick so the window is
        // fully realized before restoring focus.
        tokio::time::sleep(Duration::from_millis(150)).await;

        let app_handle_for_main_thread = app_handle.clone();
        if let Err(error) = app_handle.run_on_main_thread(move || {
            if let Some(window) = app_handle_for_main_thread.get_webview_window("main") {
                if let Err(error) = window.show() {
                    tracing::warn!("{}", startup_main_window_show_warning(&error));
                }
                if let Err(error) = window.set_focus() {
                    tracing::warn!("{}", startup_main_window_focus_warning(&error));
                }
            }

            if let Some(webview) = app_handle_for_main_thread.get_webview("main") {
                if let Err(error) = webview.set_focus() {
                    tracing::warn!("{}", startup_main_webview_focus_warning(&error));
                }
            }
        }) {
            tracing::warn!("{}", startup_focus_main_thread_warning(&error));
        }
    });
}

#[cfg(any(not(debug_assertions), test))]
fn cleanup_old_logs(log_dir: &std::path::Path, max_age_days: u64) {
    use std::time::{Duration, SystemTime};

    let cutoff = match SystemTime::now().checked_sub(Duration::from_secs(max_age_days * 86400)) {
        Some(t) => t,
        None => return,
    };
    let entries = match std::fs::read_dir(log_dir) {
        Ok(e) => e,
        Err(error) => {
            tracing::warn!("{}", cleanup_old_logs_read_dir_warning(log_dir, &error));
            return;
        }
    };
    for entry_result in entries {
        let entry = match entry_result {
            Ok(entry) => entry,
            Err(error) => {
                tracing::debug!(
                    "Failed to inspect log directory entry in {}: {error}",
                    log_dir.display()
                );
                continue;
            }
        };
        let path = entry.path();
        if path.file_name().is_some_and(|name| name == "app.log") {
            continue;
        }
        let meta = match entry.metadata() {
            Ok(meta) => meta,
            Err(error) => {
                tracing::debug!("{}", cleanup_old_logs_metadata_debug(&path, &error));
                continue;
            }
        };
        if !meta.is_file() {
            continue;
        }
        let modified = match meta.modified() {
            Ok(modified) => modified,
            Err(error) => {
                tracing::debug!(
                    "Failed to read log file modified time for {}: {error}",
                    path.display()
                );
                continue;
            }
        };
        if modified < cutoff {
            if let Err(error) = std::fs::remove_file(&path) {
                tracing::warn!("{}", cleanup_old_logs_remove_warning(&path, &error));
            }
        }
    }
}

#[cfg(any(not(debug_assertions), test))]
fn cleanup_old_logs_read_dir_warning(log_dir: &std::path::Path, error: &std::io::Error) -> String {
    format!(
        "Failed to read log directory {} during cleanup: {error}",
        log_dir.display()
    )
}

#[cfg(any(not(debug_assertions), test))]
fn cleanup_old_logs_metadata_debug(path: &std::path::Path, error: &std::io::Error) -> String {
    format!(
        "Failed to read log file metadata for {}: {error}",
        path.display()
    )
}

#[cfg(any(not(debug_assertions), test))]
fn cleanup_old_logs_remove_warning(path: &std::path::Path, error: &std::io::Error) -> String {
    format!("Failed to remove old log file {}: {error}", path.display())
}

#[cfg(not(test))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(debug_assertions)]
    {
        tracing_subscriber::fmt()
            .with_env_filter(
                tracing_subscriber::EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("warn")),
            )
            .init();
    }

    let builder = tauri::Builder::default();

    #[cfg(debug_assertions)]
    let builder = builder.plugin(
        tauri_plugin_mcp_bridge::Builder::new()
            .bind_address("127.0.0.1")
            .build(),
    );

    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(
        tauri_plugin_log::Builder::new()
            .target(tauri_plugin_log::Target::new(
                tauri_plugin_log::TargetKind::LogDir {
                    file_name: Some("app".into()),
                },
            ))
            .max_file_size(5_000_000) // ~5 MB
            .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
            .level(log::LevelFilter::Info)
            .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
            .build(),
    );

    builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Initialize database first so preferences are available for menu construction
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");
            let db_path = app_data_dir.join("ultra-rss-reader.db");
            let db = match DbManager::new(&db_path) {
                Ok(db) => db,
                Err(e) => {
                    tracing::error!("Database initialization failed: {e}");
                    panic!("{}", database_init_error_message(&e, &db_path));
                }
            };

            // Read initial preferences for menu CheckMenuItem states
            let prefs = {
                let repo = SqlitePreferenceRepository::new(db.reader());
                startup_preferences_or_default(repo.get_all())
            };

            browser_webview::set_browser_webview_diagnostics_enabled(
                prefs
                    .get("debug_browser_hud")
                    .is_some_and(|value| value == "true"),
            );

            let handle = app.handle().clone();
            menu::rebuild(&handle, &prefs)?;
            app.on_menu_event(move |app_handle, event| {
                menu::handle_event(app_handle, event);
            });

            if let Some(window) = app.get_webview_window("main") {
                window
                    .set_title(" ")
                    .expect("Failed to clear main window title");
                window
                    .set_title_bar_style(main_window_title_bar_style())
                    .expect("Failed to configure main window title bar style");
            }

            focus_main_webview_on_startup(app.handle().clone());

            app.manage(AppState {
                db: Mutex::new(db),
                syncing: Arc::new(AtomicBool::new(false)),
                automatic_sync_enabled: Arc::new(AtomicBool::new(false)),
                automatic_sync_notify: Arc::new(tokio::sync::Notify::new()),
                browser_webview: Mutex::new(browser_webview::BrowserWebviewTracker::default()),
            });
            app.manage(PendingUpdate(Arc::new(tokio::sync::Mutex::new(None))));

            // Start background periodic sync
            let state = app.state::<AppState>();
            service::sync_scheduler::start_sync_scheduler(&state.db, app.handle().clone());

            // Clean up old log files (release only)
            #[cfg(not(debug_assertions))]
            {
                if let Ok(log_dir) = app.path().app_log_dir() {
                    cleanup_old_logs(&log_dir, 7);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::account_commands::list_accounts,
            commands::account_commands::add_account,
            commands::account_commands::update_account_sync,
            commands::account_commands::update_account_credentials,
            commands::account_commands::rename_account,
            commands::account_commands::test_account_connection,
            commands::account_commands::delete_account,
            commands::feed_commands::list_folders,
            commands::feed_commands::create_folder,
            commands::feed_commands::list_feeds,
            commands::feed_commands::add_local_feed,
            commands::feed_commands::delete_feed,
            commands::feed_commands::rename_feed,
            commands::feed_commands::update_feed_folder,
            commands::feed_commands::update_feed_display_settings,
            commands::feed_commands::discover_feeds,
            commands::sync_commands::trigger_sync,
            commands::sync_commands::trigger_startup_sync,
            commands::sync_commands::get_account_sync_status,
            commands::sync_commands::trigger_sync_account,
            commands::sync_commands::trigger_sync_feed,
            commands::sync_commands::trigger_automatic_sync,
            commands::article_commands::list_articles,
            commands::article_commands::list_account_articles,
            commands::article_commands::list_feed_article_summaries,
            commands::article_commands::list_folder_articles,
            commands::article_commands::list_starred_articles,
            commands::article_commands::list_recent_articles,
            commands::article_commands::count_account_unread_articles,
            commands::article_commands::count_account_starred_articles,
            commands::article_commands::mark_account_read,
            commands::article_commands::mark_account_starred_read,
            commands::article_commands::count_old_unread_articles,
            commands::article_commands::mark_old_unread_read,
            commands::article_commands::unstar_account_articles,
            commands::article_commands::get_feed_integrity_report,
            commands::article_commands::cleanup_feed_integrity_orphans,
            commands::article_commands::mark_article_read,
            commands::article_commands::record_article_view,
            commands::article_commands::clear_article_view_history,
            commands::article_commands::mark_articles_read,
            commands::article_commands::mark_feed_read,
            commands::article_commands::mark_folder_read,
            commands::article_commands::toggle_article_star,
            commands::article_commands::open_in_browser,
            commands::article_commands::check_browser_embed_support,
            commands::browser_webview_commands::create_or_update_browser_webview,
            commands::browser_webview_commands::set_browser_webview_bounds,
            commands::browser_webview_commands::focus_browser_webview,
            commands::browser_webview_commands::go_back_browser_webview,
            commands::browser_webview_commands::go_forward_browser_webview,
            commands::browser_webview_commands::reload_browser_webview,
            commands::browser_webview_commands::close_browser_webview,
            commands::opml_commands::import_opml,
            commands::opml_commands::export_opml,
            commands::article_commands::search_articles,
            commands::mute_keyword_commands::list_mute_keywords,
            commands::mute_keyword_commands::create_mute_keyword,
            commands::mute_keyword_commands::update_mute_keyword,
            commands::mute_keyword_commands::delete_mute_keyword,
            commands::mute_keyword_commands::set_mute_auto_mark_read,
            commands::preference_commands::get_preferences,
            commands::preference_commands::set_preference,
            commands::tag_commands::list_tags,
            commands::tag_commands::create_tag,
            commands::tag_commands::rename_tag,
            commands::tag_commands::delete_tag,
            commands::tag_commands::tag_article,
            commands::tag_commands::untag_article,
            commands::tag_commands::get_article_tags,
            commands::tag_commands::list_articles_by_tag,
            commands::tag_commands::get_tag_article_counts,
            commands::share_commands::copy_to_clipboard,
            commands::share_commands::add_to_reading_list,
            commands::platform_commands::get_platform_info,
            commands::platform_commands::get_dev_runtime_options,
            commands::updater_commands::check_for_update,
            commands::updater_commands::download_and_install_update,
            commands::updater_commands::restart_app,
            commands::database_commands::get_database_info,
            commands::database_commands::vacuum_database,
            commands::log_commands::open_log_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use std::collections::HashMap;

    use super::{
        cleanup_old_logs, cleanup_old_logs_metadata_debug, cleanup_old_logs_read_dir_warning,
        cleanup_old_logs_remove_warning, database_init_error_message,
        main_window_title_bar_uses_overlay, startup_focus_main_thread_warning,
        startup_main_webview_focus_warning, startup_main_window_focus_warning,
        startup_main_window_show_warning, startup_preferences_or_default,
        startup_preferences_read_warning_message,
    };
    use crate::domain::error::DomainError;

    #[test]
    fn migration_error_message_does_not_suggest_deleting_restored_database() {
        let message = database_init_error_message(
            &DomainError::Migration(
                "Migration to v5 failed: duplicate column. Database restored to v4.".to_string(),
            ),
            Path::new("/tmp/ultra-rss-reader.db"),
        );

        assert!(
            !message.contains("try deleting the database file"),
            "migration recovery message should not suggest deleting the restored database: {message}"
        );
    }

    #[test]
    fn migration_error_message_includes_restore_steps() {
        let message = database_init_error_message(
            &DomainError::Migration(
                "Migration to v5 failed: duplicate column. Database restored to v4.".to_string(),
            ),
            Path::new("/tmp/ultra-rss-reader.db"),
        );

        assert!(
            message.contains("restore the newest backup"),
            "migration recovery message should explain how to restore manually: {message}"
        );
    }

    #[test]
    fn non_migration_error_message_keeps_database_deletion_guidance() {
        let message = database_init_error_message(
            &DomainError::Persistence("database is locked".to_string()),
            Path::new("/tmp/ultra-rss-reader.db"),
        );

        assert!(
            message.contains("try deleting the database file"),
            "non-migration init errors should keep the existing recovery guidance: {message}"
        );
    }

    #[test]
    fn startup_preferences_keep_loaded_values() {
        let prefs = startup_preferences_or_default(Ok(HashMap::from([(
            "debug_browser_hud".to_string(),
            "true".to_string(),
        )])));

        assert_eq!(
            prefs.get("debug_browser_hud").map(String::as_str),
            Some("true")
        );
    }

    #[test]
    fn startup_preferences_fall_back_to_defaults_on_read_error() {
        let error = DomainError::Persistence("database is locked".to_string());
        let warning = startup_preferences_read_warning_message(&error);
        let prefs = startup_preferences_or_default(Err(error));

        assert!(
            prefs.is_empty(),
            "startup should continue with default menu state and diagnostics settings"
        );
        assert!(warning.contains("Failed to read startup preferences"));
        assert!(warning.contains("using default menu state and diagnostics settings"));
        assert!(warning.contains("database is locked"));
    }

    #[test]
    fn cleanup_old_logs_read_dir_failure_keeps_cleanup_non_fatal() {
        let missing_dir = Path::new("/tmp/ultra-rss-reader-missing-log-dir");

        cleanup_old_logs(missing_dir, 7);
    }

    #[test]
    fn cleanup_old_logs_observability_messages_include_path_and_reason() {
        let read_dir_error = std::io::Error::new(std::io::ErrorKind::NotFound, "missing directory");
        let metadata_error =
            std::io::Error::new(std::io::ErrorKind::PermissionDenied, "metadata denied");
        let remove_error =
            std::io::Error::new(std::io::ErrorKind::PermissionDenied, "remove denied");

        let read_dir_warning =
            cleanup_old_logs_read_dir_warning(Path::new("/tmp/logs"), &read_dir_error);
        let metadata_debug =
            cleanup_old_logs_metadata_debug(Path::new("/tmp/logs/old.log"), &metadata_error);
        let remove_warning =
            cleanup_old_logs_remove_warning(Path::new("/tmp/logs/old.log"), &remove_error);

        assert!(read_dir_warning.contains("/tmp/logs"));
        assert!(read_dir_warning.contains("missing directory"));
        assert!(metadata_debug.contains("/tmp/logs/old.log"));
        assert!(metadata_debug.contains("metadata denied"));
        assert!(remove_warning.contains("/tmp/logs/old.log"));
        assert!(remove_warning.contains("remove denied"));
    }

    #[test]
    fn startup_focus_restore_failures_are_diagnostics_only() {
        let show_error = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "show denied");
        let window_focus_error =
            std::io::Error::new(std::io::ErrorKind::PermissionDenied, "window focus denied");
        let webview_focus_error =
            std::io::Error::new(std::io::ErrorKind::PermissionDenied, "webview focus denied");
        let schedule_error = std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "main thread unavailable",
        );

        let show_warning = startup_main_window_show_warning(&show_error);
        let window_focus_warning = startup_main_window_focus_warning(&window_focus_error);
        let webview_focus_warning = startup_main_webview_focus_warning(&webview_focus_error);
        let schedule_warning = startup_focus_main_thread_warning(&schedule_error);

        assert!(show_warning.contains("Failed to show main window"));
        assert!(show_warning.contains("startup focus restore"));
        assert!(show_warning.contains("show denied"));
        assert!(window_focus_warning.contains("Failed to focus main window"));
        assert!(window_focus_warning.contains("window focus denied"));
        assert!(webview_focus_warning.contains("Failed to focus main webview"));
        assert!(webview_focus_warning.contains("webview focus denied"));
        assert!(schedule_warning.contains("Failed to schedule startup focus restore"));
        assert!(schedule_warning.contains("main thread unavailable"));
    }

    #[test]
    fn main_window_title_bar_overlay_flag_matches_platform_expectation() {
        assert_eq!(
            main_window_title_bar_uses_overlay(),
            cfg!(target_os = "macos")
        );
    }
}
