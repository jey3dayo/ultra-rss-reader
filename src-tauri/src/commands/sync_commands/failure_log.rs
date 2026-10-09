use crate::commands::dto::AppError;
use crate::domain::provider::ProviderKind;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SyncTrigger {
    ManualAll,
    ManualAccount,
    ManualFeed,
    Background,
    StartupRepair,
}

impl SyncTrigger {
    fn label(self) -> &'static str {
        match self {
            Self::ManualAll => "manual-all",
            Self::ManualAccount => "manual-account",
            Self::ManualFeed => "manual-feed",
            Self::Background => "background",
            Self::StartupRepair => "startup-repair",
        }
    }
}

fn sync_failure_diagnostic(
    trigger: SyncTrigger,
    provider: &ProviderKind,
    error: &AppError,
) -> String {
    format!(
        "event=sync-failed trigger={} provider={} error_kind={}",
        trigger.label(),
        provider.diagnostic_label(),
        error.diagnostic_kind()
    )
}

/// Release builds only keep `log` records, so this is the sole persisted trace of a failed sync.
pub(crate) fn log_sync_failure(trigger: SyncTrigger, provider: &ProviderKind, error: &AppError) {
    log::warn!(target: "sync", "{}", sync_failure_diagnostic(trigger, provider, error));
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
