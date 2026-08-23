//! Account-level provider synchronization and remote-state reconciliation.
//!
//! The pending-mutation read and remote-state apply must remain in the same
//! database lock scope. See `.claude/rules/remote-state-reconciliation.md`.
//!
//! Split by responsibility (each submodule still respects that lock-scope
//! contract):
//! - `warnings`: sync warning constructors.
//! - `remote_state`: `pending_remote_ids_by_axis`, the sanctioned
//!   `apply_remote_state_with_protection` apply path, and the repair entry
//!   point. `apply_remote_state_with_protection` stays paired with
//!   `pending_remote_ids_by_axis` in that one file, since the two must be
//!   re-read and applied inside the same DB lock
//!   (`.claude/rules/remote-state-reconciliation.md`).
//! - `feeds`: per-account and per-feed GReader sync orchestration.
//! - `entries`: GReader entry pull/persist for account-wide and single-feed
//!   scopes.
//! - `db`: named single-purpose DB-lock scopes shared by the orchestrators
//!   above (plan 025 lock-scope audit surface).
use std::sync::Mutex;
use std::time::Instant;

use tracing::{info, warn};

use crate::commands::dto::AppError;
use crate::domain::account::Account;
use crate::infra::db::connection::DbManager;
use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::traits::{Credentials, FeedProvider};

use super::subscriptions::delete_missing_greader_folders;
use super::{get_greader_password, ProviderSyncOutcome};

mod db;
mod entries;
mod feeds;
mod remote_state;
mod warnings;

use feeds::sync_greader_feeds;

pub(crate) use db::save_greader_folders_snapshot;
pub(crate) use feeds::sync_greader_feed;
pub(crate) use remote_state::{pending_remote_ids_by_axis, repair_greader_remote_state};
pub(crate) use warnings::deleted_greader_folders_warning;

// Re-exported only for `#[cfg(test)]` consumers in `sync_providers::tests`
// (via `sync_providers/mod.rs`'s `#[cfg(test)] use account::{...};`).
// `provider_managed_feed_snapshots` is not re-exported at all: nothing
// outside this module reaches it through an `account::` path (production
// callers in `feeds.rs` use `super::db::provider_managed_feed_snapshots`
// directly, and no test does either).
#[cfg(test)]
pub(crate) use entries::{sync_greader_account_entries, sync_greader_feed_entries};
#[cfg(test)]
pub(crate) use remote_state::apply_remote_state_with_protection;
#[cfg(test)]
pub(crate) use warnings::{dropped_pending_mutation_warning, pending_mutation_retry_warning};

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct GReaderFeedSyncOutcome {
    skipped_entries: usize,
}

#[derive(Debug, Clone)]
pub(crate) struct ProviderManagedFeedSnapshot {
    article_count: usize,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct GReaderAccountEntriesSyncOutcome {
    skipped_entries: usize,
    entries_upserted: usize,
    delta_pages: usize,
    feeds_seen: usize,
}

/// Sync a GReader-compatible account: authenticate, sync folders, subscriptions, entries, state, unread counts.
pub(crate) async fn sync_greader_account(
    db: &Mutex<DbManager>,
    account: &Account,
    mut provider: GReaderProvider,
) -> Result<ProviderSyncOutcome, AppError> {
    let total_started_at = Instant::now();

    let username = match &account.username {
        Some(u) => u.clone(),
        None => {
            warn!(
                "GReader account {} has no username, skipping",
                account.id.as_ref()
            );
            return Ok(ProviderSyncOutcome::default());
        }
    };

    // Step 1: Authenticate (no DB lock)
    let auth_started_at = Instant::now();
    let password = get_greader_password(account).await?;
    provider
        .authenticate(&Credentials {
            token: Some(username),
            password: Some(password),
        })
        .await?;
    info!(
        account_id = %account.id.as_ref(),
        phase = "auth",
        elapsed_ms = auth_started_at.elapsed().as_millis() as u64,
        "FreshRSS sync phase completed"
    );

    // Step 2: Sync folders. A successful get_folders response is a complete
    // snapshot; stale folders are reconciled after the account sync succeeds.
    let folders_started_at = Instant::now();
    let remote_folders = provider.get_folders().await?;
    let remote_folder_ids = save_greader_folders_snapshot(db, account, &remote_folders)?;
    info!(
        account_id = %account.id.as_ref(),
        phase = "folders",
        remote_folder_count = remote_folder_ids.len(),
        elapsed_ms = folders_started_at.elapsed().as_millis() as u64,
        "FreshRSS sync phase completed"
    );

    // Steps 3-7
    let mut outcome = sync_greader_feeds(db, &provider, account).await?;
    let folder_cleanup_started_at = Instant::now();
    let deleted_folder_count = delete_missing_greader_folders(db, account, &remote_folder_ids)?;
    if deleted_folder_count > 0 {
        outcome
            .warnings
            .insert(0, deleted_greader_folders_warning(deleted_folder_count));
    }
    info!(
        account_id = %account.id.as_ref(),
        phase = "folder_cleanup",
        deleted_folder_count,
        elapsed_ms = folder_cleanup_started_at.elapsed().as_millis() as u64,
        "FreshRSS sync phase completed"
    );

    info!(
        account_id = %account.id.as_ref(),
        phase = "total",
        elapsed_ms = total_started_at.elapsed().as_millis() as u64,
        "FreshRSS sync phase completed"
    );

    Ok(outcome)
}
