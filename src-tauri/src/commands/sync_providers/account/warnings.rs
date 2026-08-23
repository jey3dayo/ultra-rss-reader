//! Sync warning constructors shared by the account/feed sync orchestrators.
use crate::commands::dto::{AccountSyncWarningDetail, AccountSyncWarningKind};
use crate::repository::pending_mutation::PendingMutationType;

use super::super::ProviderSyncWarning;

pub(crate) fn pending_mutation_retry_warning(
    mutation_type: PendingMutationType,
) -> ProviderSyncWarning {
    ProviderSyncWarning {
        kind: AccountSyncWarningKind::RetryPending,
        message: format!(
            "Local change '{}' will retry next sync.",
            mutation_type.as_str()
        ),
        retry_at: None,
        retry_in_seconds: None,
        detail: AccountSyncWarningDetail::PendingMutationRetry {
            mutation: mutation_type.as_str().to_string(),
        },
    }
}

pub(crate) fn dropped_pending_mutation_warning(
    mutation_type: PendingMutationType,
) -> ProviderSyncWarning {
    ProviderSyncWarning {
        kind: AccountSyncWarningKind::Generic,
        message: format!(
            "Local change '{}' could not be sent because the feed is no longer managed by FreshRSS. Sync again after refreshing the feed.",
            mutation_type.as_str()
        ),
        retry_at: None,
        retry_in_seconds: None,
        detail: AccountSyncWarningDetail::DroppedPendingMutation {
            mutation: mutation_type.as_str().to_string(),
        },
    }
}

pub(crate) fn deleted_greader_folders_warning(count: usize) -> ProviderSyncWarning {
    ProviderSyncWarning {
        kind: AccountSyncWarningKind::Generic,
        message: format!(
            "FreshRSS removed {count} folder(s) that no longer exist remotely; their feeds were moved to Uncategorized."
        ),
        retry_at: None,
        retry_in_seconds: None,
        detail: AccountSyncWarningDetail::DeletedGreaderFolders { count },
    }
}
