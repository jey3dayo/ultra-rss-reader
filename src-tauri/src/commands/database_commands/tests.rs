use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use crate::commands::database_commands::{
    backup_database_inner, database_runtime_recovery_contract, filesystem_recovery_contract,
    get_database_info_inner, long_running_native_operation_contract, private_data_reset_contract,
    vacuum_database_inner, AtomicFileWritePolicy, DatabaseInfoDto, DatabaseRecoveryActionSafety,
    DatabaseRuntimeFailureKind, DatabaseRuntimeRecoveryAction, DatabaseRuntimeRecoveryMode,
    FilenameSuggestionPolicy, FilesystemPathNormalizationPolicy, FilesystemRecoverySurface,
    LongRunningNativeOperation, LongRunningOperationInterruptionPolicy,
    NativeFileDialogCancelPolicy, NativeFileDialogDirectoryPolicy, NativeFileDialogExtensionPolicy,
    NativeFileDialogOverwritePolicy, PrivateDataResetStep, SleepResumeStance,
};
use crate::commands::dto::AppError;
use crate::commands::start_database_maintenance;
use crate::commands::DATABASE_MAINTENANCE_BUSY_ERROR;
use crate::infra::db::connection::{DatabaseInfo, DbManager};

#[test]
fn vacuum_database_returns_syncing_error_before_trying_db_lock() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let _guard = db.lock().unwrap();
    let syncing = AtomicBool::new(true);

    let error = vacuum_database_inner(&db, &syncing).expect_err("syncing should block vacuum");

    match error {
        AppError::UserVisible { message } => {
            assert_eq!(message, DATABASE_MAINTENANCE_BUSY_ERROR);
        }
        other => panic!("expected user-visible syncing error, got {other:?}"),
    }
}

#[test]
fn backup_database_returns_syncing_error_before_trying_db_lock() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let _guard = db.lock().unwrap();
    let syncing = AtomicBool::new(true);

    let error = backup_database_inner(&db, &syncing).expect_err("syncing should block backup");

    match error {
        AppError::UserVisible { message } => {
            assert_eq!(message, DATABASE_MAINTENANCE_BUSY_ERROR);
        }
        other => panic!("expected user-visible syncing error, got {other:?}"),
    }
}

#[test]
fn get_database_info_returns_busy_error_when_db_is_locked() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let _guard = db.lock().unwrap();

    let error =
        get_database_info_inner(&db).expect_err("busy DB should return command-level error");

    match error {
        AppError::UserVisible { message } => {
            assert_eq!(
                message,
                "Database is busy. Wait for the current operation to finish and try again."
            );
        }
        other => panic!("expected user-visible busy error, got {other:?}"),
    }
}

#[test]
fn database_info_dto_preserves_shm_size_and_total_parity() {
    let dto = DatabaseInfoDto::from(DatabaseInfo {
        db_size_bytes: 13,
        wal_size_bytes: 7,
        shm_size_bytes: 11,
        total_size_bytes: 31,
    });

    assert_eq!(dto.db_size_bytes, 13);
    assert_eq!(dto.wal_size_bytes, 7);
    assert_eq!(dto.shm_size_bytes, 11);
    assert_eq!(
        dto.total_size_bytes,
        dto.db_size_bytes + dto.wal_size_bytes + dto.shm_size_bytes
    );
}

#[test]
fn vacuum_database_returns_busy_error_when_not_syncing_and_db_is_locked() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let _guard = db.lock().unwrap();
    let syncing = AtomicBool::new(false);

    let error = vacuum_database_inner(&db, &syncing).expect_err("busy DB should return an error");

    match error {
        AppError::UserVisible { message } => {
            assert_eq!(
                message,
                "Database is busy. Wait for the current operation to finish and try again."
            );
        }
        other => panic!("expected user-visible busy error, got {other:?}"),
    }

    assert!(
        !syncing.load(Ordering::SeqCst),
        "vacuum should release the maintenance flag after errors"
    );
}

#[test]
fn database_maintenance_guard_blocks_new_sync_and_releases_on_drop() {
    let syncing = AtomicBool::new(false);

    {
        let _guard = start_database_maintenance(&syncing).unwrap();
        assert!(
            syncing.load(Ordering::SeqCst),
            "maintenance should reserve the shared sync flag"
        );
    }

    assert!(
        !syncing.load(Ordering::SeqCst),
        "maintenance should release the shared sync flag"
    );
}

#[test]
fn database_maintenance_guard_returns_syncing_error_when_flag_is_reserved() {
    let syncing = AtomicBool::new(true);

    let error =
        start_database_maintenance(&syncing).expect_err("reserved flag should block vacuum");

    match error {
        AppError::UserVisible { message } => {
            assert_eq!(message, DATABASE_MAINTENANCE_BUSY_ERROR);
        }
        other => panic!("expected user-visible syncing error, got {other:?}"),
    }
    assert!(
        syncing.load(Ordering::SeqCst),
        "failed maintenance start should not clear another operation's flag"
    );
}

#[test]
fn long_running_native_operations_invalidate_partial_artifacts_after_interruption() {
    for (operation, expected_sleep_resume_stance) in [
        (
            LongRunningNativeOperation::UpdaterDownload,
            SleepResumeStance::Unsupported,
        ),
        (
            LongRunningNativeOperation::OpmlExport,
            SleepResumeStance::Guarded,
        ),
        (
            LongRunningNativeOperation::DatabaseBackup,
            SleepResumeStance::Guarded,
        ),
    ] {
        let contract = long_running_native_operation_contract(operation);

        assert!(contract.cancellation_token_required);
        assert!(!contract.accepts_partial_artifact_after_resume);
        assert!(contract
            .interruption_policies
            .contains(&LongRunningOperationInterruptionPolicy::CancelAndInvalidatePartialArtifact));
        assert!(contract
            .interruption_policies
            .contains(&LongRunningOperationInterruptionPolicy::ResetProgressBeforeRetry));
        assert_eq!(contract.sleep_resume_stance, expected_sleep_resume_stance);
    }
}

#[test]
fn runtime_corruption_recovery_surface_enters_read_only_degraded_mode() {
    for failure_kind in [
        DatabaseRuntimeFailureKind::ReadCorruption,
        DatabaseRuntimeFailureKind::WriteCorruption,
    ] {
        let contract = database_runtime_recovery_contract(failure_kind);

        assert_eq!(contract.mode, DatabaseRuntimeRecoveryMode::ReadOnlyDegraded);
        assert_eq!(
            contract.actions,
            vec![
                DatabaseRuntimeRecoveryAction::RunIntegrityCheck,
                DatabaseRuntimeRecoveryAction::RestoreBackup,
            ]
        );
        assert_eq!(
            contract.action_safety,
            vec![
                DatabaseRecoveryActionSafety::ReadOnly,
                DatabaseRecoveryActionSafety::RequiresExplicitConfirmation,
            ]
        );
        assert!(contract.diagnostics_id_required);
    }
}

#[test]
fn migration_startup_recovery_surface_blocks_startup_without_destructive_auto_repair() {
    for failure_kind in [
        DatabaseRuntimeFailureKind::MigrationFailed,
        DatabaseRuntimeFailureKind::DowngradeBlocked,
    ] {
        let contract = database_runtime_recovery_contract(failure_kind);

        assert_eq!(contract.mode, DatabaseRuntimeRecoveryMode::StartupBlocked);
        assert_eq!(
            contract.actions,
            vec![
                DatabaseRuntimeRecoveryAction::PreserveBackupAndRestart,
                DatabaseRuntimeRecoveryAction::RestoreBackup,
            ]
        );
        assert_eq!(
            contract.action_safety,
            vec![
                DatabaseRecoveryActionSafety::ReadOnly,
                DatabaseRecoveryActionSafety::RequiresExplicitConfirmation,
            ]
        );
        assert!(contract.diagnostics_id_required);
    }
}

#[test]
fn runtime_database_failures_have_distinct_recovery_actions() {
    let locked = database_runtime_recovery_contract(DatabaseRuntimeFailureKind::Locked);
    let permission =
        database_runtime_recovery_contract(DatabaseRuntimeFailureKind::PermissionDenied);
    let disk_full = database_runtime_recovery_contract(DatabaseRuntimeFailureKind::DiskFull);

    assert_eq!(locked.mode, DatabaseRuntimeRecoveryMode::RetryWhenIdle);
    assert_eq!(locked.actions, vec![DatabaseRuntimeRecoveryAction::Retry]);
    assert_eq!(
        locked.action_safety,
        vec![DatabaseRecoveryActionSafety::ReadOnly]
    );
    assert_eq!(
        permission.mode,
        DatabaseRuntimeRecoveryMode::UserPermissionFix
    );
    assert_eq!(
        permission.actions,
        vec![DatabaseRuntimeRecoveryAction::CheckOsPermissions]
    );
    assert_eq!(
        permission.action_safety,
        vec![DatabaseRecoveryActionSafety::ReadOnly]
    );
    assert_eq!(disk_full.mode, DatabaseRuntimeRecoveryMode::FreeDiskSpace);
    assert_eq!(
        disk_full.actions,
        vec![DatabaseRuntimeRecoveryAction::FreeDiskSpace]
    );
    assert_eq!(
        disk_full.action_safety,
        vec![DatabaseRecoveryActionSafety::ReadOnly]
    );
}

#[test]
fn recovery_action_safety_serializes_for_settings_data_contract() {
    let contract = database_runtime_recovery_contract(DatabaseRuntimeFailureKind::ReadCorruption);
    let value = serde_json::to_value(contract).expect("recovery contract should serialize");

    assert_eq!(value["actions"][0], "run_integrity_check");
    assert_eq!(value["action_safety"][0], "read_only");
    assert_eq!(value["actions"][1], "restore_backup");
    assert_eq!(value["action_safety"][1], "requires_explicit_confirmation");
    assert_eq!(
        serde_json::to_value(DatabaseRecoveryActionSafety::RequiresDryRun)
            .expect("dry-run safety should serialize"),
        "requires_dry_run"
    );
}

#[test]
fn filesystem_recovery_contracts_align_path_and_atomic_write_policy() {
    let log_dir = filesystem_recovery_contract(FilesystemRecoverySurface::LogDirectory);
    assert_eq!(
        log_dir.path_normalization,
        FilesystemPathNormalizationPolicy::AppOwnedNativePath
    );
    assert_eq!(
        log_dir.atomic_write,
        AtomicFileWritePolicy::NotAWriteSurface
    );
    assert_eq!(
        log_dir.dialog_extension,
        NativeFileDialogExtensionPolicy::NotAFileDialogSurface
    );
    assert_eq!(
        log_dir.overwrite_confirmation,
        NativeFileDialogOverwritePolicy::NotAFileDialogSurface
    );
    assert_eq!(
        log_dir.cancel_policy,
        NativeFileDialogCancelPolicy::NotAFileDialogSurface
    );
    assert_eq!(
        log_dir.directory_policy,
        NativeFileDialogDirectoryPolicy::NotAFileDialogSurface
    );
    assert!(!log_dir.auto_appends_extension);
    assert!(!log_dir.exposes_raw_path_to_webview);

    let backup = filesystem_recovery_contract(FilesystemRecoverySurface::DatabaseBackup);
    assert_eq!(
        backup.path_normalization,
        FilesystemPathNormalizationPolicy::AppOwnedNativePath
    );
    assert_eq!(
        backup.atomic_write,
        AtomicFileWritePolicy::TempFileThenRename
    );
    assert_eq!(
        backup.dialog_extension,
        NativeFileDialogExtensionPolicy::RequireDatabaseExtension
    );
    assert_eq!(
        backup.overwrite_confirmation,
        NativeFileDialogOverwritePolicy::RejectExistingFileCollision
    );
    assert_eq!(
        backup.cancel_policy,
        NativeFileDialogCancelPolicy::NoOpSuccess
    );
    assert_eq!(
        backup.directory_policy,
        NativeFileDialogDirectoryPolicy::RejectDirectorySelection
    );
    assert!(backup.auto_appends_extension);
    assert_eq!(
        backup.filename_suggestion,
        FilenameSuggestionPolicy::AppOwnedOrUserSelectedOnly
    );
    assert!(!backup.exposes_raw_path_to_webview);

    let dev_credentials =
        filesystem_recovery_contract(FilesystemRecoverySurface::DevCredentialStore);
    assert_eq!(
        dev_credentials.path_normalization,
        FilesystemPathNormalizationPolicy::AppOwnedNativePath
    );
    assert_eq!(
        dev_credentials.atomic_write,
        AtomicFileWritePolicy::TempFileThenRename
    );
    assert_eq!(
        dev_credentials.dialog_extension,
        NativeFileDialogExtensionPolicy::NotAFileDialogSurface
    );
    assert_eq!(
        dev_credentials.overwrite_confirmation,
        NativeFileDialogOverwritePolicy::NotAFileDialogSurface
    );
    assert_eq!(
        dev_credentials.cancel_policy,
        NativeFileDialogCancelPolicy::NotAFileDialogSurface
    );
    assert_eq!(
        dev_credentials.directory_policy,
        NativeFileDialogDirectoryPolicy::NotAFileDialogSurface
    );
    assert!(!dev_credentials.auto_appends_extension);
    assert!(!dev_credentials.exposes_raw_path_to_webview);

    let import = filesystem_recovery_contract(FilesystemRecoverySurface::OpmlImport);
    assert_eq!(
        import.path_normalization,
        FilesystemPathNormalizationPolicy::UserSelectedNativePath
    );
    assert_eq!(import.atomic_write, AtomicFileWritePolicy::NotAWriteSurface);
    assert_eq!(
        import.dialog_extension,
        NativeFileDialogExtensionPolicy::RequireOpmlExtension
    );
    assert_eq!(
        import.overwrite_confirmation,
        NativeFileDialogOverwritePolicy::OpenExistingFileOnly
    );
    assert_eq!(
        import.cancel_policy,
        NativeFileDialogCancelPolicy::NoOpSuccess
    );
    assert_eq!(
        import.directory_policy,
        NativeFileDialogDirectoryPolicy::RejectDirectorySelection
    );
    assert!(!import.auto_appends_extension);
    assert!(!import.exposes_raw_path_to_webview);

    let export = filesystem_recovery_contract(FilesystemRecoverySurface::OpmlExport);
    assert_eq!(
        export.path_normalization,
        FilesystemPathNormalizationPolicy::UserSelectedNativePath
    );
    assert_eq!(
        export.atomic_write,
        AtomicFileWritePolicy::TempFileThenRename
    );
    assert_eq!(
        export.dialog_extension,
        NativeFileDialogExtensionPolicy::RequireOpmlExtension
    );
    assert_eq!(
        export.overwrite_confirmation,
        NativeFileDialogOverwritePolicy::ConfirmBeforeReplacingExistingFile
    );
    assert_eq!(
        export.cancel_policy,
        NativeFileDialogCancelPolicy::NoOpSuccess
    );
    assert_eq!(
        export.directory_policy,
        NativeFileDialogDirectoryPolicy::RejectDirectorySelection
    );
    assert!(export.auto_appends_extension);
    assert_eq!(
        export.filename_suggestion,
        FilenameSuggestionPolicy::AppOwnedOrUserSelectedOnly
    );
    assert!(export.exposes_raw_path_to_webview);

    let settings = filesystem_recovery_contract(FilesystemRecoverySurface::SettingsData);
    assert_eq!(
        settings.path_normalization,
        FilesystemPathNormalizationPolicy::UserSelectedNativePath
    );
    assert_eq!(
        settings.atomic_write,
        AtomicFileWritePolicy::UnsupportedUntilVersionedContract
    );
    assert_eq!(
        settings.dialog_extension,
        NativeFileDialogExtensionPolicy::NotAFileDialogSurface
    );
    assert_eq!(
        settings.overwrite_confirmation,
        NativeFileDialogOverwritePolicy::NotAFileDialogSurface
    );
    assert_eq!(
        settings.cancel_policy,
        NativeFileDialogCancelPolicy::NotAFileDialogSurface
    );
    assert_eq!(
        settings.directory_policy,
        NativeFileDialogDirectoryPolicy::NotAFileDialogSurface
    );
    assert!(!settings.auto_appends_extension);
    assert!(!settings.exposes_raw_path_to_webview);
}

#[test]
fn filesystem_recovery_contract_serializes_for_settings_data_surface() {
    let value = serde_json::to_value(filesystem_recovery_contract(
        FilesystemRecoverySurface::DatabaseBackup,
    ))
    .expect("filesystem recovery contract should serialize");

    assert_eq!(value["surface"], "database_backup");
    assert_eq!(value["path_normalization"], "app_owned_native_path");
    assert_eq!(value["atomic_write"], "temp_file_then_rename");
    assert_eq!(value["dialog_extension"], "require_database_extension");
    assert_eq!(
        value["overwrite_confirmation"],
        "reject_existing_file_collision"
    );
    assert_eq!(value["cancel_policy"], "no_op_success");
    assert_eq!(value["directory_policy"], "reject_directory_selection");
    assert_eq!(value["auto_appends_extension"], true);
    assert_eq!(
        value["filename_suggestion"],
        "app_owned_or_user_selected_only"
    );
    assert_eq!(value["exposes_raw_path_to_webview"], false);
}

#[test]
fn private_data_reset_order_deletes_credentials_before_database_and_frontend_state() {
    let contract = private_data_reset_contract();

    assert_eq!(
        contract.steps,
        vec![
            PrivateDataResetStep::DeleteCredentials,
            PrivateDataResetStep::DeleteDatabaseData,
            PrivateDataResetStep::ClearLocalStorage,
            PrivateDataResetStep::ClearQueryCache,
            PrivateDataResetStep::ReloadApp,
        ]
    );
    assert!(contract.keyring_failure_blocks_database_delete);
    assert!(contract.database_failure_blocks_frontend_cleanup);
    assert!(
        !contract.local_storage_failure_blocks_query_cache_clear,
        "query cache must still clear after localStorage cleanup reports a recoverable failure"
    );
}
