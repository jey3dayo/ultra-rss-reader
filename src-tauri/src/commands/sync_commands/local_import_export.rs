use std::path::PathBuf;
use std::sync::Mutex;

use crate::commands::dto::{AccountSyncWarningDetail, AccountSyncWarningKind, AppError};
use crate::commands::feed_commands::lock_db;
use crate::commands::sync_providers::ProviderSyncWarning;
use crate::domain::feed::Feed;
use crate::domain::types::AccountId;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_local_account_sync_settings::SqliteLocalAccountSyncSettingsRepository;
use crate::infra::provider::local::LocalProvider;
use crate::repository::local_account_sync_settings::LocalAccountSyncSettingsRepository;
use crate::service::local_account_sync::{
    export_local_account_sync_folder_if_changed, import_local_account_sync_folder,
    LocalAccountSyncImportReport,
};

#[cfg(not(test))]
pub(crate) fn local_provider() -> LocalProvider {
    LocalProvider::new()
}

#[cfg(test)]
pub(crate) fn local_provider() -> LocalProvider {
    LocalProvider::new_allowing_private_feed_urls_for_tests()
}

pub(crate) fn local_feed_sync_warning(feed: &Feed, error: &AppError) -> ProviderSyncWarning {
    ProviderSyncWarning {
        kind: AccountSyncWarningKind::Generic,
        message: format!("Local feed '{}' failed during sync: {error}", feed.title),
        retry_at: None,
        retry_in_seconds: None,
        detail: AccountSyncWarningDetail::LocalFeedSyncFailed {
            feed_title: feed.title.clone(),
            message: error.to_string(),
        },
    }
}

pub(crate) fn local_account_sync_error_warning(
    operation: &str,
    error: &AppError,
) -> ProviderSyncWarning {
    ProviderSyncWarning {
        kind: AccountSyncWarningKind::Generic,
        message: format!("Local sync folder {operation} failed: {error}"),
        retry_at: None,
        retry_in_seconds: None,
        detail: AccountSyncWarningDetail::LocalAccountSyncOperationFailed {
            operation: operation.to_string(),
            message: error.to_string(),
        },
    }
}

pub(crate) fn local_account_import_result_warning(
    report: &LocalAccountSyncImportReport,
) -> Option<ProviderSyncWarning> {
    if report.applied
        && report.conflicted_candidates == 0
        && report.rejected_files == 0
        && report.rejected_operations == 0
    {
        return None;
    }
    Some(ProviderSyncWarning {
        kind: AccountSyncWarningKind::Generic,
        message: format!(
            "Local sync folder import found {} conflicted candidate(s), {} rejected file(s), and {} rejected operation(s); use the manual import/export buttons in account settings to resolve them.",
            report.conflicted_candidates, report.rejected_files, report.rejected_operations
        ),
        retry_at: None,
        retry_in_seconds: None,
        detail: AccountSyncWarningDetail::LocalImportResult {
            conflicted: report.conflicted_candidates,
            rejected_files: report.rejected_files,
            rejected_operations: report.rejected_operations,
        },
    })
}

/// Imports any pending operations from the account's local sync folder before
/// the feed pull, so changes made on other devices apply before this device
/// syncs. Silently skips accounts with no settings, disabled sync, or a blank
/// folder path. Runs entirely inside one DB lock, so it is safe to call
/// synchronously from async sync flows.
pub(crate) fn run_local_account_auto_import(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> Option<ProviderSyncWarning> {
    let db_guard = match lock_db(db) {
        Ok(guard) => guard,
        Err(error) => return Some(local_account_sync_error_warning("import", &error)),
    };

    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db_guard.reader());
    let settings = match settings_repo.find_by_account_id(account_id) {
        Ok(Some(settings)) => settings,
        Ok(None) => return None,
        Err(error) => {
            return Some(local_account_sync_error_warning(
                "import",
                &AppError::from(error),
            ))
        }
    };
    if !settings.enabled || settings.sync_folder_path.trim().is_empty() {
        return None;
    }

    match import_local_account_sync_folder(
        &db_guard,
        account_id,
        &settings.sync_account_id,
        &PathBuf::from(&settings.sync_folder_path),
    ) {
        Ok(report) => local_account_import_result_warning(&report),
        Err(error) => Some(local_account_sync_error_warning(
            "import",
            &AppError::from(error),
        )),
    }
}

/// Digest-gated export of the account's current state to its local sync
/// folder after the feed pull. Silently skips accounts with no settings,
/// disabled sync, or a blank folder path, and is a no-op when the projected
/// state is unchanged since the last export. Runs entirely inside one DB
/// lock, so it is safe to call synchronously from async sync flows.
pub(crate) fn run_local_account_auto_export(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> Option<ProviderSyncWarning> {
    let db_guard = match lock_db(db) {
        Ok(guard) => guard,
        Err(error) => return Some(local_account_sync_error_warning("export", &error)),
    };

    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db_guard.reader());
    let settings = match settings_repo.find_by_account_id(account_id) {
        Ok(Some(settings)) => settings,
        Ok(None) => return None,
        Err(error) => {
            return Some(local_account_sync_error_warning(
                "export",
                &AppError::from(error),
            ))
        }
    };
    if !settings.enabled || settings.sync_folder_path.trim().is_empty() {
        return None;
    }

    match export_local_account_sync_folder_if_changed(&db_guard, account_id, &settings) {
        Ok(_) => None,
        Err(error) => Some(local_account_sync_error_warning(
            "export",
            &AppError::from(error),
        )),
    }
}
