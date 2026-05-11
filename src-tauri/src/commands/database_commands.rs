use serde::Serialize;
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::start_database_maintenance;
use crate::commands::try_lock_db;
use crate::commands::AppState;
use crate::infra::db::connection::{DatabaseInfo, DbManager};

#[derive(Debug, Serialize)]
pub struct DatabaseInfoDto {
    /// Main DB file size in bytes
    pub db_size_bytes: u64,
    /// WAL file size in bytes (0 if not present)
    pub wal_size_bytes: u64,
    /// SHM file size in bytes (0 if not present or unavailable)
    pub shm_size_bytes: u64,
    /// Display total size (db + wal + shm) in bytes
    pub total_size_bytes: u64,
}

impl From<DatabaseInfo> for DatabaseInfoDto {
    fn from(info: DatabaseInfo) -> Self {
        Self {
            db_size_bytes: info.db_size_bytes,
            wal_size_bytes: info.wal_size_bytes,
            shm_size_bytes: info.shm_size_bytes,
            total_size_bytes: info.total_size_bytes,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseMaintenanceAction {
    Vacuum,
    SearchIndexRebuild,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseMaintenanceTrigger {
    UserInitiated,
    Automatic,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AppActivityState {
    Foreground,
    Background,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseMaintenanceScheduleDecision {
    StartNow,
    DeferUntilBackground,
    RejectWhileSyncing,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseRuntimeFailureKind {
    ReadCorruption,
    WriteCorruption,
    MigrationFailed,
    DowngradeBlocked,
    Locked,
    PermissionDenied,
    DiskFull,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseRuntimeRecoveryMode {
    ReadOnlyDegraded,
    StartupBlocked,
    RetryWhenIdle,
    UserPermissionFix,
    FreeDiskSpace,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseRuntimeRecoveryAction {
    RunIntegrityCheck,
    RestoreBackup,
    PreserveBackupAndRestart,
    Retry,
    CheckOsPermissions,
    FreeDiskSpace,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseRecoveryActionSafety {
    ReadOnly,
    RequiresDryRun,
    RequiresExplicitConfirmation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum FilesystemRecoverySurface {
    LogDirectory,
    DatabaseBackup,
    OpmlImport,
    OpmlExport,
    SettingsData,
    DevCredentialStore,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum FilesystemPathNormalizationPolicy {
    AppOwnedNativePath,
    UserSelectedNativePath,
    UnsupportedUntilVersionedContract,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AtomicFileWritePolicy {
    NotAWriteSurface,
    TempFileThenRename,
    UnsupportedUntilVersionedContract,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NativeFileDialogExtensionPolicy {
    NotAFileDialogSurface,
    RequireOpmlExtension,
    RequireDatabaseExtension,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NativeFileDialogOverwritePolicy {
    NotAFileDialogSurface,
    OpenExistingFileOnly,
    ConfirmBeforeReplacingExistingFile,
    RejectExistingFileCollision,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NativeFileDialogCancelPolicy {
    NotAFileDialogSurface,
    NoOpSuccess,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NativeFileDialogDirectoryPolicy {
    NotAFileDialogSurface,
    RejectDirectorySelection,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LongRunningNativeOperation {
    UpdaterDownload,
    OpmlExport,
    DatabaseBackup,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LongRunningOperationInterruptionPolicy {
    CancelAndInvalidatePartialArtifact,
    ResetProgressBeforeRetry,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DatabaseRuntimeRecoveryContract {
    pub failure_kind: DatabaseRuntimeFailureKind,
    pub mode: DatabaseRuntimeRecoveryMode,
    pub actions: Vec<DatabaseRuntimeRecoveryAction>,
    pub action_safety: Vec<DatabaseRecoveryActionSafety>,
    pub diagnostics_id_required: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct FilesystemRecoveryContract {
    pub surface: FilesystemRecoverySurface,
    pub path_normalization: FilesystemPathNormalizationPolicy,
    pub atomic_write: AtomicFileWritePolicy,
    pub dialog_extension: NativeFileDialogExtensionPolicy,
    pub overwrite_confirmation: NativeFileDialogOverwritePolicy,
    pub cancel_policy: NativeFileDialogCancelPolicy,
    pub directory_policy: NativeFileDialogDirectoryPolicy,
    pub auto_appends_extension: bool,
    pub exposes_raw_path_to_webview: bool,
}

#[cfg(test)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PrivateDataResetStep {
    DeleteCredentials,
    DeleteDatabaseData,
    ClearLocalStorage,
    ClearQueryCache,
    ReloadApp,
}

#[cfg(test)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PrivateDataResetContract {
    pub steps: Vec<PrivateDataResetStep>,
    pub keyring_failure_blocks_database_delete: bool,
    pub database_failure_blocks_frontend_cleanup: bool,
    pub local_storage_failure_blocks_query_cache_clear: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct SearchIndexRebuildMaintenanceContract {
    pub action: DatabaseMaintenanceAction,
    pub reports_progress: bool,
    pub supports_cancellation: bool,
    pub retries_after_cancellation: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LongRunningNativeOperationContract {
    pub operation: LongRunningNativeOperation,
    pub cancellation_token_required: bool,
    pub interruption_policies: Vec<LongRunningOperationInterruptionPolicy>,
    pub accepts_partial_artifact_after_resume: bool,
}

#[cfg(test)]
pub(crate) fn schedule_database_maintenance_action(
    action: DatabaseMaintenanceAction,
    trigger: DatabaseMaintenanceTrigger,
    app_activity: AppActivityState,
    sync_in_flight: bool,
) -> DatabaseMaintenanceScheduleDecision {
    match action {
        DatabaseMaintenanceAction::Vacuum | DatabaseMaintenanceAction::SearchIndexRebuild => {}
    }

    if sync_in_flight {
        return DatabaseMaintenanceScheduleDecision::RejectWhileSyncing;
    }

    match (trigger, app_activity) {
        (DatabaseMaintenanceTrigger::UserInitiated, _) => {
            DatabaseMaintenanceScheduleDecision::StartNow
        }
        (DatabaseMaintenanceTrigger::Automatic, AppActivityState::Background) => {
            DatabaseMaintenanceScheduleDecision::StartNow
        }
        (DatabaseMaintenanceTrigger::Automatic, AppActivityState::Foreground) => {
            DatabaseMaintenanceScheduleDecision::DeferUntilBackground
        }
    }
}

#[cfg(test)]
pub(crate) fn filesystem_recovery_contract(
    surface: FilesystemRecoverySurface,
) -> FilesystemRecoveryContract {
    let (
        path_normalization,
        atomic_write,
        dialog_extension,
        overwrite_confirmation,
        cancel_policy,
        directory_policy,
        auto_appends_extension,
        exposes_raw_path_to_webview,
    ) = match surface {
        FilesystemRecoverySurface::LogDirectory => (
            FilesystemPathNormalizationPolicy::AppOwnedNativePath,
            AtomicFileWritePolicy::NotAWriteSurface,
            NativeFileDialogExtensionPolicy::NotAFileDialogSurface,
            NativeFileDialogOverwritePolicy::NotAFileDialogSurface,
            NativeFileDialogCancelPolicy::NotAFileDialogSurface,
            NativeFileDialogDirectoryPolicy::NotAFileDialogSurface,
            false,
            false,
        ),
        FilesystemRecoverySurface::DatabaseBackup => (
            FilesystemPathNormalizationPolicy::AppOwnedNativePath,
            AtomicFileWritePolicy::TempFileThenRename,
            NativeFileDialogExtensionPolicy::RequireDatabaseExtension,
            NativeFileDialogOverwritePolicy::RejectExistingFileCollision,
            NativeFileDialogCancelPolicy::NoOpSuccess,
            NativeFileDialogDirectoryPolicy::RejectDirectorySelection,
            true,
            false,
        ),
        FilesystemRecoverySurface::OpmlImport => (
            FilesystemPathNormalizationPolicy::UserSelectedNativePath,
            AtomicFileWritePolicy::NotAWriteSurface,
            NativeFileDialogExtensionPolicy::RequireOpmlExtension,
            NativeFileDialogOverwritePolicy::OpenExistingFileOnly,
            NativeFileDialogCancelPolicy::NoOpSuccess,
            NativeFileDialogDirectoryPolicy::RejectDirectorySelection,
            false,
            false,
        ),
        FilesystemRecoverySurface::OpmlExport => (
            FilesystemPathNormalizationPolicy::UserSelectedNativePath,
            AtomicFileWritePolicy::TempFileThenRename,
            NativeFileDialogExtensionPolicy::RequireOpmlExtension,
            NativeFileDialogOverwritePolicy::ConfirmBeforeReplacingExistingFile,
            NativeFileDialogCancelPolicy::NoOpSuccess,
            NativeFileDialogDirectoryPolicy::RejectDirectorySelection,
            true,
            true,
        ),
        FilesystemRecoverySurface::SettingsData => (
            FilesystemPathNormalizationPolicy::UserSelectedNativePath,
            AtomicFileWritePolicy::UnsupportedUntilVersionedContract,
            NativeFileDialogExtensionPolicy::NotAFileDialogSurface,
            NativeFileDialogOverwritePolicy::NotAFileDialogSurface,
            NativeFileDialogCancelPolicy::NotAFileDialogSurface,
            NativeFileDialogDirectoryPolicy::NotAFileDialogSurface,
            false,
            false,
        ),
        FilesystemRecoverySurface::DevCredentialStore => (
            FilesystemPathNormalizationPolicy::AppOwnedNativePath,
            AtomicFileWritePolicy::TempFileThenRename,
            NativeFileDialogExtensionPolicy::NotAFileDialogSurface,
            NativeFileDialogOverwritePolicy::NotAFileDialogSurface,
            NativeFileDialogCancelPolicy::NotAFileDialogSurface,
            NativeFileDialogDirectoryPolicy::NotAFileDialogSurface,
            false,
            false,
        ),
    };

    FilesystemRecoveryContract {
        surface,
        path_normalization,
        atomic_write,
        dialog_extension,
        overwrite_confirmation,
        cancel_policy,
        directory_policy,
        auto_appends_extension,
        exposes_raw_path_to_webview,
    }
}

#[cfg(test)]
pub(crate) fn search_index_rebuild_maintenance_contract() -> SearchIndexRebuildMaintenanceContract {
    SearchIndexRebuildMaintenanceContract {
        action: DatabaseMaintenanceAction::SearchIndexRebuild,
        reports_progress: true,
        supports_cancellation: true,
        retries_after_cancellation: true,
    }
}

#[cfg(test)]
pub(crate) fn long_running_native_operation_contract(
    operation: LongRunningNativeOperation,
) -> LongRunningNativeOperationContract {
    LongRunningNativeOperationContract {
        operation,
        cancellation_token_required: true,
        interruption_policies: vec![
            LongRunningOperationInterruptionPolicy::CancelAndInvalidatePartialArtifact,
            LongRunningOperationInterruptionPolicy::ResetProgressBeforeRetry,
        ],
        accepts_partial_artifact_after_resume: false,
    }
}

#[cfg(test)]
pub(crate) fn private_data_reset_contract() -> PrivateDataResetContract {
    PrivateDataResetContract {
        steps: vec![
            PrivateDataResetStep::DeleteCredentials,
            PrivateDataResetStep::DeleteDatabaseData,
            PrivateDataResetStep::ClearLocalStorage,
            PrivateDataResetStep::ClearQueryCache,
            PrivateDataResetStep::ReloadApp,
        ],
        keyring_failure_blocks_database_delete: true,
        database_failure_blocks_frontend_cleanup: true,
        local_storage_failure_blocks_query_cache_clear: false,
    }
}

#[cfg(test)]
pub(crate) fn database_runtime_recovery_contract(
    failure_kind: DatabaseRuntimeFailureKind,
) -> DatabaseRuntimeRecoveryContract {
    let (mode, actions) = match failure_kind {
        DatabaseRuntimeFailureKind::ReadCorruption => (
            DatabaseRuntimeRecoveryMode::ReadOnlyDegraded,
            vec![
                DatabaseRuntimeRecoveryAction::RunIntegrityCheck,
                DatabaseRuntimeRecoveryAction::RestoreBackup,
            ],
        ),
        DatabaseRuntimeFailureKind::WriteCorruption => (
            DatabaseRuntimeRecoveryMode::ReadOnlyDegraded,
            vec![
                DatabaseRuntimeRecoveryAction::RunIntegrityCheck,
                DatabaseRuntimeRecoveryAction::RestoreBackup,
            ],
        ),
        DatabaseRuntimeFailureKind::MigrationFailed
        | DatabaseRuntimeFailureKind::DowngradeBlocked => (
            DatabaseRuntimeRecoveryMode::StartupBlocked,
            vec![
                DatabaseRuntimeRecoveryAction::PreserveBackupAndRestart,
                DatabaseRuntimeRecoveryAction::RestoreBackup,
            ],
        ),
        DatabaseRuntimeFailureKind::Locked => (
            DatabaseRuntimeRecoveryMode::RetryWhenIdle,
            vec![DatabaseRuntimeRecoveryAction::Retry],
        ),
        DatabaseRuntimeFailureKind::PermissionDenied => (
            DatabaseRuntimeRecoveryMode::UserPermissionFix,
            vec![DatabaseRuntimeRecoveryAction::CheckOsPermissions],
        ),
        DatabaseRuntimeFailureKind::DiskFull => (
            DatabaseRuntimeRecoveryMode::FreeDiskSpace,
            vec![DatabaseRuntimeRecoveryAction::FreeDiskSpace],
        ),
    };

    DatabaseRuntimeRecoveryContract {
        failure_kind,
        mode,
        action_safety: actions
            .iter()
            .map(|action| match action {
                DatabaseRuntimeRecoveryAction::RunIntegrityCheck
                | DatabaseRuntimeRecoveryAction::PreserveBackupAndRestart
                | DatabaseRuntimeRecoveryAction::Retry
                | DatabaseRuntimeRecoveryAction::CheckOsPermissions
                | DatabaseRuntimeRecoveryAction::FreeDiskSpace => {
                    DatabaseRecoveryActionSafety::ReadOnly
                }
                DatabaseRuntimeRecoveryAction::RestoreBackup => {
                    DatabaseRecoveryActionSafety::RequiresExplicitConfirmation
                }
            })
            .collect(),
        actions,
        diagnostics_id_required: true,
    }
}

#[tauri::command]
pub fn get_database_info(state: State<'_, AppState>) -> Result<DatabaseInfoDto, AppError> {
    get_database_info_inner(&state.db)
}

fn get_database_info_inner(db: &Mutex<DbManager>) -> Result<DatabaseInfoDto, AppError> {
    let db = try_lock_db(db)?;
    Ok(db.database_info().map_err(AppError::from)?.into())
}

#[tauri::command]
pub fn vacuum_database(state: State<'_, AppState>) -> Result<DatabaseInfoDto, AppError> {
    vacuum_database_inner(&state.db, &state.syncing)
}

fn vacuum_database_inner(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
) -> Result<DatabaseInfoDto, AppError> {
    let _maintenance_guard = start_database_maintenance(syncing)?;

    let mut db = try_lock_db(db)?;
    Ok(db.vacuum().map_err(AppError::from)?.into())
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Mutex;

    use crate::commands::database_commands::{
        database_runtime_recovery_contract, filesystem_recovery_contract, get_database_info_inner,
        long_running_native_operation_contract, private_data_reset_contract,
        schedule_database_maintenance_action, search_index_rebuild_maintenance_contract,
        vacuum_database_inner, AppActivityState, AtomicFileWritePolicy, DatabaseInfoDto,
        DatabaseMaintenanceAction, DatabaseMaintenanceScheduleDecision, DatabaseMaintenanceTrigger,
        DatabaseRecoveryActionSafety, DatabaseRuntimeFailureKind, DatabaseRuntimeRecoveryAction,
        DatabaseRuntimeRecoveryMode, FilesystemPathNormalizationPolicy, FilesystemRecoverySurface,
        LongRunningNativeOperation, LongRunningOperationInterruptionPolicy,
        NativeFileDialogCancelPolicy, NativeFileDialogDirectoryPolicy,
        NativeFileDialogExtensionPolicy, NativeFileDialogOverwritePolicy, PrivateDataResetStep,
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

        let error =
            vacuum_database_inner(&db, &syncing).expect_err("busy DB should return an error");

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
    fn automatic_large_maintenance_runs_only_in_background_without_sync() {
        assert_eq!(
            schedule_database_maintenance_action(
                DatabaseMaintenanceAction::Vacuum,
                DatabaseMaintenanceTrigger::Automatic,
                AppActivityState::Foreground,
                false,
            ),
            DatabaseMaintenanceScheduleDecision::DeferUntilBackground
        );
        assert_eq!(
            schedule_database_maintenance_action(
                DatabaseMaintenanceAction::Vacuum,
                DatabaseMaintenanceTrigger::Automatic,
                AppActivityState::Background,
                false,
            ),
            DatabaseMaintenanceScheduleDecision::StartNow
        );
        assert_eq!(
            schedule_database_maintenance_action(
                DatabaseMaintenanceAction::Vacuum,
                DatabaseMaintenanceTrigger::Automatic,
                AppActivityState::Background,
                true,
            ),
            DatabaseMaintenanceScheduleDecision::RejectWhileSyncing
        );
    }

    #[test]
    fn user_initiated_large_maintenance_can_run_in_foreground_when_idle() {
        assert_eq!(
            schedule_database_maintenance_action(
                DatabaseMaintenanceAction::Vacuum,
                DatabaseMaintenanceTrigger::UserInitiated,
                AppActivityState::Foreground,
                false,
            ),
            DatabaseMaintenanceScheduleDecision::StartNow
        );
    }

    #[test]
    fn search_index_rebuild_is_large_maintenance_with_progress_and_cancel_contract() {
        let contract = search_index_rebuild_maintenance_contract();

        assert_eq!(
            contract.action,
            DatabaseMaintenanceAction::SearchIndexRebuild
        );
        assert!(contract.reports_progress);
        assert!(contract.supports_cancellation);
        assert!(contract.retries_after_cancellation);
        assert_eq!(
            schedule_database_maintenance_action(
                contract.action,
                DatabaseMaintenanceTrigger::Automatic,
                AppActivityState::Foreground,
                false,
            ),
            DatabaseMaintenanceScheduleDecision::DeferUntilBackground
        );
    }

    #[test]
    fn long_running_native_operations_invalidate_partial_artifacts_after_interruption() {
        for operation in [
            LongRunningNativeOperation::UpdaterDownload,
            LongRunningNativeOperation::OpmlExport,
            LongRunningNativeOperation::DatabaseBackup,
        ] {
            let contract = long_running_native_operation_contract(operation);

            assert!(contract.cancellation_token_required);
            assert!(!contract.accepts_partial_artifact_after_resume);
            assert!(contract.interruption_policies.contains(
                &LongRunningOperationInterruptionPolicy::CancelAndInvalidatePartialArtifact
            ));
            assert!(contract
                .interruption_policies
                .contains(&LongRunningOperationInterruptionPolicy::ResetProgressBeforeRetry));
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
        let contract =
            database_runtime_recovery_contract(DatabaseRuntimeFailureKind::ReadCorruption);
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
}
