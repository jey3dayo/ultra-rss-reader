//! Account-level provider synchronization and remote-state reconciliation.
///
/// The pending-mutation read and remote-state apply must remain in the same
/// database lock scope. See `.claude/rules/remote-state-reconciliation.md`.
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::Instant;

use tracing::{info, warn};

use crate::commands::dto::{AccountSyncWarningDetail, AccountSyncWarningKind, AppError};
use crate::domain::account::Account;
use crate::domain::article::Article;
use crate::domain::feed::Feed;
use crate::domain::folder::Folder;
use crate::domain::provider::{
    FeedIdentifier, Mutation, PullScope, RemoteFolder, GREADER_FEED_ID_PREFIX,
};
use crate::domain::types::{AccountId, FeedId, FolderId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_folder::SqliteFolderRepository;
use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::local::LocalProvider;
use crate::infra::provider::traits::{Credentials, FeedProvider};
use crate::repository::article::ArticleRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;
use crate::repository::pending_mutation::{
    PendingMutation, PendingMutationAxis, PendingMutationRepository, PendingMutationType,
};
use crate::repository::sync_state::{SyncState, SyncStateRepository, SyncStateScopeKey};
use crate::service::article_materializer::article_from_remote_entry;

use super::local::sync_local_feed;
use super::state::{
    article_count_for_feed, cursor_from_state, feed_scope_key, load_sync_state,
    mark_remote_state_sync_completed, save_greader_sync_failure_state, save_sync_state,
    should_pull_remote_state, sync_state_timestamp_usec, update_latest_timestamp_usec,
    update_latest_timestamp_usec_from_entries,
};
use super::subscriptions::{
    delete_missing_greader_folders, delete_missing_greader_subscriptions, folder_name_case_key,
    is_provider_managed_greader_feed,
    pending_mutation_ids_targeting_provider_managed_greader_feeds, pending_mutation_log_contexts,
    provider_managed_remote_feed_ids, resolve_greader_folder_sort_order,
    save_greader_subscriptions,
};
use super::unread::reconcile_greader_unread_counts;
use super::{
    get_greader_password, redacted_feed_host_class, ProviderSyncOutcome, ProviderSyncWarning,
};
use crate::commands::feed_commands::lock_db;

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

/// Read the current pending-mutation protection lists (read axis, star axis).
///
/// Must be called inside the same DB lock as `apply_remote_state`: reading the
/// snapshot before the network `pull_state()` call leaves a window where an
/// article marked read during the pull gets reverted to the stale remote state.
pub(super) fn pending_remote_ids_by_axis(
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

pub(crate) fn save_greader_folders_snapshot(
    db: &Mutex<DbManager>,
    account: &Account,
    remote_folders: &[RemoteFolder],
) -> Result<HashSet<String>, AppError> {
    let remote_folder_ids = remote_folders
        .iter()
        .filter(|folder| !folder.remote_id.trim().is_empty())
        .map(|folder| folder.remote_id.clone())
        .collect::<HashSet<_>>();
    let db_guard = lock_db(db)?;
    let folder_repo = SqliteFolderRepository::new(db_guard.writer());
    let mut local_folders = folder_repo.find_by_account(&account.id)?;
    let mut next_sort_order = local_folders
        .iter()
        .map(|folder| folder.sort_order)
        .max()
        .map_or(0, |sort_order| sort_order.saturating_add(1));

    for rf in remote_folders {
        let existing_remote_index = local_folders
            .iter()
            .position(|folder| folder.remote_id.as_deref() == Some(rf.remote_id.as_str()));
        let existing_name_index = if existing_remote_index.is_none() {
            let remote_name_key = folder_name_case_key(&rf.name);
            local_folders.iter().position(|folder| {
                folder.remote_id.is_some() && folder_name_case_key(&folder.name) == remote_name_key
            })
        } else {
            None
        };
        let existing_index = existing_remote_index.or(existing_name_index);
        let existing_folder = existing_index.and_then(|index| local_folders.get(index));
        let sort_order =
            resolve_greader_folder_sort_order(rf.sort_order, existing_folder, &mut next_sort_order);
        let folder = Folder {
            id: existing_folder
                .map(|folder| folder.id.clone())
                .unwrap_or_else(FolderId::new),
            account_id: account.id.clone(),
            remote_id: Some(rf.remote_id.clone()),
            name: rf.name.clone(),
            sort_order,
        };
        folder_repo.save(&folder)?;
        if let Some(index) = existing_index {
            local_folders[index] = folder;
        } else {
            local_folders.push(folder);
        }
    }

    Ok(remote_folder_ids)
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

pub(crate) async fn sync_greader_feed(
    db: &Mutex<DbManager>,
    account: &Account,
    feed: &Feed,
    mut provider: GReaderProvider,
) -> Result<ProviderSyncOutcome, AppError> {
    let username = match &account.username {
        Some(u) => u.clone(),
        None => {
            warn!(
                "GReader account {} has no username, skipping single-feed sync",
                account.id.as_ref()
            );
            return Ok(ProviderSyncOutcome::default());
        }
    };

    let password = get_greader_password(account).await?;
    provider
        .authenticate(&Credentials {
            token: Some(username),
            password: Some(password),
        })
        .await?;

    if !is_provider_managed_greader_feed(feed.remote_id.as_deref()) {
        let local_provider = LocalProvider::new();
        sync_local_feed(db, &local_provider, &account.id, feed).await?;
        return Ok(ProviderSyncOutcome::default());
    }

    let article_count_before = article_count_for_feed(db, &feed.id)?;
    let feed_outcome = sync_greader_feed_entries(db, &provider, account, feed).await?;
    recalculate_single_feed_unread_count(db, &feed.id)?;
    let article_count_after = article_count_for_feed(db, &feed.id)?;

    let mut warnings = Vec::new();
    if feed_outcome.skipped_entries > 0 {
        warnings.push(ProviderSyncWarning {
            kind: AccountSyncWarningKind::Generic,
            message: format!(
                "Feed '{}' skipped {} entry item(s) during sync.",
                feed.title, feed_outcome.skipped_entries
            ),
            retry_at: None,
            retry_in_seconds: None,
            detail: AccountSyncWarningDetail::FeedSkippedEntries {
                feed_title: feed.title.clone(),
                count: feed_outcome.skipped_entries,
            },
        });
    }
    if article_count_before > 0 && article_count_after == 0 {
        warnings.push(ProviderSyncWarning {
            kind: AccountSyncWarningKind::Generic,
            message: format!(
                "Feed '{}' had {} saved article(s) before sync and 0 after sync.",
                feed.title, article_count_before
            ),
            retry_at: None,
            retry_in_seconds: None,
            detail: AccountSyncWarningDetail::FeedArticlesVanished {
                feed_title: feed.title.clone(),
                count_before: article_count_before,
            },
        });
    }

    Ok(ProviderSyncOutcome { warnings })
}

pub(crate) async fn sync_greader_account_entries(
    db: &Mutex<DbManager>,
    provider: &GReaderProvider,
    account: &Account,
    feeds_by_remote_id: &HashMap<String, Feed>,
) -> Result<GReaderAccountEntriesSyncOutcome, AppError> {
    let account_scope_key = SyncStateScopeKey::greader_account_all();
    let saved_state = load_sync_state(db, &account.id, &account_scope_key)?;

    let mut cursor = cursor_from_state(saved_state.as_ref());
    let mut latest_timestamp_usec = sync_state_timestamp_usec(saved_state.as_ref());
    let mut skipped_entries = 0usize;
    let mut entries_upserted = 0usize;
    let mut delta_pages = 0usize;
    let mut seen_feed_ids = HashSet::new();

    loop {
        let result = match provider.pull_entries(PullScope::All, cursor.clone()).await {
            Ok(result) => result,
            Err(error) => {
                let app_error = AppError::from(error);
                save_greader_sync_failure_state(
                    db,
                    &account.id,
                    &account_scope_key,
                    saved_state.as_ref(),
                    latest_timestamp_usec,
                    &app_error,
                )?;
                return Err(app_error);
            }
        };
        delta_pages += 1;
        skipped_entries += result.skipped_entries;
        update_latest_timestamp_usec(&mut latest_timestamp_usec, result.next_cursor.as_ref());
        update_latest_timestamp_usec_from_entries(&mut latest_timestamp_usec, &result.entries);

        let mut articles = Vec::with_capacity(result.entries.len());
        for entry in &result.entries {
            let remote_id = match &entry.source_feed_id {
                FeedIdentifier::Remote { remote_id } => remote_id,
                FeedIdentifier::Local { .. } => {
                    skipped_entries += 1;
                    continue;
                }
            };

            let Some(feed) = feeds_by_remote_id.get(remote_id) else {
                warn!(
                    account_id = %account.id.as_ref(),
                    feed_id = "unknown",
                    host_class = redacted_feed_host_class(remote_id),
                    "Sync anomaly: no local feed mapping"
                );
                skipped_entries += 1;
                continue;
            };

            seen_feed_ids.insert(feed.id.as_ref().to_string());
            articles.push(article_from_remote_entry(&account.id, feed, entry));
        }

        if !articles.is_empty() {
            let candidate_ids = articles
                .iter()
                .map(|article| article.id.clone())
                .collect::<Vec<_>>();
            entries_upserted += articles.len();

            persist_pulled_account_articles(db, &account.id, &articles, &candidate_ids)?;
        }

        if !result.has_more {
            break;
        }
        cursor = result.next_cursor.clone();
    }

    let next_state = SyncState {
        account_id: account.id.clone(),
        scope_key: account_scope_key.as_string(),
        timestamp_usec: latest_timestamp_usec,
        continuation: None,
        etag: None,
        last_modified: None,
        last_success_at: Some(chrono::Utc::now().to_rfc3339()),
        last_error: None,
        error_count: 0,
        next_retry_at: None,
    };
    save_sync_state(db, &next_state)?;

    Ok(GReaderAccountEntriesSyncOutcome {
        skipped_entries,
        entries_upserted,
        delta_pages,
        feeds_seen: seen_feed_ids.len(),
    })
}

/// Steps 3-7: sync subscriptions, pull entries, push mutations, apply remote state, recalculate unread counts.
pub(crate) async fn sync_greader_feeds(
    db: &Mutex<DbManager>,
    provider: &GReaderProvider,
    account: &Account,
) -> Result<ProviderSyncOutcome, AppError> {
    let total_started_at = Instant::now();
    let article_counts_before = provider_managed_feed_snapshots(db, &account.id)?;
    let sync_started_remote_feed_ids = provider_managed_remote_feed_ids(db, &account.id)?;

    let folder_remote_id_map = load_folder_remote_id_map(db, &account.id)?;

    let subscriptions_started_at = Instant::now();
    let remote_subs = provider.get_subscriptions().await?;
    save_greader_subscriptions(
        db,
        account,
        &folder_remote_id_map,
        &remote_subs,
        &sync_started_remote_feed_ids,
    )?;
    let remote_subscription_ids = remote_subs
        .iter()
        .map(|subscription| subscription.remote_id.clone())
        .collect::<HashSet<_>>();
    let deleted_subscription_count =
        delete_missing_greader_subscriptions(db, account, &remote_subscription_ids)?;
    info!(
        account_id = %account.id.as_ref(),
        phase = "subscriptions",
        deleted_subscription_count = deleted_subscription_count,
        elapsed_ms = subscriptions_started_at.elapsed().as_millis() as u64,
        "FreshRSS sync phase completed"
    );

    let feeds = load_account_feeds(db, &account.id)?;

    let local_provider = LocalProvider::new();
    let mut warnings = Vec::new();
    let provider_managed_feeds = feeds
        .iter()
        .filter(|feed| is_provider_managed_greader_feed(feed.remote_id.as_deref()))
        .cloned()
        .collect::<Vec<_>>();
    let feeds_by_remote_id = provider_managed_feeds
        .iter()
        .filter_map(|feed| {
            feed.remote_id
                .clone()
                .map(|remote_id| (remote_id, feed.clone()))
        })
        .collect::<HashMap<_, _>>();

    let account_entries_started_at = Instant::now();
    let mut account_entries_outcome = GReaderAccountEntriesSyncOutcome::default();
    if !feeds_by_remote_id.is_empty() {
        account_entries_outcome =
            sync_greader_account_entries(db, provider, account, &feeds_by_remote_id).await?;
        if account_entries_outcome.skipped_entries > 0 {
            warnings.push(ProviderSyncWarning {
                kind: AccountSyncWarningKind::Generic,
                message: format!(
                    "Account '{}' skipped {} entry item(s) during sync.",
                    account.name, account_entries_outcome.skipped_entries
                ),
                retry_at: None,
                retry_in_seconds: None,
                detail: AccountSyncWarningDetail::AccountSkippedEntries {
                    account_name: account.name.clone(),
                    count: account_entries_outcome.skipped_entries,
                },
            });
        }
    }
    for feed in &feeds {
        if is_provider_managed_greader_feed(feed.remote_id.as_deref()) {
            continue;
        }
        if let Err(error) = sync_local_feed(db, &local_provider, &account.id, feed).await {
            warn!(
                account_id = %account.id.as_ref(),
                feed_id = %feed.id.as_ref(),
                host_class = redacted_feed_host_class(&feed.url),
                reason = "provider_error",
                "Failed to pull entries for local feed"
            );
            warnings.push(ProviderSyncWarning {
                kind: AccountSyncWarningKind::Generic,
                message: format!(
                    "Local feed '{}' failed during provider sync: {error}",
                    feed.title
                ),
                retry_at: None,
                retry_in_seconds: None,
                detail: AccountSyncWarningDetail::LocalFeedSyncFailed {
                    feed_title: feed.title.clone(),
                    message: error.to_string(),
                },
            });
        }
    }
    info!(
        account_id = %account.id.as_ref(),
        phase = "account_delta_entries",
        elapsed_ms = account_entries_started_at.elapsed().as_millis() as u64,
        feeds_seen = account_entries_outcome.feeds_seen,
        entries_upserted = account_entries_outcome.entries_upserted,
        delta_pages = account_entries_outcome.delta_pages,
        skipped_entries = account_entries_outcome.skipped_entries,
        "FreshRSS sync phase completed"
    );

    let pending_mutations = load_pending_mutations_for_account(db, &account.id)?;
    let provider_managed_pending_mutation_ids =
        pending_mutation_ids_targeting_provider_managed_greader_feeds(db, &account.id)?;
    let pending_mutation_contexts = pending_mutation_log_contexts(db, &account.id)?;

    let mut pushed_read_remote_ids: Vec<String> = Vec::new();
    let mut pushed_starred_remote_ids: Vec<String> = Vec::new();
    for pm in &pending_mutations {
        let Some(pending_mutation_id) = pm.id else {
            continue;
        };
        let (feed_id, host_class) = pending_mutation_contexts
            .get(&pending_mutation_id)
            .map(|(feed_id, host_class)| (feed_id.as_ref(), *host_class))
            .unwrap_or(("unknown", "invalid"));

        if !provider_managed_pending_mutation_ids.contains(&pending_mutation_id) {
            warn!(
                account_id = %account.id.as_ref(),
                feed_id,
                host_class,
                mutation_type = pm.mutation_type.as_str(),
                reason = "non_greader_feed",
                "Dropping pending mutation"
            );
            warnings.push(dropped_pending_mutation_warning(pm.mutation_type));
            delete_pending_mutation(db, pending_mutation_id)?;
            continue;
        }

        let mutation = match pm.mutation_type {
            PendingMutationType::MarkRead => Mutation::MarkRead {
                remote_entry_id: pm.remote_entry_id.clone(),
            },
            PendingMutationType::MarkUnread => Mutation::MarkUnread {
                remote_entry_id: pm.remote_entry_id.clone(),
            },
            PendingMutationType::Star => Mutation::SetStarred {
                remote_entry_id: pm.remote_entry_id.clone(),
                starred: true,
            },
            PendingMutationType::Unstar => Mutation::SetStarred {
                remote_entry_id: pm.remote_entry_id.clone(),
                starred: false,
            },
        };

        match provider.push_mutations(&[mutation]).await {
            Ok(()) => {
                match pm.mutation_type.axis() {
                    PendingMutationAxis::ReadState => {
                        pushed_read_remote_ids.push(pm.remote_entry_id.clone());
                    }
                    PendingMutationAxis::StarState => {
                        pushed_starred_remote_ids.push(pm.remote_entry_id.clone());
                    }
                }
                delete_pending_mutation(db, pending_mutation_id)?;
            }
            Err(_) => {
                warn!(
                    account_id = %account.id.as_ref(),
                    feed_id,
                    host_class,
                    mutation_type = pm.mutation_type.as_str(),
                    reason = "provider_error",
                    "Failed to push pending mutation; will retry next sync"
                );
                warnings.push(pending_mutation_retry_warning(pm.mutation_type));
            }
        }
    }

    let pull_state_started_at = Instant::now();
    let now = chrono::Utc::now();
    let should_pull_remote_state = should_pull_remote_state(db, &account.id, now)?;
    if should_pull_remote_state {
        let remote_state = provider.pull_state().await?;
        apply_remote_state_with_protection(
            db,
            &account.id,
            &remote_state.read_ids,
            &remote_state.starred_ids,
            &pushed_read_remote_ids,
            &pushed_starred_remote_ids,
        )?;
        mark_remote_state_sync_completed(db, &account.id, now)?;
    }
    info!(
        account_id = %account.id.as_ref(),
        phase = "pull_state",
        elapsed_ms = pull_state_started_at.elapsed().as_millis() as u64,
        skipped = !should_pull_remote_state,
        "FreshRSS sync phase completed"
    );

    recalculate_feed_unread_counts(db, &feeds)?;

    let unread_reconcile_started_at = Instant::now();
    let server_unread_counts = provider.get_unread_count_map().await?;
    let backfilled_feeds =
        reconcile_greader_unread_counts(db, provider, account, &feeds, &server_unread_counts)
            .await?;
    info!(
        account_id = %account.id.as_ref(),
        phase = "unread_reconcile",
        elapsed_ms = unread_reconcile_started_at.elapsed().as_millis() as u64,
        backfilled_feeds,
        "FreshRSS sync phase completed"
    );

    let article_counts_after = provider_managed_feed_snapshots(db, &account.id)?;
    for feed in &feeds {
        if !is_provider_managed_greader_feed(feed.remote_id.as_deref()) {
            continue;
        }

        let before_count = article_counts_before
            .get(feed.id.as_ref())
            .map(|snapshot| snapshot.article_count)
            .unwrap_or(0);
        let after_count = article_counts_after
            .get(feed.id.as_ref())
            .map(|snapshot| snapshot.article_count)
            .unwrap_or(0);

        if before_count > 0 && after_count == 0 {
            warn!(
                account_id = %account.id.as_ref(),
                feed_id = %feed.id.as_ref(),
                host_class = redacted_feed_host_class(&feed.url),
                before_count,
                after_count,
                "Sync anomaly: article count dropped after sync"
            );
            warnings.push(ProviderSyncWarning {
                kind: AccountSyncWarningKind::Generic,
                message: format!(
                    "Feed '{}' had {} saved article(s) before sync and 0 after sync.",
                    feed.title, before_count
                ),
                retry_at: None,
                retry_in_seconds: None,
                detail: AccountSyncWarningDetail::FeedArticlesVanished {
                    feed_title: feed.title.clone(),
                    count_before: before_count,
                },
            });
        }
    }

    info!(
        account_id = %account.id.as_ref(),
        accounts = 1,
        feeds_seen = account_entries_outcome.feeds_seen,
        entries_upserted = account_entries_outcome.entries_upserted,
        delta_pages = account_entries_outcome.delta_pages,
        backfilled_feeds,
        warnings = warnings.len(),
        elapsed_ms = total_started_at.elapsed().as_millis() as u64,
        "FreshRSS sync summary"
    );

    Ok(ProviderSyncOutcome { warnings })
}

pub(crate) async fn sync_greader_feed_entries(
    db: &Mutex<DbManager>,
    provider: &GReaderProvider,
    account: &Account,
    feed: &Feed,
) -> Result<GReaderFeedSyncOutcome, AppError> {
    let Some(remote_id) = feed.remote_id.as_ref() else {
        return Ok(GReaderFeedSyncOutcome::default());
    };

    let scope_key = feed_scope_key(remote_id);
    let saved_state = load_feed_sync_state(db, &account.id, &scope_key)?;
    let initial_cursor = cursor_from_state(saved_state.as_ref());
    let mut cursor = initial_cursor.clone();
    let mut latest_timestamp_usec = sync_state_timestamp_usec(saved_state.as_ref());
    let mut skipped_entries = 0usize;

    loop {
        let scope = PullScope::Feed(FeedIdentifier::Remote {
            remote_id: remote_id.clone(),
        });
        let result = match provider.pull_entries(scope, cursor.clone()).await {
            Ok(result) => result,
            Err(error) => {
                let app_error = AppError::from(error);
                save_greader_sync_failure_state(
                    db,
                    &account.id,
                    &scope_key,
                    saved_state.as_ref(),
                    latest_timestamp_usec,
                    &app_error,
                )?;
                return Err(app_error);
            }
        };
        skipped_entries += result.skipped_entries;

        update_latest_timestamp_usec(&mut latest_timestamp_usec, result.next_cursor.as_ref());
        update_latest_timestamp_usec_from_entries(&mut latest_timestamp_usec, &result.entries);

        let articles: Vec<Article> = result
            .entries
            .iter()
            .map(|entry| article_from_remote_entry(&account.id, feed, entry))
            .collect();

        if !articles.is_empty() {
            persist_pulled_feed_articles(db, &account.id, &articles)?;
        }

        if !result.has_more {
            break;
        }

        cursor = result.next_cursor.clone();
    }

    let next_state = SyncState {
        account_id: account.id.clone(),
        scope_key: scope_key.as_string(),
        timestamp_usec: latest_timestamp_usec,
        continuation: None,
        // GReader delta sync is driven by continuation + `ot`; HTTP validators
        // are reserved for non-GReader providers and should not linger here.
        etag: None,
        last_modified: None,
        last_success_at: Some(chrono::Utc::now().to_rfc3339()),
        last_error: None,
        error_count: 0,
        next_retry_at: None,
    };
    save_feed_sync_state(db, &next_state)?;

    Ok(GReaderFeedSyncOutcome { skipped_entries })
}

pub(crate) fn provider_managed_feed_snapshots(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> Result<HashMap<String, ProviderManagedFeedSnapshot>, AppError> {
    let db_guard = lock_db(db)?;
    let mut stmt = db_guard
        .reader()
        .prepare(&format!(
            "SELECT f.id, f.title, COUNT(a.id)
         FROM feeds f
         LEFT JOIN articles a ON a.feed_id = f.id
         WHERE f.account_id = ?1 AND f.remote_id LIKE '{GREADER_FEED_ID_PREFIX}%'
         GROUP BY f.id, f.title"
        ))
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)?;

    let rows = stmt
        .query_map(rusqlite::params![account_id.as_ref()], |row| {
            Ok((
                row.get::<_, String>(0)?,
                ProviderManagedFeedSnapshot {
                    article_count: row.get::<_, i64>(2)? as usize,
                },
            ))
        })
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)?;

    rows.collect::<Result<HashMap<_, _>, _>>()
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)
}

/// Read all feeds owned by `account_id` inside a single reader lock scope.
fn load_account_feeds(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> Result<Vec<Feed>, AppError> {
    let db_guard = lock_db(db)?;
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    Ok(feed_repo.find_by_account(account_id)?)
}

/// Recalculate unread counts for the GReader provider-managed subset of
/// `feeds`, inside a single writer lock scope.
fn recalculate_provider_managed_feed_unread_counts(
    db: &Mutex<DbManager>,
    feeds: &[Feed],
) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    let managed_feed_ids: Vec<FeedId> = feeds
        .iter()
        .filter(|feed| is_provider_managed_greader_feed(feed.remote_id.as_deref()))
        .map(|feed| feed.id.clone())
        .collect();
    feed_repo.recalculate_unread_counts(&managed_feed_ids)?;
    Ok(())
}

/// Recalculate the unread count for a single feed, inside a single writer
/// lock scope.
fn recalculate_single_feed_unread_count(
    db: &Mutex<DbManager>,
    feed_id: &FeedId,
) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    feed_repo.recalculate_unread_count(feed_id)?;
    Ok(())
}

/// Recalculate unread counts for every feed in `feeds`, inside a single
/// writer lock scope.
fn recalculate_feed_unread_counts(db: &Mutex<DbManager>, feeds: &[Feed]) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    let feed_ids: Vec<FeedId> = feeds.iter().map(|feed| feed.id.clone()).collect();
    feed_repo.recalculate_unread_counts(&feed_ids)?;
    Ok(())
}

/// Persist articles pulled for a full-account delta sync and clear their
/// muted-unread state, inside a single writer lock scope.
fn persist_pulled_account_articles(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    articles: &[Article],
    candidate_ids: &[crate::domain::types::ArticleId],
) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let article_repo = SqliteArticleRepository::new(db_guard.writer());
    article_repo.upsert(articles)?;
    article_repo.mark_muted_unread_as_read(account_id, Some(candidate_ids))?;
    Ok(())
}

/// Persist articles pulled for a single-feed sync and clear their
/// muted-unread state, inside a single writer lock scope.
fn persist_pulled_feed_articles(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    articles: &[Article],
) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let article_repo = SqliteArticleRepository::new(db_guard.writer());
    article_repo.upsert(articles)?;
    let candidate_ids = articles
        .iter()
        .map(|article| article.id.clone())
        .collect::<Vec<_>>();
    article_repo.mark_muted_unread_as_read(account_id, Some(&candidate_ids))?;
    Ok(())
}

/// Read the folder-id-by-remote-id map for `account_id`, inside a single
/// reader lock scope.
fn load_folder_remote_id_map(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> Result<HashMap<String, FolderId>, AppError> {
    let db_guard = lock_db(db)?;
    let folder_repo = SqliteFolderRepository::new(db_guard.reader());
    let folders = folder_repo.find_by_account(account_id)?;
    Ok(folders
        .into_iter()
        .filter_map(|folder| folder.remote_id.map(|remote_id| (remote_id, folder.id)))
        .collect())
}

/// Read all pending mutations for `account_id`, inside a single reader lock
/// scope.
fn load_pending_mutations_for_account(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> Result<Vec<PendingMutation>, AppError> {
    let db_guard = lock_db(db)?;
    let pending_repo = SqlitePendingMutationRepository::new(db_guard.reader());
    Ok(pending_repo.find_by_account(account_id)?)
}

/// Delete a single pending mutation by id, inside a single writer lock
/// scope. Shared by the dropped-mutation and successfully-pushed-mutation
/// paths in `sync_greader_feeds`.
fn delete_pending_mutation(db: &Mutex<DbManager>, mutation_id: i64) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let pending_repo = SqlitePendingMutationRepository::new(db_guard.writer());
    pending_repo.delete(&[mutation_id])?;
    Ok(())
}

/// Read the saved sync state for a single feed, inside a single reader lock
/// scope.
fn load_feed_sync_state(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    scope_key: &SyncStateScopeKey,
) -> Result<Option<SyncState>, AppError> {
    let db_guard = lock_db(db)?;
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    Ok(sync_state_repo.get(account_id, scope_key)?)
}

/// Save the updated sync state for a single feed, inside a single writer
/// lock scope.
fn save_feed_sync_state(db: &Mutex<DbManager>, next_state: &SyncState) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
    Ok(sync_state_repo.save(next_state)?)
}
