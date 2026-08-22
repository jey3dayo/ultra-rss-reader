#[cfg(test)]
use std::collections::{HashMap, HashSet};
#[cfg(test)]
use std::sync::Mutex;
use std::time::Duration;
#[cfg(test)]
use std::time::Instant;

use tracing::warn;

use crate::commands::dto::{AccountSyncWarningKind, AppError};
use crate::domain::account::Account;
#[cfg(test)]
use crate::domain::article::generate_entry_id;
#[cfg(test)]
use crate::domain::article::Article;
use crate::domain::error::{DomainError, DomainResult};
#[cfg(test)]
use crate::domain::feed::Feed;
#[cfg(test)]
use crate::domain::folder::Folder;
#[cfg(test)]
use crate::domain::provider::RemoteFolder;
#[cfg(test)]
use crate::domain::provider::{RemoteSubscription, SyncCursor};
#[cfg(test)]
use crate::domain::types::ArticleId;
#[cfg(test)]
use crate::domain::types::{AccountId, FeedId, FolderId};
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
use crate::infra::keyring_store;
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
#[cfg(test)]
use account::{
    apply_remote_state_with_protection, deleted_greader_folders_warning,
    dropped_pending_mutation_warning, pending_mutation_retry_warning,
    save_greader_folders_snapshot, sync_greader_account_entries, sync_greader_feed_entries,
};
pub(super) use account::{
    pending_remote_ids_by_axis, repair_greader_remote_state, sync_greader_account,
    sync_greader_feed,
};

mod local;

pub(super) use local::sync_local_feed;
#[cfg(test)]
use local::{local_feed_scope_key, upsert_articles_in_current_transaction};

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

const G_READER_PASSWORD_LOOKUP_TIMEOUT: Duration = Duration::from_secs(10);

pub(super) async fn get_greader_password(account: &Account) -> Result<String, AppError> {
    get_greader_password_with_timeout(
        account.id.as_ref(),
        &account.name,
        G_READER_PASSWORD_LOOKUP_TIMEOUT,
        |account_id| keyring_store::get_password_for_sync(&account_id),
    )
    .await
}

async fn get_greader_password_with_timeout<F>(
    account_id: &str,
    account_name: &str,
    timeout_duration: Duration,
    read_password: F,
) -> Result<String, AppError>
where
    F: FnOnce(String) -> DomainResult<String> + Send + 'static,
{
    let account_id = account_id.to_string();
    let account_name = account_name.to_string();
    let account_id_for_log = account_id.clone();
    match tokio::time::timeout(
        timeout_duration,
        tokio::task::spawn_blocking(move || read_password(account_id)),
    )
    .await
    {
        Ok(Ok(Ok(password))) => Ok(password),
        Ok(Ok(Err(error))) => Err(AppError::from(error)),
        Ok(Err(error)) => Err(AppError::from(DomainError::Keychain(format!(
            "Failed to read password from macOS Keychain: {error}"
        )))),
        Err(_) => {
            warn!(
                account_id = %account_id_for_log,
                account_name = %account_name,
                timeout_ms = timeout_duration.as_millis() as u64,
                "Timed out reading FreshRSS password from macOS Keychain"
            );
            Err(AppError::from(DomainError::Keychain(
                "Timed out reading password from macOS Keychain. Unlock Keychain Access or re-enter the account password, then try again.".to_string(),
            )))
        }
    }
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
}

#[cfg(test)]
mod tests;
