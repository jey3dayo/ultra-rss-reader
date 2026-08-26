//! GReader entry pull and persist for account-wide and single-feed sync
//! scopes.
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use tracing::warn;

use crate::commands::dto::AppError;
use crate::domain::account::Account;
use crate::domain::article::Article;
use crate::domain::feed::Feed;
use crate::domain::provider::{FeedIdentifier, PullScope};
use crate::infra::db::connection::DbManager;
use crate::infra::provider::greader::{GReaderProvider, G_READER_MAX_PAGES};
use crate::infra::provider::traits::FeedProvider;
use crate::repository::sync_state::{SyncState, SyncStateScopeKey};
use crate::service::article_materializer::article_from_remote_entry;

use super::super::redacted_feed_host_class;
use super::super::state::{
    cursor_from_state, feed_scope_key, load_sync_state, save_greader_sync_failure_state,
    save_sync_state, sync_state_timestamp_usec, update_latest_timestamp_usec,
    update_latest_timestamp_usec_from_entries,
};
use super::db::{
    load_feed_sync_state, persist_pulled_account_articles, persist_pulled_feed_articles,
    save_feed_sync_state,
};
use super::{GReaderAccountEntriesSyncOutcome, GReaderFeedSyncOutcome};

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
    let mut seen_feed_ids = std::collections::HashSet::new();
    let mut seen_continuations = HashSet::new();

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

        if delta_pages >= G_READER_MAX_PAGES {
            warn!(
                account_id = %account.id.as_ref(),
                page_count = delta_pages,
                max_pages = G_READER_MAX_PAGES,
                reason = "page_cap",
                "GReader account entry sync stopped at the page cap"
            );
            break;
        }

        let Some(next_continuation) = result
            .next_cursor
            .as_ref()
            .and_then(|next_cursor| next_cursor.continuation.as_ref())
        else {
            break;
        };
        if !seen_continuations.insert(next_continuation.clone()) {
            warn!(
                account_id = %account.id.as_ref(),
                page_count = delta_pages,
                reason = "continuation_cycle",
                "GReader account entry sync stopped at a continuation cycle"
            );
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
    let mut delta_pages = 0usize;
    let mut seen_continuations = HashSet::new();

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
        delta_pages += 1;
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

        if delta_pages >= G_READER_MAX_PAGES {
            warn!(
                account_id = %account.id.as_ref(),
                page_count = delta_pages,
                max_pages = G_READER_MAX_PAGES,
                reason = "page_cap",
                "GReader feed entry sync stopped at the page cap"
            );
            break;
        }

        let Some(next_continuation) = result
            .next_cursor
            .as_ref()
            .and_then(|next_cursor| next_cursor.continuation.as_ref())
        else {
            break;
        };
        if !seen_continuations.insert(next_continuation.clone()) {
            warn!(
                account_id = %account.id.as_ref(),
                page_count = delta_pages,
                reason = "continuation_cycle",
                "GReader feed entry sync stopped at a continuation cycle"
            );
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
