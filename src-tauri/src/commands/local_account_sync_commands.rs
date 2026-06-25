use std::path::PathBuf;

use serde::Serialize;
use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::domain::account::Account;
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_local_account_sync_settings::SqliteLocalAccountSyncSettingsRepository;
use crate::repository::account::AccountRepository;
use crate::repository::local_account_sync_settings::{
    LocalAccountSyncSettings, LocalAccountSyncSettingsRepository,
};
use crate::service::local_account_sync::{
    export_local_account_sync_folder, import_local_account_sync_folder,
};

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct LocalAccountSyncSettingsDto {
    pub account_id: String,
    pub sync_folder_path: String,
    pub sync_account_id: String,
    pub device_id: String,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct LocalAccountSyncImportReportDto {
    pub loaded_operations: usize,
    pub applied_operations: usize,
    pub rejected_operations: usize,
    pub rejected_files: usize,
    pub conflicted_candidates: usize,
    pub applied: bool,
    pub folders_upserted: usize,
    pub feeds_upserted: usize,
    pub article_states_applied: usize,
    pub tags_upserted: usize,
    pub article_tags_added: usize,
    pub article_tags_removed: usize,
    pub mute_keywords_upserted: usize,
    pub mute_keywords_removed: usize,
    pub unmatched_article_keys: usize,
    pub skipped_removed_tags: usize,
    pub conflict_count: usize,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct LocalAccountSyncExportReportDto {
    pub operations_written: usize,
}

pub(crate) fn ensure_local_account(account: &Account) -> Result<(), AppError> {
    if matches!(account.kind, ProviderKind::Local) {
        Ok(())
    } else {
        Err(AppError::UserVisible {
            message: "Local account sync folders are only available for Local accounts".to_string(),
        })
    }
}

fn normalize_sync_folder_path(path: String) -> Result<String, AppError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppError::UserVisible {
            message: "Local sync folder path cannot be empty".to_string(),
        });
    }
    Ok(trimmed.to_string())
}

fn settings_to_dto(settings: LocalAccountSyncSettings) -> LocalAccountSyncSettingsDto {
    LocalAccountSyncSettingsDto {
        account_id: settings.account_id.0,
        sync_folder_path: settings.sync_folder_path,
        sync_account_id: settings.sync_account_id.0,
        device_id: settings.device_id.0,
        enabled: settings.enabled,
    }
}

#[tauri::command]
pub fn get_local_account_sync_settings(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<Option<LocalAccountSyncSettingsDto>, AppError> {
    let account_id = AccountId(account_id);
    let db = crate::commands::lock_db(&state.db)?;
    let account_repo = SqliteAccountRepository::new(db.reader());
    let account = account_repo
        .find_by_id(&account_id)?
        .ok_or_else(|| AppError::UserVisible {
            message: "Account not found".to_string(),
        })?;
    ensure_local_account(&account)?;

    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.reader());
    Ok(settings_repo
        .find_by_account_id(&account_id)?
        .map(settings_to_dto))
}

#[tauri::command]
pub fn set_local_account_sync_settings(
    state: State<'_, AppState>,
    account_id: String,
    sync_folder_path: String,
    enabled: bool,
) -> Result<LocalAccountSyncSettingsDto, AppError> {
    let account_id = AccountId(account_id);
    let sync_folder_path = normalize_sync_folder_path(sync_folder_path)?;
    let db = crate::commands::lock_db(&state.db)?;
    let account_repo = SqliteAccountRepository::new(db.reader());
    let account = account_repo
        .find_by_id(&account_id)?
        .ok_or_else(|| AppError::UserVisible {
            message: "Account not found".to_string(),
        })?;
    ensure_local_account(&account)?;

    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.writer());
    let existing = settings_repo.find_by_account_id(&account_id)?;
    let settings = LocalAccountSyncSettings {
        account_id,
        sync_folder_path,
        sync_account_id: existing
            .as_ref()
            .map(|settings| settings.sync_account_id.clone())
            .unwrap_or_default(),
        device_id: existing
            .as_ref()
            .map(|settings| settings.device_id.clone())
            .unwrap_or_default(),
        enabled,
    };
    settings_repo.save(&settings)?;
    Ok(settings_to_dto(settings))
}

#[tauri::command]
pub fn import_local_account_sync_operations(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<LocalAccountSyncImportReportDto, AppError> {
    let account_id = AccountId(account_id);
    let db = crate::commands::lock_db(&state.db)?;
    let account_repo = SqliteAccountRepository::new(db.reader());
    let account = account_repo
        .find_by_id(&account_id)?
        .ok_or_else(|| AppError::UserVisible {
            message: "Account not found".to_string(),
        })?;
    ensure_local_account(&account)?;

    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.reader());
    let settings = settings_repo
        .find_by_account_id(&account_id)?
        .ok_or_else(|| AppError::UserVisible {
            message: "Local sync folder is not configured".to_string(),
        })?;
    if !settings.enabled {
        return Err(AppError::UserVisible {
            message: "Local sync folder is disabled".to_string(),
        });
    }

    let report = import_local_account_sync_folder(
        &db,
        &account_id,
        &settings.sync_account_id,
        &PathBuf::from(&settings.sync_folder_path),
    )?;
    Ok(LocalAccountSyncImportReportDto {
        loaded_operations: report.loaded_operations,
        applied_operations: report.applied_operations,
        rejected_operations: report.rejected_operations,
        rejected_files: report.rejected_files,
        conflicted_candidates: report.conflicted_candidates,
        applied: report.applied,
        folders_upserted: report.apply_report.folders_upserted,
        feeds_upserted: report.apply_report.feeds_upserted,
        article_states_applied: report.apply_report.article_states_applied,
        tags_upserted: report.apply_report.tags_upserted,
        article_tags_added: report.apply_report.article_tags_added,
        article_tags_removed: report.apply_report.article_tags_removed,
        mute_keywords_upserted: report.apply_report.mute_keywords_upserted,
        mute_keywords_removed: report.apply_report.mute_keywords_removed,
        unmatched_article_keys: report.apply_report.unmatched_article_keys,
        skipped_removed_tags: report.apply_report.skipped_removed_tags,
        conflict_count: report.apply_report.conflict_count,
    })
}

#[tauri::command]
pub fn export_local_account_sync_operations(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<LocalAccountSyncExportReportDto, AppError> {
    let account_id = AccountId(account_id);
    let db = crate::commands::lock_db(&state.db)?;
    let account_repo = SqliteAccountRepository::new(db.reader());
    let account = account_repo
        .find_by_id(&account_id)?
        .ok_or_else(|| AppError::UserVisible {
            message: "Account not found".to_string(),
        })?;
    ensure_local_account(&account)?;

    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.reader());
    let settings = settings_repo
        .find_by_account_id(&account_id)?
        .ok_or_else(|| AppError::UserVisible {
            message: "Local sync folder is not configured".to_string(),
        })?;
    if !settings.enabled {
        return Err(AppError::UserVisible {
            message: "Local sync folder is disabled".to_string(),
        });
    }

    let report = export_local_account_sync_folder(
        &db,
        &account_id,
        &settings.sync_account_id,
        &settings.device_id,
        &PathBuf::from(&settings.sync_folder_path),
    )?;
    Ok(LocalAccountSyncExportReportDto {
        operations_written: report.operations_written,
    })
}

#[cfg(test)]
mod tests {
    use crate::commands::dto::AppError;
    use crate::commands::local_account_sync_commands::ensure_local_account;
    use crate::domain::account::{Account, ConnectionVerificationStatus};
    use crate::domain::provider::ProviderKind;
    use crate::domain::types::AccountId;

    fn account(kind: ProviderKind) -> Account {
        Account {
            id: AccountId("account-1".to_string()),
            kind,
            name: "Account".to_string(),
            server_url: None,
            username: None,
            sync_interval_secs: 3600,
            sync_on_startup: false,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        }
    }

    #[test]
    fn local_account_sync_commands_only_accept_local_accounts() {
        ensure_local_account(&account(ProviderKind::Local)).unwrap();

        let error = ensure_local_account(&account(ProviderKind::FreshRss))
            .expect_err("FreshRSS should not use local sync folder commands");

        assert!(matches!(
            error,
            AppError::UserVisible { ref message }
                if message == "Local account sync folders are only available for Local accounts"
        ));
    }
}
