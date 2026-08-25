//! Per-account and per-feed GReader sync orchestration: subscriptions, pull
//! entries, push local mutations, apply remote state, recalculate unread
//! counts.
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::Instant;

use tracing::{info, warn};

use crate::commands::dto::{AccountSyncWarningDetail, AccountSyncWarningKind, AppError};
use crate::domain::account::Account;
use crate::domain::feed::Feed;
use crate::domain::provider::Mutation;
use crate::infra::db::connection::DbManager;
use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::local::LocalProvider;
use crate::infra::provider::traits::{Credentials, FeedProvider};
use crate::repository::pending_mutation::{PendingMutationAxis, PendingMutationType};

use super::super::local::sync_local_feed;
use super::super::state::{
    article_count_for_feed, mark_remote_state_sync_completed, should_pull_remote_state,
};
use super::super::subscriptions::{
    delete_missing_greader_subscriptions, is_provider_managed_greader_feed,
    pending_mutation_ids_targeting_provider_managed_greader_feeds, pending_mutation_log_contexts,
    provider_managed_remote_feed_ids, save_greader_subscriptions,
};
use super::super::unread::reconcile_greader_unread_counts;
use super::super::{
    get_greader_password, redacted_feed_host_class, ProviderSyncOutcome, ProviderSyncWarning,
};
use super::db::{
    delete_pending_mutation, load_account_feeds, load_folder_remote_id_map,
    load_pending_mutations_for_account, provider_managed_feed_snapshots,
    recalculate_feed_unread_counts, recalculate_single_feed_unread_count,
};
use super::entries::{sync_greader_account_entries, sync_greader_feed_entries};
use super::remote_state::apply_remote_state_with_protection;
use super::warnings::{dropped_pending_mutation_warning, pending_mutation_retry_warning};
use super::GReaderAccountEntriesSyncOutcome;

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
    let backfilled_feeds = reconcile_greader_unread_counts(
        db,
        provider,
        account,
        &feeds,
        &server_unread_counts,
        &pushed_read_remote_ids,
    )
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
