#[cfg(test)]
use std::collections::{HashMap, HashSet};
#[cfg(test)]
use std::sync::Mutex;
#[cfg(any(test, not(target_os = "macos")))]
use std::time::Duration;

use reqwest::Url;

use crate::commands::dto::{AccountSyncWarningDetail, AccountSyncWarningKind, AppError};
use crate::domain::account::Account;
#[cfg(test)]
use crate::domain::article::generate_entry_id;
#[cfg(test)]
use crate::domain::article::Article;
#[cfg(any(test, not(target_os = "macos")))]
use crate::domain::error::DomainError;
use crate::domain::error::DomainResult;
#[cfg(test)]
use crate::domain::feed::Feed;
#[cfg(test)]
use crate::domain::folder::Folder;
#[cfg(test)]
use crate::domain::provider::RemoteFolder;
use crate::domain::provider::GREADER_FEED_ID_PREFIX;
#[cfg(test)]
use crate::domain::provider::{RemoteSubscription, SyncCursor};
#[cfg(test)]
use crate::domain::types::ArticleId;
#[cfg(test)]
use crate::domain::types::{AccountId, FeedId, FolderId};
use crate::domain::url_policy::is_private_host;
#[cfg(test)]
use crate::infra::db::connection::DbManager;
#[cfg(test)]
use crate::infra::db::sqlite_article::SqliteArticleRepository;
#[cfg(test)]
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
#[cfg(test)]
use crate::infra::db::sqlite_folder::SqliteFolderRepository;
#[cfg(test)]
use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
#[cfg(test)]
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::infra::keyring_store::{self, CredentialLookupMode};
#[cfg(test)]
use crate::infra::provider::greader::GReaderProvider;
#[cfg(test)]
use crate::infra::provider::local::LocalProvider;
#[cfg(test)]
use crate::infra::provider::traits::{Credentials, FeedProvider};
#[cfg(test)]
use crate::infra::sanitizer;
#[cfg(test)]
use crate::repository::feed::FeedRepository;
#[cfg(test)]
use crate::repository::folder::FolderRepository;
#[cfg(test)]
use crate::repository::pending_mutation::{PendingMutationRepository, PendingMutationType};
#[cfg(test)]
use crate::repository::sync_state::{SyncState, SyncStateRepository, SyncStateScopeKey};

mod account;
use account::pending_remote_ids_by_axis;
#[cfg(test)]
use account::{
    apply_remote_state_with_protection, deleted_greader_folders_warning,
    dropped_pending_mutation_warning, pending_mutation_retry_warning,
    save_greader_folders_snapshot, sync_greader_account_entries,
    sync_greader_account_entries_with_max_pages, sync_greader_feed_entries,
    sync_greader_feed_entries_with_max_pages,
};
pub(super) use account::{repair_greader_remote_state, sync_greader_account, sync_greader_feed};

mod local;
mod session;

pub(super) use local::sync_local_feed;
#[cfg(test)]
use local::{local_feed_scope_key, upsert_articles_in_current_transaction};
pub(crate) use session::{GReaderSession, SessionError};

mod state;
mod subscriptions;
mod unread;

#[cfg(test)]
use state::{
    cursor_from_state, feed_scope_key, should_pull_remote_state, sync_state_timestamp_usec,
    update_latest_timestamp_usec,
};
#[cfg(test)]
use subscriptions::{
    delete_missing_greader_folders, delete_missing_greader_subscriptions,
    is_provider_managed_greader_feed,
    pending_mutation_ids_targeting_provider_managed_greader_feeds,
    resolve_greader_folder_sort_order, resolve_greader_subscription_folder_id,
    save_greader_subscriptions,
};
#[cfg(test)]
use unread::reconcile_greader_unread_counts;

/// Keep provider feed diagnostics to the host class allowed by the privacy policy.
///
/// The input may be a persisted feed URL or a GReader remote feed identifier
/// (`feed/<url>`). Neither form is safe to include in a release log.
pub(super) fn redacted_feed_host_class(value: &str) -> &'static str {
    let candidate = value.strip_prefix(GREADER_FEED_ID_PREFIX).unwrap_or(value);
    let Ok(url) = Url::parse(candidate) else {
        return "invalid";
    };

    if !matches!(url.scheme(), "http" | "https") {
        return "invalid";
    }

    match url.host_str() {
        Some(host) if is_private_host(host) => "private",
        Some(_) => "public",
        None => "invalid",
    }
}

pub(super) async fn get_greader_password(account: &Account) -> Result<String, AppError> {
    get_greader_password_with_reader(
        account.id.as_ref(),
        CredentialLookupMode::Background,
        |account_id| keyring_store::get_password_for_sync(&account_id),
    )
    .await
}

pub(super) async fn get_greader_password_interactive(
    account: &Account,
) -> Result<String, AppError> {
    get_greader_password_with_reader(
        account.id.as_ref(),
        CredentialLookupMode::Interactive,
        |account_id| {
            keyring_store::get_password_for_sync_with_mode(
                &account_id,
                CredentialLookupMode::Interactive,
            )
        },
    )
    .await
}

async fn get_greader_password_with_reader<F>(
    account_id: &str,
    mode: CredentialLookupMode,
    read_password: F,
) -> Result<String, AppError>
where
    F: FnOnce(String) -> DomainResult<String> + Send + 'static,
{
    let account_id = account_id.to_string();
    #[cfg(target_os = "macos")]
    {
        keyring_store::read_for_sync(
            keyring_store::CredentialKind::FreshRssPassword,
            mode,
            move || read_password(account_id),
        )
        .await
        .map_err(AppError::from)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = mode;
        get_greader_password_with_timeout(account_id, Duration::from_secs(10), read_password).await
    }
}

#[cfg(not(target_os = "macos"))]
async fn get_greader_password_with_timeout<F>(
    account_id: String,
    timeout: Duration,
    read_password: F,
) -> Result<String, AppError>
where
    F: FnOnce(String) -> DomainResult<String> + Send + 'static,
{
    // Native calls retain their legacy caller cutoff; it does not cancel blocking work.
    tokio::time::timeout(timeout, tokio::task::spawn_blocking(move || read_password(account_id)))
        .await
        .map_err(|_| AppError::from(DomainError::Keychain(
            "Timed out reading password from the OS credential store. Unlock it or re-enter the account password, then try again.".into(),
        )))?
        .map_err(|error| AppError::from(DomainError::Keychain(format!(
            "Failed to read password from the OS credential store: {error}"
        ))))?
        .map_err(AppError::from)
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct ProviderSyncOutcome {
    pub warnings: Vec<ProviderSyncWarning>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ProviderSyncWarning {
    pub kind: AccountSyncWarningKind,
    pub message: String,
    pub retry_at: Option<String>,
    pub retry_in_seconds: Option<u64>,
    pub detail: AccountSyncWarningDetail,
}

#[cfg(test)]
mod tests;
