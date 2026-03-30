pub mod browser_webview;
pub mod commands;
pub mod domain;
pub mod infra;
pub mod menu;
pub mod platform;
pub mod repository;
pub mod service;

use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use commands::updater_commands::PendingUpdate;

use commands::AppState;
use domain::error::DomainError;
use infra::db::connection::DbManager;
use infra::db::sqlite_preference::SqlitePreferenceRepository;
use repository::preference::PreferenceRepository;
use tauri::Manager;
use tauri::TitleBarStyle;

fn main_window_title_bar_style() -> TitleBarStyle {
    if cfg!(target_os = "macos") {
        TitleBarStyle::Overlay
    } else {
        TitleBarStyle::Visible
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("warn")),
        )
        .init();

    tauri::Builder::default()
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
                repo.get_all().unwrap_or_default()
            };

            let handle = app.handle().clone();
            app.set_menu(menu::build(&handle, &prefs)?)?;
            app.on_menu_event(move |app_handle, event| {
                menu::handle_event(app_handle, event);
            });

            if let Some(window) = app.get_webview_window("main") {
                window
                    .set_title_bar_style(main_window_title_bar_style())
                    .expect("Failed to configure main window title bar style");
            }

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
            commands::feed_commands::update_feed_display_mode,
            commands::feed_commands::discover_feeds,
            commands::sync_commands::trigger_sync,
            commands::sync_commands::trigger_sync_account,
            commands::sync_commands::trigger_automatic_sync,
            commands::article_commands::list_articles,
            commands::article_commands::list_account_articles,
            commands::article_commands::count_account_unread_articles,
            commands::article_commands::mark_article_read,
            commands::article_commands::mark_articles_read,
            commands::article_commands::mark_feed_read,
            commands::article_commands::mark_folder_read,
            commands::article_commands::toggle_article_star,
            commands::article_commands::open_in_browser,
            commands::article_commands::check_browser_embed_support,
            commands::browser_webview_commands::create_or_update_browser_webview,
            commands::browser_webview_commands::set_browser_webview_bounds,
            commands::browser_webview_commands::go_back_browser_webview,
            commands::browser_webview_commands::go_forward_browser_webview,
            commands::browser_webview_commands::reload_browser_webview,
            commands::browser_webview_commands::close_browser_webview,
            commands::opml_commands::import_opml,
            commands::opml_commands::export_opml,
            commands::article_commands::search_articles,
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
            commands::updater_commands::check_for_update,
            commands::updater_commands::download_and_install_update,
            commands::updater_commands::restart_app,
            commands::database_commands::get_database_info,
            commands::database_commands::vacuum_database,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{database_init_error_message, main_window_title_bar_style};
    use crate::domain::error::DomainError;
    use tauri::TitleBarStyle;

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
    fn main_window_title_bar_style_matches_platform_expectation() {
        let expected = if cfg!(target_os = "macos") {
            TitleBarStyle::Overlay
        } else {
            TitleBarStyle::Visible
        };

        assert_eq!(main_window_title_bar_style(), expected);
    }
}
