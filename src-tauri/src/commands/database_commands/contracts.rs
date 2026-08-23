use serde::Serialize;

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
pub enum FilenameSuggestionPolicy {
    NotAnArtifactSurface,
    AppOwnedOrUserSelectedOnly,
    UnsupportedUntilVersionedContract,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SleepResumeStance {
    Supported,
    Guarded,
    Unsupported,
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
    pub filename_suggestion: FilenameSuggestionPolicy,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LongRunningNativeOperationContract {
    pub operation: LongRunningNativeOperation,
    pub cancellation_token_required: bool,
    pub interruption_policies: Vec<LongRunningOperationInterruptionPolicy>,
    pub accepts_partial_artifact_after_resume: bool,
    pub sleep_resume_stance: SleepResumeStance,
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
        filename_suggestion,
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
            FilenameSuggestionPolicy::NotAnArtifactSurface,
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
            FilenameSuggestionPolicy::AppOwnedOrUserSelectedOnly,
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
            FilenameSuggestionPolicy::NotAnArtifactSurface,
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
            FilenameSuggestionPolicy::AppOwnedOrUserSelectedOnly,
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
            FilenameSuggestionPolicy::UnsupportedUntilVersionedContract,
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
            FilenameSuggestionPolicy::AppOwnedOrUserSelectedOnly,
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
        filename_suggestion,
        exposes_raw_path_to_webview,
    }
}

#[cfg(test)]
pub(crate) fn long_running_native_operation_contract(
    operation: LongRunningNativeOperation,
) -> LongRunningNativeOperationContract {
    let sleep_resume_stance = match operation {
        LongRunningNativeOperation::UpdaterDownload => SleepResumeStance::Unsupported,
        LongRunningNativeOperation::OpmlExport => SleepResumeStance::Guarded,
        LongRunningNativeOperation::DatabaseBackup => SleepResumeStance::Guarded,
    };

    LongRunningNativeOperationContract {
        operation,
        // Required for a future Supported stance, but not sufficient on its own today:
        // no operation currently reaches Supported because none of them persist and
        // resume in-flight progress across a sleep/interruption boundary yet.
        cancellation_token_required: true,
        interruption_policies: vec![
            LongRunningOperationInterruptionPolicy::CancelAndInvalidatePartialArtifact,
            LongRunningOperationInterruptionPolicy::ResetProgressBeforeRetry,
        ],
        accepts_partial_artifact_after_resume: false,
        sleep_resume_stance,
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
