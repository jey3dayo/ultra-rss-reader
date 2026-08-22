use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use crate::commands::dto::AppError;
use crate::commands::feed_commands::lock_db;
use crate::domain::account::Account;
use crate::domain::article::Article;
use crate::domain::feed::Feed;
use crate::domain::provider::SyncCursor;
use crate::domain::types::FeedId;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_article::mark_muted_unread_as_read_for_feed_with_conn;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::{unread_counts_for_feed_ids_with_conn, SqliteFeedRepository};
use crate::infra::provider::greader::{GReaderProvider, UnreadPullTermination};
use crate::repository::article::ArticleRepository;
use crate::repository::feed::FeedRepository;

use super::redacted_feed_host_class;
use super::subscriptions::is_provider_managed_greader_feed;
use crate::service::article_materializer::article_from_remote_entry;

const MAX_UNREAD_RECONCILE_PAGES: usize = 100;
// GReader returns at most 200 stream entries per page and this path accepts at
// most 100 pages, so 20,000 entries is the effective upper bound.
const MAX_UNREAD_RECONCILE_ENTRIES: usize = 20_000;

enum ReconcileOutcome {
    Applied,
    SkippedIncomplete,
}

struct CompleteUnreadSnapshot {
    ids: HashSet<String>,
    articles: Vec<Article>,
    pages: usize,
    entries: usize,
}

enum UnreadSnapshot {
    Complete(CompleteUnreadSnapshot),
    Incomplete,
}

pub(super) async fn reconcile_greader_unread_counts(
    db: &Mutex<DbManager>,
    provider: &GReaderProvider,
    account: &Account,
    feeds: &[Feed],
    server_unread_counts: &HashMap<String, i32>,
) -> Result<usize, AppError> {
    let target_feeds: Vec<&Feed> = feeds
        .iter()
        .filter(|feed| is_provider_managed_greader_feed(feed.remote_id.as_deref()))
        .collect();

    if target_feeds.is_empty() {
        return Ok(0);
    }

    let target_feed_ids: Vec<FeedId> = target_feeds.iter().map(|feed| feed.id.clone()).collect();
    let local_unread_counts = fetch_local_unread_counts(db, &target_feed_ids)?;

    let mut backfilled_feeds = 0usize;
    let mut first_error: Option<AppError> = None;
    for feed in &target_feeds {
        let Some(remote_id) = feed.remote_id.as_deref() else {
            continue;
        };
        let Some(server_unread_count) = server_unread_counts.get(remote_id).copied() else {
            tracing::warn!(
                account_id = %account.id.as_ref(),
                feed_id = %feed.id.as_ref(),
                host_class = redacted_feed_host_class(&feed.url),
                reason = "missing_unread_count",
                page = 0,
                entries = 0,
                "GReader unread count was missing; skipping unread reconciliation"
            );
            continue;
        };
        let local_unread_count = local_unread_counts.get(&feed.id).copied().unwrap_or(0);

        if server_unread_count != local_unread_count {
            let mut reconcile_outcome = ReconcileOutcome::SkippedIncomplete;
            match reconcile_greader_unread_state_for_feed(
                db,
                provider,
                account,
                feed,
                server_unread_count,
                &mut reconcile_outcome,
            )
            .await
            {
                Ok(()) => match reconcile_outcome {
                    ReconcileOutcome::Applied => {
                        if server_unread_count > local_unread_count {
                            backfilled_feeds += 1;
                        }
                    }
                    ReconcileOutcome::SkippedIncomplete => {}
                },
                Err(error) => {
                    // Stop reconciling further feeds, but still recalculate below so
                    // feeds already mutated before this failure don't keep a stale
                    // unread_count (see PR review: recalculate from `articles` is
                    // safe/idempotent for all target feeds, not only the successful ones).
                    first_error = Some(error);
                    break;
                }
            }
        }
    }

    // Single batched recalculate for all target feeds instead of one lock_db
    // round trip per feed (see quality audit #3: feed-count x2-3 lock acquisitions).
    {
        let db_guard = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        feed_repo.recalculate_unread_counts(&target_feed_ids)?;
    }

    if let Some(error) = first_error {
        return Err(error);
    }

    Ok(backfilled_feeds)
}

fn fetch_local_unread_counts(
    db: &Mutex<DbManager>,
    feed_ids: &[FeedId],
) -> Result<HashMap<FeedId, i32>, AppError> {
    if feed_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let db_guard = lock_db(db)?;
    unread_counts_for_feed_ids_with_conn(db_guard.reader(), feed_ids).map_err(AppError::from)
}

async fn reconcile_greader_unread_state_for_feed(
    db: &Mutex<DbManager>,
    provider: &GReaderProvider,
    account: &Account,
    feed: &Feed,
    server_unread_count: i32,
    outcome: &mut ReconcileOutcome,
) -> Result<(), AppError> {
    let unread_snapshot =
        match fetch_greader_unread_entries_for_feed(provider, account, feed, server_unread_count)
            .await?
        {
            UnreadSnapshot::Complete(snapshot) => snapshot,
            // A partial unread snapshot is intentionally a successful no-op. The
            // structured warning emitted at the failure boundary makes this
            // skipped outcome observable without overwriting local read state from
            // an incomplete remote snapshot.
            UnreadSnapshot::Incomplete => {
                *outcome = ReconcileOutcome::SkippedIncomplete;
                return Ok(());
            }
        };

    // Keep article materialization and pending-mutation protection under the
    // same lock as the read-state transaction. This preserves the lock
    // contract while avoiding a stale window between snapshot confirmation
    // and apply.
    let db_guard = lock_db(db)?;
    if !unread_snapshot.articles.is_empty() {
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        article_repo.upsert(&unread_snapshot.articles)?;
        let candidate_ids = unread_snapshot
            .articles
            .iter()
            .map(|article| article.id.clone())
            .collect::<Vec<_>>();
        article_repo.mark_muted_unread_as_read(&account.id, Some(&candidate_ids))?;
    }

    let (pending_read_remote_ids, _pending_starred_remote_ids) =
        super::pending_remote_ids_by_axis(db_guard.reader(), &account.id)?;
    let pending_remote_ids: HashSet<String> = pending_read_remote_ids.into_iter().collect();

    // Pending-mutation protection is re-read inside the same lock as the
    // is_read UPDATE below (see .claude/rules/remote-state-reconciliation.md):
    // reading it in an earlier, separate lock acquisition would leave a
    // window where a user's local read-mark, made between the two locks,
    // gets reverted to the stale remote state. Reuses the same blessed
    // reader as `apply_remote_state_with_protection` (only the read axis is
    // relevant here; unread reconcile does not touch star state).
    let tx = db_guard
        .writer()
        .unchecked_transaction()
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)?;
    let rows = {
        let mut stmt = tx
            .prepare(
                "SELECT id, remote_id
             FROM articles
             WHERE feed_id = ?1 AND remote_id IS NOT NULL",
            )
            .map_err(crate::domain::error::DomainError::from)
            .map_err(AppError::from)?;
        let rows = stmt
            .query_map(rusqlite::params![feed.id.as_ref()], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(crate::domain::error::DomainError::from)
            .map_err(AppError::from)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(crate::domain::error::DomainError::from)
            .map_err(AppError::from)?;
        rows
    };

    {
        let mut update_stmt = tx
            .prepare("UPDATE articles SET is_read = ?1 WHERE id = ?2")
            .map_err(crate::domain::error::DomainError::from)
            .map_err(AppError::from)?;
        for (article_id, remote_id) in rows {
            if pending_remote_ids.contains(&remote_id) {
                continue;
            }
            update_stmt
                .execute(rusqlite::params![
                    !unread_snapshot.ids.contains(&remote_id),
                    article_id
                ])
                .map_err(crate::domain::error::DomainError::from)
                .map_err(AppError::from)?;
        }
    }

    tx.commit()
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)?;

    mark_muted_unread_as_read_for_feed_with_conn(db_guard.writer(), &account.id, &feed.id)?;

    *outcome = ReconcileOutcome::Applied;
    Ok(())
}

async fn fetch_greader_unread_entries_for_feed(
    provider: &GReaderProvider,
    account: &Account,
    feed: &Feed,
    server_unread_count: i32,
) -> Result<UnreadSnapshot, AppError> {
    if feed.remote_id.is_none() {
        return Ok(UnreadSnapshot::Complete(CompleteUnreadSnapshot {
            ids: HashSet::new(),
            articles: Vec::new(),
            pages: 0,
            entries: 0,
        }));
    }

    let Some(first_snapshot) =
        fetch_greader_unread_snapshot_once(provider, account, feed, server_unread_count).await?
    else {
        return Ok(UnreadSnapshot::Incomplete);
    };
    let Some(second_snapshot) =
        fetch_greader_unread_snapshot_once(provider, account, feed, server_unread_count).await?
    else {
        return Ok(UnreadSnapshot::Incomplete);
    };

    if first_snapshot.ids != second_snapshot.ids {
        incomplete_unread_snapshot_warning(
            account,
            feed,
            "snapshot_id_set_changed",
            second_snapshot.pages,
            second_snapshot.entries,
        );
        return Ok(UnreadSnapshot::Incomplete);
    }

    Ok(UnreadSnapshot::Complete(second_snapshot))
}

async fn fetch_greader_unread_snapshot_once(
    provider: &GReaderProvider,
    account: &Account,
    feed: &Feed,
    server_unread_count: i32,
) -> Result<Option<CompleteUnreadSnapshot>, AppError> {
    let Some(remote_id) = feed.remote_id.as_deref() else {
        return Ok(Some(CompleteUnreadSnapshot {
            ids: HashSet::new(),
            articles: Vec::new(),
            pages: 0,
            entries: 0,
        }));
    };

    let mut unread_remote_ids = HashSet::new();
    let mut articles = Vec::new();
    let mut fetched_entry_count = 0usize;
    let mut cursor: Option<SyncCursor> = None;
    for page_number in 0..MAX_UNREAD_RECONCILE_PAGES {
        let page = page_number + 1;
        let result = provider
            .pull_unread_entries_for_feed(remote_id, cursor.clone())
            .await
            .map_err(|error| {
                tracing::warn!(
                    account_id = %account.id.as_ref(),
                    feed_id = %feed.id.as_ref(),
                    host_class = redacted_feed_host_class(&feed.url),
                    reason = "provider_error",
                    page,
                    entries = fetched_entry_count,
                    "GReader unread stream failed before a complete snapshot was received"
                );
                AppError::from(error)
            })?;

        fetched_entry_count = fetched_entry_count.saturating_add(result.entries.len());
        if fetched_entry_count > MAX_UNREAD_RECONCILE_ENTRIES {
            incomplete_unread_snapshot_warning(
                account,
                feed,
                "entry_limit",
                page,
                fetched_entry_count,
            );
            return Ok(None);
        }

        let termination_reason = match result.termination {
            UnreadPullTermination::Normal => None,
            UnreadPullTermination::EmptyPageWithContinuation => {
                Some("empty_page_with_continuation")
            }
            UnreadPullTermination::RepeatedContinuation => Some("repeated_continuation"),
            UnreadPullTermination::FullPageWithoutContinuation => {
                Some("full_page_without_continuation")
            }
        };
        if let Some(reason) = termination_reason {
            incomplete_unread_snapshot_warning(account, feed, reason, page, fetched_entry_count);
            return Ok(None);
        }

        let mut duplicate_entry_id = false;
        let mut page_articles = Vec::with_capacity(result.entries.len());
        for entry in &result.entries {
            if let Some(remote_id) = entry.id.as_ref() {
                if !unread_remote_ids.insert(remote_id.clone()) {
                    duplicate_entry_id = true;
                }
            }
            page_articles.push(article_from_remote_entry(&account.id, feed, entry));
        }
        if duplicate_entry_id {
            incomplete_unread_snapshot_warning(
                account,
                feed,
                "duplicate_entry_id",
                page,
                fetched_entry_count,
            );
            return Ok(None);
        }
        articles.extend(page_articles);

        if !result.has_more {
            let expected_unread_count = usize::try_from(server_unread_count).ok();
            if expected_unread_count != Some(unread_remote_ids.len()) {
                incomplete_unread_snapshot_warning(
                    account,
                    feed,
                    "unread_count_mismatch",
                    page,
                    fetched_entry_count,
                );
                return Ok(None);
            }
            return Ok(Some(CompleteUnreadSnapshot {
                ids: unread_remote_ids,
                articles,
                pages: page,
                entries: fetched_entry_count,
            }));
        }

        if page == MAX_UNREAD_RECONCILE_PAGES {
            incomplete_unread_snapshot_warning(
                account,
                feed,
                "page_limit",
                page,
                fetched_entry_count,
            );
            return Ok(None);
        }

        let Some(next_cursor) = result.next_cursor else {
            incomplete_unread_snapshot_warning(
                account,
                feed,
                "missing_continuation",
                page,
                fetched_entry_count,
            );
            return Ok(None);
        };
        if next_cursor.continuation.is_none() {
            incomplete_unread_snapshot_warning(
                account,
                feed,
                "missing_continuation",
                page,
                fetched_entry_count,
            );
            return Ok(None);
        }
        cursor = Some(next_cursor);
    }

    incomplete_unread_snapshot_warning(
        account,
        feed,
        "page_loop_exhausted",
        MAX_UNREAD_RECONCILE_PAGES,
        fetched_entry_count,
    );
    Ok(None)
}

fn incomplete_unread_snapshot_warning(
    account: &Account,
    feed: &Feed,
    reason: &str,
    page: usize,
    entries: usize,
) {
    tracing::warn!(
        account_id = %account.id.as_ref(),
        feed_id = %feed.id.as_ref(),
        host_class = redacted_feed_host_class(&feed.url),
        reason,
        page,
        entries,
        outcome = "skipped_incomplete",
        "Incomplete GReader unread snapshot"
    );
}

#[cfg(test)]
mod tests;
