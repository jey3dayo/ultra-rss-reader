use crate::commands::dto::{
    AccountSyncWarningDetail, AccountSyncWarningKind, AppError, SyncResult,
};
use crate::commands::sync_providers::ProviderSyncOutcome;
use crate::domain::provider::ProviderKind;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SyncTrigger {
    ManualAll,
    ManualAccount,
    ManualFeed,
    Background,
    Startup,
    StartupRepair,
}

impl SyncTrigger {
    fn label(self) -> &'static str {
        match self {
            Self::ManualAll => "manual-all",
            Self::ManualAccount => "manual-account",
            Self::ManualFeed => "manual-feed",
            Self::Background => "background",
            Self::Startup => "startup",
            Self::StartupRepair => "startup-repair",
        }
    }
}

fn sync_failure_diagnostic(
    trigger: SyncTrigger,
    provider: &ProviderKind,
    error_kind: &str,
) -> String {
    format!(
        "event=sync-failed trigger={} provider={} error_kind={}",
        trigger.label(),
        provider.diagnostic_label(),
        error_kind
    )
}

pub(crate) fn log_sync_failure(trigger: SyncTrigger, provider: &ProviderKind, error: &AppError) {
    log::warn!(target: "sync", "{}", sync_failure_diagnostic(trigger, provider, error.diagnostic_kind()));
}

pub(crate) fn log_sync_completion(
    trigger: SyncTrigger,
    provider: Option<&ProviderKind>,
    result: &SyncResult,
) {
    log_sync_counts(
        trigger,
        provider,
        result.total,
        result.succeeded,
        result.failed.len(),
        result.warnings.len(),
    );
}

pub(crate) fn log_background_sync_outcome(
    provider: &ProviderKind,
    result: &Result<ProviderSyncOutcome, AppError>,
) {
    let (succeeded, failed, warnings) = match result {
        Ok(outcome) => {
            for warning in &outcome.warnings {
                log_sync_warning(
                    SyncTrigger::Background,
                    provider,
                    warning.kind,
                    &warning.detail,
                );
            }
            (1, 0, outcome.warnings.len())
        }
        Err(_) => (0, 1, 0),
    };
    log_sync_counts(
        SyncTrigger::Background,
        Some(provider),
        1,
        succeeded,
        failed,
        warnings,
    );
}

fn log_sync_counts(
    trigger: SyncTrigger,
    provider: Option<&ProviderKind>,
    total: usize,
    succeeded: usize,
    failed: usize,
    warnings: usize,
) {
    let level = if failed == 0 && warnings == 0 {
        log::Level::Info
    } else {
        log::Level::Warn
    };
    log::log!(
        target: "sync",
        level,
        "event=sync-completed trigger={} provider={} total={} succeeded={} failed={} warnings={}",
        trigger.label(),
        provider.map_or("all", ProviderKind::diagnostic_label),
        total,
        succeeded,
        failed,
        warnings
    );
}

pub(crate) fn log_sync_warning(
    trigger: SyncTrigger,
    provider: &ProviderKind,
    kind: AccountSyncWarningKind,
    detail: &AccountSyncWarningDetail,
) {
    let warning_kind = match kind {
        AccountSyncWarningKind::Generic => "generic",
        AccountSyncWarningKind::RetryPending => "retry_pending",
        AccountSyncWarningKind::RetryScheduled => "retry_scheduled",
    };
    let warning_detail = match detail {
        AccountSyncWarningDetail::PendingMutationRetry { .. } => "pending_mutation_retry",
        AccountSyncWarningDetail::DroppedPendingMutation { .. } => "dropped_pending_mutation",
        AccountSyncWarningDetail::DeletedGreaderFolders { .. } => "deleted_greader_folders",
        AccountSyncWarningDetail::FeedSkippedEntries { .. } => "feed_skipped_entries",
        AccountSyncWarningDetail::FeedArticlesVanished { .. } => "feed_articles_vanished",
        AccountSyncWarningDetail::AccountSkippedEntries { .. } => "account_skipped_entries",
        AccountSyncWarningDetail::LocalFeedSyncFailed { .. } => "local_feed_sync_failed",
        AccountSyncWarningDetail::LocalAccountSyncOperationFailed { .. } => {
            "local_account_sync_operation_failed"
        }
        AccountSyncWarningDetail::LocalImportResult { .. } => "local_import_result",
        AccountSyncWarningDetail::StartupRepairMarkerFailed { .. } => {
            "startup_repair_marker_failed"
        }
        AccountSyncWarningDetail::SchedulerLoadFailed { .. } => "scheduler_load_failed",
        AccountSyncWarningDetail::BackoffPersistFailed { .. } => "backoff_persist_failed",
        AccountSyncWarningDetail::BackgroundSyncRetryScheduled { .. } => {
            "background_sync_retry_scheduled"
        }
    };
    log::warn!(
        target: "sync",
        "event=sync-warning trigger={} provider={} warning_kind={} warning_detail={}",
        trigger.label(),
        provider.diagnostic_label(),
        warning_kind,
        warning_detail
    );
}

pub(crate) fn log_sync_panic(trigger: SyncTrigger, provider: &ProviderKind) {
    log::warn!(target: "sync", "{}", sync_failure_diagnostic(trigger, provider, "panic"));
}

pub(crate) fn log_local_feed_fetch_failure(host_class: &str, error: &AppError) {
    log::warn!(
        target: "sync",
        "event=feed-fetch-failed provider={} host_class={} error_kind={}",
        ProviderKind::Local.diagnostic_label(),
        host_class,
        error.diagnostic_kind()
    );
}

#[cfg(test)]
mod tests;
