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
    save_current_state_export_digest,
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

/// Merges an incoming `set_local_account_sync_settings` request with the
/// existing persisted settings (if any).
///
/// When the sync folder path changes, `last_export_digest` is reset to
/// `None` instead of carried forward: the previous digest describes state
/// exported to the *old* folder, so keeping it would make
/// `export_local_account_sync_folder_if_changed` believe the new (likely
/// empty) folder already has the latest state and skip exporting into it.
fn merge_local_account_sync_settings_update(
    account_id: AccountId,
    sync_folder_path: String,
    enabled: bool,
    existing: Option<&LocalAccountSyncSettings>,
) -> LocalAccountSyncSettings {
    let folder_path_changed =
        existing.is_some_and(|settings| settings.sync_folder_path != sync_folder_path);
    LocalAccountSyncSettings {
        account_id,
        sync_folder_path,
        sync_account_id: existing
            .map(|settings| settings.sync_account_id.clone())
            .unwrap_or_default(),
        device_id: existing
            .map(|settings| settings.device_id.clone())
            .unwrap_or_default(),
        enabled,
        last_export_digest: if folder_path_changed {
            None
        } else {
            existing.and_then(|settings| settings.last_export_digest.clone())
        },
    }
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
    let settings = merge_local_account_sync_settings_update(
        account_id,
        sync_folder_path,
        enabled,
        existing.as_ref(),
    );
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
    // Keep `settings.last_export_digest` in sync with what was just written,
    // so the next auto-export does not redundantly rewrite the same full
    // snapshot this manual export already wrote (see
    // `export_local_account_sync_folder_if_changed`).
    save_current_state_export_digest(&db, &account_id, &settings)?;
    Ok(LocalAccountSyncExportReportDto {
        operations_written: report.operations_written,
    })
}

#[cfg(test)]
mod tests {
    use crate::commands::dto::AppError;
    use crate::commands::local_account_sync_commands::{
        ensure_local_account, merge_local_account_sync_settings_update,
    };
    use crate::domain::account::{Account, ConnectionVerificationStatus};
    use crate::domain::local_account_sync::{LocalSyncAccountId, LocalSyncDeviceId};
    use crate::domain::provider::ProviderKind;
    use crate::domain::types::AccountId;
    use crate::infra::db::connection::DbManager;
    use crate::infra::db::sqlite_local_account_sync_settings::SqliteLocalAccountSyncSettingsRepository;
    use crate::infra::local_account_sync_files::load_local_sync_operation_dir;
    use crate::repository::local_account_sync_settings::{
        LocalAccountSyncSettings, LocalAccountSyncSettingsRepository,
    };
    use crate::service::local_account_sync::export_local_account_sync_folder_if_changed;

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

    fn seeded_settings(sync_folder_path: &str, account_id: &AccountId) -> LocalAccountSyncSettings {
        LocalAccountSyncSettings {
            account_id: account_id.clone(),
            sync_folder_path: sync_folder_path.to_string(),
            sync_account_id: LocalSyncAccountId("sync-account-a".to_string()),
            device_id: LocalSyncDeviceId("device-a".to_string()),
            enabled: true,
            last_export_digest: None,
        }
    }

    #[test]
    fn merge_settings_update_keeps_digest_when_folder_path_is_unchanged() {
        let account_id = AccountId("account-1".to_string());
        let existing = LocalAccountSyncSettings {
            last_export_digest: Some("digest-a".to_string()),
            ..seeded_settings("/sync/folder-a", &account_id)
        };

        let updated = merge_local_account_sync_settings_update(
            account_id,
            "/sync/folder-a".to_string(),
            true,
            Some(&existing),
        );

        assert_eq!(updated.last_export_digest, Some("digest-a".to_string()));
    }

    #[test]
    fn merge_settings_update_clears_digest_when_folder_path_changes() {
        let account_id = AccountId("account-1".to_string());
        let existing = LocalAccountSyncSettings {
            last_export_digest: Some("digest-a".to_string()),
            ..seeded_settings("/sync/folder-a", &account_id)
        };

        let updated = merge_local_account_sync_settings_update(
            account_id,
            "/sync/folder-b".to_string(),
            true,
            Some(&existing),
        );

        assert_eq!(updated.last_export_digest, None);
        assert_eq!(updated.sync_account_id, existing.sync_account_id);
        assert_eq!(updated.device_id, existing.device_id);
    }

    /// Reproduces the final-review finding: pointing an account at a new
    /// sync folder must not leave the stale digest in place, or
    /// `export_local_account_sync_folder_if_changed` would keep returning
    /// `Ok(None)` and the new folder would stay empty.
    #[test]
    fn folder_path_change_clears_digest_so_new_folder_gets_exported() {
        let db = DbManager::new_in_memory().unwrap();
        let account_id = AccountId("account-1".to_string());
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, 'Local', 'Local')",
                [&account_id.0],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order)
                 VALUES ('folder-1', ?1, 'Tech', 1)",
                [&account_id.0],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, folder_id, title, url, site_url, reader_mode, web_preview_mode)
                 VALUES ('feed-1', ?1, 'folder-1', 'Feed', 'https://example.com/feed.xml', 'https://example.com', 'inherit', 'inherit')",
                [&account_id.0],
            )
            .unwrap();

        let dir_a = tempfile::tempdir().unwrap();
        let dir_b = tempfile::tempdir().unwrap();
        let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.writer());

        let settings_a = seeded_settings(&dir_a.path().to_string_lossy(), &account_id);
        settings_repo.save(&settings_a).unwrap();

        export_local_account_sync_folder_if_changed(&db, &account_id, &settings_a)
            .unwrap()
            .expect("first export should write files because there is no prior digest");
        let after_first_export = settings_repo
            .find_by_account_id(&account_id)
            .unwrap()
            .expect("settings should exist after first export");
        assert!(after_first_export.last_export_digest.is_some());

        // Mirrors what `set_local_account_sync_settings` does when the caller
        // points the account at a new folder.
        let settings_b = merge_local_account_sync_settings_update(
            account_id.clone(),
            dir_b.path().to_string_lossy().to_string(),
            true,
            Some(&after_first_export),
        );
        assert_eq!(settings_b.last_export_digest, None);
        settings_repo.save(&settings_b).unwrap();

        let after_folder_change = settings_repo
            .find_by_account_id(&account_id)
            .unwrap()
            .expect("settings should exist after folder change");
        assert_eq!(after_folder_change.last_export_digest, None);

        let report =
            export_local_account_sync_folder_if_changed(&db, &account_id, &after_folder_change)
                .unwrap()
                .expect("folder change should trigger an export into the new folder");
        assert!(report.operations_written > 0);

        let load_report = load_local_sync_operation_dir(dir_b.path()).unwrap();
        assert!(
            !load_report.operations.is_empty(),
            "new sync folder should receive the exported operation files"
        );
    }
}
