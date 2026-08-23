mod account_sync;
mod local_import_export;
mod manual;
mod progress;
mod scheduler;

pub(crate) use progress::{
    should_emit_sync_succeeded, should_emit_sync_warning, should_purge_old_articles_after_sync,
    SyncProgressReporter, SYNC_COMPLETED_EVENT, SYNC_SUCCEEDED_EVENT, SYNC_WARNING_EVENT,
};

pub use account_sync::run_full_sync;
pub(crate) use account_sync::sync_account;
#[cfg(test)]
pub(crate) use account_sync::sync_feed;

#[cfg(not(test))]
pub(crate) use manual::{
    __cmd__get_account_sync_status, __cmd__trigger_sync, __cmd__trigger_sync_account,
    __cmd__trigger_sync_feed, __tauri_command_name_get_account_sync_status,
    __tauri_command_name_trigger_sync, __tauri_command_name_trigger_sync_account,
    __tauri_command_name_trigger_sync_feed,
};
#[cfg(not(test))]
pub(crate) use scheduler::{
    __cmd__trigger_automatic_sync, __cmd__trigger_startup_sync,
    __tauri_command_name_trigger_automatic_sync, __tauri_command_name_trigger_startup_sync,
};

#[cfg(test)]
use crate::commands::dto::{
    AccountSyncError, AccountSyncWarning, AccountSyncWarningDetail, AccountSyncWarningKind,
    SyncResult,
};
#[cfg(test)]
use crate::domain::account::Account;
#[cfg(test)]
use crate::domain::types::FeedId;
#[cfg(test)]
use crate::infra::db::connection::DbManager;
#[cfg(test)]
use crate::infra::db::sqlite_local_account_sync_settings::SqliteLocalAccountSyncSettingsRepository;
#[cfg(test)]
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
#[cfg(test)]
use crate::repository::local_account_sync_settings::LocalAccountSyncSettingsRepository;
#[cfg(test)]
use crate::repository::sync_state::SyncState;
#[cfg(test)]
use crate::repository::sync_state::SyncStateRepository;
#[cfg(test)]
use crate::repository::sync_state::SyncStateScopeKey;
#[cfg(test)]
use account_sync::{
    run_local_account_startup_import_supplement, run_startup_sync_and_repair,
    run_sync_for_accounts_with_progress,
};
pub use manual::{get_account_sync_status, trigger_sync, trigger_sync_account, trigger_sync_feed};
#[cfg(test)]
use progress::{
    next_sync_progress_completed, next_sync_progress_session_id,
    should_emit_manual_single_sync_completion, sync_event_emit_warning, SyncGuard,
    SYNC_PROGRESS_SESSION_ID,
};
#[cfg(test)]
use scheduler::{
    clear_scheduler_sync_status, enable_automatic_sync, map_account_sync_status,
    prioritize_startup_sync_accounts, record_startup_remote_state_repair_complete,
    should_enable_automatic_sync_after_startup, startup_remote_state_repair_succeeded,
};
pub use scheduler::{
    purge_old_articles, run_automatic_sync, trigger_automatic_sync, trigger_startup_sync,
};
#[cfg(test)]
mod tests;
