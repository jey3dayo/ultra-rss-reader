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
    Locked,
    PermissionDenied,
    DiskFull,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseRuntimeRecoveryMode {
    ReadOnlyDegraded,
    RetryWhenIdle,
    UserPermissionFix,
    FreeDiskSpace,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseRuntimeRecoveryAction {
    RunIntegrityCheck,
    RestoreBackup,
    Retry,
    CheckOsPermissions,
    FreeDiskSpace,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DatabaseRuntimeRecoveryContract {
    pub failure_kind: DatabaseRuntimeFailureKind,
    pub mode: DatabaseRuntimeRecoveryMode,
    pub actions: Vec<DatabaseRuntimeRecoveryAction>,
    pub diagnostics_id_required: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct SearchIndexRebuildMaintenanceContract {
    pub action: DatabaseMaintenanceAction,
    pub reports_progress: bool,
    pub supports_cancellation: bool,
    pub retries_after_cancellation: bool,
}

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

pub(crate) fn search_index_rebuild_maintenance_contract() -> SearchIndexRebuildMaintenanceContract {
    SearchIndexRebuildMaintenanceContract {
        action: DatabaseMaintenanceAction::SearchIndexRebuild,
        reports_progress: true,
        supports_cancellation: true,
        retries_after_cancellation: true,
    }
}

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
        database_runtime_recovery_contract, get_database_info_inner,
        schedule_database_maintenance_action, search_index_rebuild_maintenance_contract,
        vacuum_database_inner, AppActivityState, DatabaseInfoDto, DatabaseMaintenanceAction,
        DatabaseMaintenanceScheduleDecision, DatabaseMaintenanceTrigger,
        DatabaseRuntimeFailureKind, DatabaseRuntimeRecoveryAction, DatabaseRuntimeRecoveryMode,
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
            permission.mode,
            DatabaseRuntimeRecoveryMode::UserPermissionFix
        );
        assert_eq!(
            permission.actions,
            vec![DatabaseRuntimeRecoveryAction::CheckOsPermissions]
        );
        assert_eq!(disk_full.mode, DatabaseRuntimeRecoveryMode::FreeDiskSpace);
        assert_eq!(
            disk_full.actions,
            vec![DatabaseRuntimeRecoveryAction::FreeDiskSpace]
        );
    }
}
