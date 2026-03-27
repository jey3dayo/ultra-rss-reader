pub mod commands;
pub mod domain;
pub mod infra;
pub mod repository;
pub mod service;

use std::sync::Mutex;

use commands::AppState;
use infra::db::connection::DbManager;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // App menu with Settings
            let settings_item =
                MenuItemBuilder::with_id("settings", "Settings...\tCtrl+,").build(app)?;

            let app_submenu = SubmenuBuilder::new(app, "Ultra RSS Reader")
                .item(&settings_item)
                .separator()
                .quit()
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_submenu)
                .item(&edit_submenu)
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                let id = event.id().as_ref();
                tracing::info!("Menu event: {}", id);
                if id == "settings" {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        match window.emit("open-settings", ()) {
                            Ok(_) => tracing::info!("Emitted open-settings event"),
                            Err(e) => tracing::error!("Failed to emit: {}", e),
                        }
                    } else {
                        tracing::error!("Could not find main window");
                    }
                }
            });
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");
            let db_path = app_data_dir.join("ultra-rss-reader.db");
            let db = DbManager::new(&db_path).expect("Failed to initialize database");
            app.manage(AppState { db: Mutex::new(db) });

            // Start background periodic sync
            let state = app.state::<AppState>();
            service::sync_scheduler::start_sync_scheduler(&state.db, app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::account_commands::list_accounts,
            commands::account_commands::add_account,
            commands::account_commands::delete_account,
            commands::feed_commands::list_folders,
            commands::feed_commands::list_feeds,
            commands::feed_commands::add_local_feed,
            commands::feed_commands::trigger_sync,
            commands::article_commands::list_articles,
            commands::article_commands::mark_article_read,
            commands::article_commands::toggle_article_star,
            commands::article_commands::open_in_browser,
            commands::opml_commands::import_opml,
            commands::opml_commands::export_opml,
            commands::article_commands::search_articles,
            commands::preference_commands::get_preferences,
            commands::preference_commands::set_preference,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
