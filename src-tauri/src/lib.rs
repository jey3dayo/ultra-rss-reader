pub mod browser_webview;
pub mod cli;
pub mod commands;
pub mod domain;
pub mod infra;
pub mod menu;
pub mod menu_i18n;
pub mod platform;
pub mod repository;
pub mod service;

#[cfg(not(test))]
use std::sync::atomic::{AtomicBool, Ordering};
#[cfg(not(test))]
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[cfg(not(test))]
use commands::updater_commands::PendingUpdate;

#[cfg(not(test))]
use commands::AppState;
#[cfg(not(test))]
use infra::db::connection::DbManager;
#[cfg(not(test))]
use infra::db::sqlite_preference::SqlitePreferenceRepository;
#[cfg(not(test))]
use repository::preference::PreferenceRepository;
#[cfg(not(test))]
use tauri::Manager;

#[cfg(not(test))]
const SHUTDOWN_DRAIN_TIMEOUT: Duration = Duration::from_secs(5);
const SHUTDOWN_DRAIN_POLL_INTERVAL: Duration = Duration::from_millis(25);
#[cfg(not(test))]
const MAIN_WINDOW_CLOSE_BLOCKED_EVENT: &str = "main-window-close-blocked";
/// Only the size is persisted.
///
/// `POSITION` would let a saved geometry reopen the window on a disconnected
/// monitor or at negative coordinates, and `FULLSCREEN` would reopen fullscreen
/// on a display that no longer exists, so both stay off and the window keeps its
/// centered placement.
///
/// `MAXIMIZED` is excluded because the restored maximized state is not readable
/// from the window while the size guards run: the platform has not committed the
/// restored frame yet, so `is_maximized` reports `false` and the guards would
/// un-maximize the window. The plugin also skips recording the size while the
/// window is maximized or minimized, so quitting maximized reopens at the last
/// non-maximized size rather than at the size the maximized window covered.
#[cfg(all(desktop, not(test)))]
const MAIN_WINDOW_STATE_FLAGS: tauri_plugin_window_state::StateFlags =
    tauri_plugin_window_state::StateFlags::SIZE;
const MAIN_WINDOW_MIN_WIDTH: u64 = 520;
const MAIN_WINDOW_MIN_HEIGHT: u64 = 420;
const RELEASE_LOG_MAX_FILE_SIZE_BYTES: u128 = 5_000_000;
const RELEASE_LOG_RETENTION_DAYS: u64 = 7;
#[cfg(test)]
const RELEASE_LOG_ROTATION_STRATEGY: &str = "KeepAll";
#[cfg(test)]
const RELEASE_LOG_TIMEZONE_STRATEGY: &str = "UseLocal";

mod startup;

#[cfg(not(test))]
use startup::focus::*;
use startup::lifecycle::*;
use startup::logs::*;
use startup::messages::*;
use startup::redaction::*;
use startup::window::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg(not(test))]
pub fn run() {
    #[cfg(debug_assertions)]
    {
        let _ = init_debug_tracing_subscriber();
    }
    install_redacting_panic_hook();

    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        focus_main_webview_on_second_launch(app);
    }));

    // The main window is restored explicitly in `setup` so the size guards and
    // re-centering run before the window is shown, instead of racing the
    // plugin's own on-ready restore.
    #[cfg(desktop)]
    let builder = builder.plugin(
        tauri_plugin_window_state::Builder::default()
            .with_state_flags(MAIN_WINDOW_STATE_FLAGS)
            .skip_initial_state("main")
            .build(),
    );

    #[cfg(all(debug_assertions, feature = "mcp-bridge"))]
    let builder = builder.plugin(
        tauri_plugin_mcp_bridge::Builder::new()
            .bind_address("127.0.0.1")
            .build(),
    );

    let builder = builder.plugin(
        tauri_plugin_log::Builder::new()
            .target(tauri_plugin_log::Target::new(
                tauri_plugin_log::TargetKind::LogDir {
                    file_name: Some("app".into()),
                },
            ))
            .max_file_size(RELEASE_LOG_MAX_FILE_SIZE_BYTES)
            .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
            .level(log::LevelFilter::Info)
            .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
            .build(),
    );

    builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let tauri::WindowEvent::Resized(size) = event {
                enforce_main_window_min_size_after_window_resize(window, *size);
            }
        })
        .setup(|app| {
            // Initialize database first so preferences are available for menu construction
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| startup_app_data_dir_error_message(&error))?;
            std::fs::create_dir_all(&app_data_dir).map_err(|error| {
                startup_app_data_dir_create_error_message(&app_data_dir, &error)
            })?;
            crate::infra::keyring_store::storage_mode::init(&app_data_dir);
            let db_path = app_data_dir.join("ultra-rss-reader.db");
            let db = match DbManager::new(&db_path) {
                Ok(db) => db,
                Err(e) => {
                    tracing::error!("Database initialization failed: {e}");
                    return Err(database_init_startup_error_message(&e, &db_path).into());
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

            let startup_focus_restore_active = Arc::new(AtomicBool::new(true));
            if let Some(window) = app.get_webview_window("main") {
                window
                    .set_title(" ")
                    .expect("Failed to clear main window title");
                window
                    .set_title_bar_style(main_window_title_bar_style())
                    .expect("Failed to configure main window title bar style");
                window
                    .set_min_size(Some(main_window_min_size()))
                    .expect("Failed to configure main window minimum size");

                #[cfg(desktop)]
                {
                    use tauri_plugin_window_state::WindowExt;

                    if let Err(error) = window
                        .as_ref()
                        .window()
                        .restore_state(MAIN_WINDOW_STATE_FLAGS)
                    {
                        tracing::warn!("Failed to restore main window state: {error}");
                    }
                    // The size guards run from the delayed startup task instead of
                    // here: the restored resize is queued on the event loop, so a
                    // size read back inside `setup` still reports the configured
                    // default.
                }

                let startup_focus_restore_active_for_window = startup_focus_restore_active.clone();
                window.on_window_event(move |event| match event {
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        let Some(state) = handle.try_state::<AppState>() else {
                            return;
                        };
                        let sync_in_flight = state.syncing.load(Ordering::SeqCst);
                        let update_download_in_flight =
                            commands::updater_commands::is_update_download_in_flight();
                        match main_window_close_decision(
                            state.shutdown_draining.load(Ordering::SeqCst),
                            sync_in_flight,
                            update_download_in_flight,
                        ) {
                            MainWindowCloseDecision::StartShutdownDrain => {
                                if state
                                    .shutdown_draining
                                    .compare_exchange(
                                        false,
                                        true,
                                        Ordering::SeqCst,
                                        Ordering::SeqCst,
                                    )
                                    .is_err()
                                {
                                    api.prevent_close();
                                    return;
                                }
                            }
                            MainWindowCloseDecision::BlockNativeOperationInFlight => {
                                api.prevent_close();
                                emit_main_window_close_blocked(&handle);
                                return;
                            }
                            MainWindowCloseDecision::IgnoreAlreadyDraining => {
                                api.prevent_close();
                                return;
                            }
                        }
                        service::sync_scheduler::request_sync_scheduler_shutdown();
                        mark_startup_focus_restore_stopped(
                            &startup_focus_restore_active_for_window,
                        );
                        api.prevent_close();
                        let app_handle = handle.clone();
                        tauri::async_runtime::spawn(async move {
                            let browser_drained =
                                browser_webview::cleanup_browser_webview_for_shutdown(&app_handle);
                            let sync_drained =
                                service::sync_scheduler::drain_sync_scheduler_shutdown(
                                    SHUTDOWN_DRAIN_TIMEOUT,
                                )
                                .await;
                            let db_drained = if let Some(state) = app_handle.try_state::<AppState>()
                            {
                                drain_database_shutdown(state.inner(), SHUTDOWN_DRAIN_TIMEOUT).await
                            } else {
                                false
                            };
                            if !(browser_drained && sync_drained && db_drained) {
                                tracing::warn!(
                                    browser_drained,
                                    sync_drained,
                                    db_drained,
                                    "App shutdown forced before all runtime drains completed"
                                );
                            }
                            // The custom drain path prevents the default close,
                            // so persist the window size here instead of
                            // relying only on the plugin's exit hook.
                            #[cfg(desktop)]
                            {
                                use tauri_plugin_window_state::AppHandleExt;

                                if let Err(error) =
                                    app_handle.save_window_state(MAIN_WINDOW_STATE_FLAGS)
                                {
                                    tracing::warn!("Failed to save main window state: {error}");
                                }
                            }
                            app_handle.exit(0);
                        });
                    }
                    tauri::WindowEvent::Destroyed => {
                        service::sync_scheduler::request_sync_scheduler_shutdown();
                        mark_startup_focus_restore_stopped(
                            &startup_focus_restore_active_for_window,
                        );
                    }
                    _ => {}
                });
            }

            focus_main_webview_on_startup(app.handle().clone(), startup_focus_restore_active);

            app.manage(AppState {
                db: Mutex::new(db),
                syncing: Arc::new(AtomicBool::new(false)),
                shutdown_draining: Arc::new(AtomicBool::new(false)),
                automatic_sync_enabled: Arc::new(AtomicBool::new(false)),
                automatic_sync_notify: Arc::new(tokio::sync::Notify::new()),
                browser_webview: Mutex::new(browser_webview::BrowserWebviewTracker::default()),
            });
            app.manage(PendingUpdate::default());

            // Start background periodic sync
            let state = app.state::<AppState>();
            service::sync_scheduler::start_sync_scheduler(&state.db, app.handle().clone());

            if let Ok(log_dir) = app.path().app_log_dir() {
                cleanup_startup_logs(&log_dir);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::account_commands::list_accounts,
            commands::account_commands::get_account_cloudflare_access,
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
            commands::sync_commands::get_local_feed_sync_statuses,
            commands::sync_commands::trigger_sync_account,
            commands::sync_commands::trigger_sync_feed,
            commands::sync_commands::trigger_automatic_sync,
            commands::article_commands::get_article,
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
            commands::opml_commands::export_opml_to_file,
            commands::article_commands::search_articles,
            commands::mute_keyword_commands::list_mute_keywords,
            commands::mute_keyword_commands::create_mute_keyword,
            commands::mute_keyword_commands::update_mute_keyword,
            commands::mute_keyword_commands::delete_mute_keyword,
            commands::mute_keyword_commands::set_mute_auto_mark_read,
            commands::local_account_sync_commands::get_local_account_sync_settings,
            commands::local_account_sync_commands::set_local_account_sync_settings,
            commands::local_account_sync_commands::export_local_account_sync_operations,
            commands::local_account_sync_commands::import_local_account_sync_operations,
            commands::preference_commands::get_preferences,
            commands::preference_commands::set_preference,
            commands::settings_profile_commands::export_settings_profile,
            commands::settings_profile_commands::export_settings_profile_to_file,
            commands::settings_profile_commands::import_settings_profile,
            commands::tag_commands::list_tags,
            commands::tag_commands::create_tag,
            commands::tag_commands::rename_tag,
            commands::tag_commands::delete_tag,
            commands::tag_commands::create_tag_and_assign_article,
            commands::tag_commands::tag_article,
            commands::tag_commands::untag_article,
            commands::tag_commands::get_article_tags,
            commands::tag_commands::list_articles_by_tag,
            commands::tag_commands::get_tag_article_counts,
            commands::share_commands::copy_to_clipboard,
            commands::share_commands::add_to_reading_list,
            commands::platform_commands::get_platform_info,
            commands::platform_commands::get_dev_runtime_options,
            commands::platform_commands::get_platform_permission_denied_recovery,
            commands::platform_commands::reset_oversized_dev_credentials_store,
            commands::credential_storage_commands::get_credential_storage,
            commands::credential_storage_commands::set_credential_storage,
            commands::updater_commands::check_for_update,
            commands::updater_commands::download_update,
            commands::updater_commands::restart_app,
            commands::database_commands::get_database_info,
            commands::database_commands::vacuum_database,
            commands::database_commands::backup_database,
            commands::log_commands::open_log_dir,
            commands::log_commands::record_read_diagnostics_batch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests;
