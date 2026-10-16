use std::path::Path;

use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crate::domain::error::DomainError;
use crate::{
    centered_main_window_physical_position, clamped_main_window_physical_inner_size,
    cleanup_old_logs, cleanup_old_logs_entry_debug, cleanup_old_logs_metadata_debug,
    cleanup_old_logs_modified_debug, cleanup_old_logs_read_dir_warning,
    cleanup_old_logs_remove_warning, cleanup_startup_logs, database_init_error_message,
    database_init_startup_error_message, drain_mutex_lock_for_shutdown, main_window_close_decision,
    main_window_title_bar_uses_overlay, mark_startup_focus_restore_stopped, panic_payload_text,
    redact_sensitive_panic_text, redacted_path_label, second_launch_decision,
    startup_app_data_dir_create_error_message, startup_app_data_dir_error_message,
    startup_focus_main_thread_warning, startup_focus_restore_decision,
    startup_focus_restore_is_active, startup_main_webview_focus_warning,
    startup_main_window_focus_warning, startup_main_window_show_warning,
    startup_preferences_or_default, startup_preferences_read_warning_message, tracing_init_status,
    MainWindowCloseDecision, SecondLaunchDecision, StartupFocusRestoreDecision, TracingInitStatus,
    MAIN_WINDOW_MIN_HEIGHT, MAIN_WINDOW_MIN_WIDTH, RELEASE_LOG_MAX_FILE_SIZE_BYTES,
    RELEASE_LOG_RETENTION_DAYS, RELEASE_LOG_ROTATION_STRATEGY, RELEASE_LOG_TIMEZONE_STRATEGY,
};

mod docs_contracts;
mod preferences_logs_focus;
mod shutdown_and_runtime;
mod startup_messages;
mod window_geometry;
