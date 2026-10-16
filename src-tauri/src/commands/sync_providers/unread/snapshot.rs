//! Paged GReader unread snapshot fetching with page/entry caps and incomplete-snapshot warnings.

use super::*;

pub(super) async fn fetch_greader_unread_entries_for_feed(
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

pub(super) struct IncompleteSnapshot {
    pub(super) reason: &'static str,
    pub(super) page: usize,
    pub(super) entries: usize,
}

pub(super) enum PageScan {
    Complete(CompleteUnreadSnapshot),
    Incomplete(IncompleteSnapshot),
}

pub(super) async fn fetch_greader_unread_snapshot_once(
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

    match scan_greader_unread_pages(provider, account, feed, remote_id, server_unread_count).await?
    {
        PageScan::Complete(snapshot) => Ok(Some(snapshot)),
        PageScan::Incomplete(incomplete) => {
            incomplete_unread_snapshot_warning(
                account,
                feed,
                incomplete.reason,
                incomplete.page,
                incomplete.entries,
            );
            Ok(None)
        }
    }
}

pub(super) async fn scan_greader_unread_pages(
    provider: &GReaderProvider,
    account: &Account,
    feed: &Feed,
    remote_id: &str,
    server_unread_count: i32,
) -> Result<PageScan, AppError> {
    let mut unread_remote_ids = HashSet::new();
    let mut articles = Vec::new();
    let mut fetched_entry_count = 0usize;
    let mut cursor: Option<SyncCursor> = None;
    for page in 1..=MAX_UNREAD_RECONCILE_PAGES {
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
        let incomplete = |reason| {
            Ok(PageScan::Incomplete(IncompleteSnapshot {
                reason,
                page,
                entries: fetched_entry_count,
            }))
        };

        if let Some(reason) = page_incomplete_reason(fetched_entry_count, result.termination) {
            return incomplete(reason);
        }

        let Some(page_articles) =
            collect_page_articles(account, feed, &result.entries, &mut unread_remote_ids)
        else {
            return incomplete("duplicate_entry_id");
        };
        articles.extend(page_articles);

        if !result.has_more {
            if usize::try_from(server_unread_count).ok() != Some(unread_remote_ids.len()) {
                return incomplete("unread_count_mismatch");
            }
            return Ok(PageScan::Complete(CompleteUnreadSnapshot {
                ids: unread_remote_ids,
                articles,
                pages: page,
                entries: fetched_entry_count,
            }));
        }

        match next_unread_cursor(page, result.next_cursor) {
            Ok(next_cursor) => cursor = Some(next_cursor),
            Err(reason) => return incomplete(reason),
        }
    }

    Ok(PageScan::Incomplete(IncompleteSnapshot {
        reason: "page_loop_exhausted",
        page: MAX_UNREAD_RECONCILE_PAGES,
        entries: fetched_entry_count,
    }))
}

pub(super) fn page_incomplete_reason(
    fetched_entry_count: usize,
    termination: UnreadPullTermination,
) -> Option<&'static str> {
    if fetched_entry_count > MAX_UNREAD_RECONCILE_ENTRIES {
        return Some("entry_limit");
    }
    match termination {
        UnreadPullTermination::Normal => None,
        UnreadPullTermination::EmptyPageWithContinuation => Some("empty_page_with_continuation"),
        UnreadPullTermination::RepeatedContinuation => Some("repeated_continuation"),
        UnreadPullTermination::FullPageWithoutContinuation => {
            Some("full_page_without_continuation")
        }
    }
}

pub(super) fn collect_page_articles(
    account: &Account,
    feed: &Feed,
    entries: &[RemoteEntry],
    unread_remote_ids: &mut HashSet<String>,
) -> Option<Vec<Article>> {
    let mut has_duplicate = false;
    let articles = entries
        .iter()
        .map(|entry| {
            if let Some(remote_id) = entry.id.as_ref() {
                has_duplicate |= !unread_remote_ids.insert(remote_id.clone());
            }
            article_from_remote_entry(&account.id, feed, entry)
        })
        .collect();
    (!has_duplicate).then_some(articles)
}

pub(super) fn next_unread_cursor(
    page: usize,
    next_cursor: Option<SyncCursor>,
) -> Result<SyncCursor, &'static str> {
    if page == MAX_UNREAD_RECONCILE_PAGES {
        return Err("page_limit");
    }
    next_cursor
        .filter(|cursor| cursor.continuation.is_some())
        .ok_or("missing_continuation")
}

pub(super) fn incomplete_unread_snapshot_warning(
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
