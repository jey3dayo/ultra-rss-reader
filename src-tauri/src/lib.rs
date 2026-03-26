pub mod commands;
pub mod domain;
pub mod infra;
pub mod repository;
pub mod service;

use std::sync::Mutex;

use commands::AppState;
use infra::db::connection::DbManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");
            let db_path = app_data_dir.join("ultra-rss-reader.db");
            let db = DbManager::new(&db_path).expect("Failed to initialize database");
            app.manage(AppState { db: Mutex::new(db) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::account_commands::list_accounts,
            commands::account_commands::add_account,
            commands::account_commands::delete_account,
            commands::feed_commands::list_feeds,
            commands::feed_commands::add_local_feed,
            commands::feed_commands::trigger_sync,
            commands::article_commands::list_articles,
            commands::article_commands::mark_article_read,
            commands::article_commands::toggle_article_star,
            commands::article_commands::open_in_browser,
            commands::opml_commands::import_opml,
            commands::article_commands::search_articles,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
