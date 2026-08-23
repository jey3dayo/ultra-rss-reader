//! The sanctioned remote-state apply path.
//!
//! `apply_remote_state_with_protection` and `pending_remote_ids_by_axis` must
//! stay in this one file: the protection-list read and the apply must happen
//! inside the same DB lock scope. See
//! `.claude/rules/remote-state-reconciliation.md`.
use std::sync::Mutex;

use tracing::warn;

use crate::commands::dto::AppError;
use crate::commands::feed_commands::lock_db;
use crate::domain::account::Account;
use crate::domain::types::AccountId;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::traits::{Credentials, FeedProvider};
use crate::repository::article::ArticleRepository;
use crate::repository::pending_mutation::{PendingMutationAxis, PendingMutationRepository};

use super::super::get_greader_password;
use super::super::state::mark_remote_state_sync_completed;
use super::super::unread::reconcile_greader_unread_counts;
use super::db::{load_account_feeds, recalculate_provider_managed_feed_unread_counts};

/// Read the current pending-mutation protection lists (read axis, star axis).
///
/// Must be called inside the same DB lock as `apply_remote_state`: reading the
/// snapshot before the network `pull_state()` call leaves a window where an
/// article marked read during the pull gets reverted to the stale remote state.
pub(crate) fn pending_remote_ids_by_axis(
    conn: &rusqlite::Connection,
    account_id: &AccountId,
) -> Result<(Vec<String>, Vec<String>), AppError> {
    let pending_repo = SqlitePendingMutationRepository::new(conn);
    let pending = pending_repo.find_by_account(account_id)?;
    let read_ids = pending
        .iter()
        .filter(|pm| pm.mutation_type.axis() == PendingMutationAxis::ReadState)
        .map(|pm| pm.remote_entry_id.clone())
        .collect();
    let starred_ids = pending
        .iter()
        .filter(|pm| pm.mutation_type.axis() == PendingMutationAxis::StarState)
        .map(|pm| pm.remote_entry_id.clone())
        .collect();
    Ok((read_ids, starred_ids))
}

/// The only sanctioned way to overwrite local state with remote state.
///
/// Acquires the DB lock, re-reads the pending-mutation protection lists
/// inside that same lock, merges `extra_protected_(read|starred)_ids` (e.g.
/// mutations pushed earlier in this sync), then applies. See
/// `.claude/rules/remote-state-reconciliation.md`: the protection snapshot
/// must never be read before an `.await` (such as `pull_state()`) that
/// precedes the apply, since a local mutation made in that window would be
/// reverted to the stale remote state.
pub(crate) fn apply_remote_state_with_protection(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    read_ids: &[String],
    starred_ids: &[String],
    extra_protected_read_ids: &[String],
    extra_protected_starred_ids: &[String],
) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let (mut pending_read_remote_ids, mut pending_starred_remote_ids) =
        pending_remote_ids_by_axis(db_guard.reader(), account_id)?;
    pending_read_remote_ids.extend(extra_protected_read_ids.iter().cloned());
    pending_read_remote_ids.sort();
    pending_read_remote_ids.dedup();
    pending_starred_remote_ids.extend(extra_protected_starred_ids.iter().cloned());
    pending_starred_remote_ids.sort();
    pending_starred_remote_ids.dedup();

    let article_repo = SqliteArticleRepository::new(db_guard.writer());
    article_repo
        .apply_remote_state(
            account_id,
            read_ids,
            starred_ids,
            &pending_read_remote_ids,
            &pending_starred_remote_ids,
        )
        .map_err(AppError::from)
}

pub(crate) async fn repair_greader_remote_state(
    db: &Mutex<DbManager>,
    account: &Account,
    mut provider: GReaderProvider,
) -> Result<(), AppError> {
    let now = chrono::Utc::now();
    let username = match &account.username {
        Some(u) => u.clone(),
        None => {
            warn!(
                "GReader account {} has no username, skipping remote-state repair",
                account.id.as_ref()
            );
            return Ok(());
        }
    };

    let password = get_greader_password(account).await?;
    provider
        .authenticate(&Credentials {
            token: Some(username),
            password: Some(password),
        })
        .await?;

    let remote_state = provider.pull_state().await?;
    apply_remote_state_with_protection(
        db,
        &account.id,
        &remote_state.read_ids,
        &remote_state.starred_ids,
        &[],
        &[],
    )?;
    let feeds = load_account_feeds(db, &account.id)?;
    recalculate_provider_managed_feed_unread_counts(db, &feeds)?;

    let server_unread_counts = provider.get_unread_count_map().await?;
    let _ = reconcile_greader_unread_counts(db, &provider, account, &feeds, &server_unread_counts)
        .await?;
    mark_remote_state_sync_completed(db, &account.id, now)?;

    Ok(())
}
