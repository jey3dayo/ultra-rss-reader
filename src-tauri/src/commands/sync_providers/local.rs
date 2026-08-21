use std::sync::Mutex;

use crate::commands::dto::AppError;
use crate::domain::article::Article;
use crate::domain::feed::Feed;
use crate::domain::provider::{FeedIdentifier, PullResult, PullScope, SyncCursor};
use crate::domain::types::{AccountId, ArticleId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_article::mark_muted_unread_as_read_for_feed_with_conn;
use crate::infra::db::sqlite_article::mark_muted_unread_as_read_with_conn;
use crate::infra::db::sqlite_article::upsert_articles_with_conn;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::infra::provider::local::LocalProvider;
use crate::infra::provider::traits::FeedProvider;
use crate::repository::feed::FeedRepository;
use crate::repository::sync_state::{
    normalize_http_etag_validator, normalize_http_last_modified_validator, SyncState,
    SyncStateRepository, SyncStateScopeKey,
};
use crate::service::article_materializer::article_from_remote_entry;

use crate::commands::feed_commands::lock_db;

/// Delegates to `infra::db::sqlite_article::upsert_articles_with_conn`, which
/// does not open its own transaction, so this rides on the caller's existing
/// transaction (see `save_local_feed_sync_result_in_current_transaction`).
pub(super) fn upsert_articles_in_current_transaction(
    conn: &rusqlite::Connection,
    articles: &[Article],
) -> Result<(), AppError> {
    upsert_articles_with_conn(conn, articles).map_err(AppError::from)
}

fn save_local_feed_sync_result_in_current_transaction(
    conn: &rusqlite::Connection,
    account_id: &AccountId,
    feed: &Feed,
    articles: &[Article],
    next_states: &[SyncState],
) -> Result<(), AppError> {
    let feed_repo = SqliteFeedRepository::new(conn);
    if !articles.is_empty() {
        upsert_articles_in_current_transaction(conn, articles)?;
        let candidate_ids = articles
            .iter()
            .map(|article| article.id.clone())
            .collect::<Vec<ArticleId>>();
        mark_muted_unread_as_read_with_conn(conn, account_id, Some(&candidate_ids))?;
    } else {
        mark_muted_unread_as_read_for_feed_with_conn(conn, account_id, &feed.id)?;
    }
    feed_repo.recalculate_unread_count(&feed.id)?;

    let sync_state_repo = SqliteSyncStateRepository::new(conn);
    for next_state in next_states {
        sync_state_repo.save(next_state)?;
    }
    Ok(())
}

pub(super) fn local_feed_scope_key(feed_url: &str) -> SyncStateScopeKey {
    SyncStateScopeKey::local_feed(feed_url)
}

fn local_feed_effective_scope_key(
    requested_scope_key: &SyncStateScopeKey,
    result: &PullResult,
) -> SyncStateScopeKey {
    result
        .entries
        .iter()
        .find_map(|entry| match &entry.source_feed_id {
            FeedIdentifier::Local { feed_url } => Some(local_feed_scope_key(feed_url)),
            FeedIdentifier::Remote { .. } => None,
        })
        .unwrap_or_else(|| requested_scope_key.clone())
}

fn local_feed_validator_states_for_scope_keys(
    next_state: SyncState,
    requested_scope_key: &SyncStateScopeKey,
) -> Vec<SyncState> {
    let requested_scope_key = requested_scope_key.as_string();
    if requested_scope_key == next_state.scope_key {
        return vec![next_state];
    }

    let mut requested_state = next_state.clone();
    requested_state.scope_key = requested_scope_key;
    vec![next_state, requested_state]
}

/// Fetch articles for a single local feed and save them to DB.
pub(in crate::commands) async fn sync_local_feed(
    db: &Mutex<DbManager>,
    provider: &LocalProvider,
    account_id: &AccountId,
    feed: &Feed,
) -> Result<(), AppError> {
    let scope_key = local_feed_scope_key(&feed.url);
    let saved_state = {
        let db_guard = lock_db(db)?;
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
        sync_state_repo.get(account_id, &scope_key)?
    };
    let scope = PullScope::Feed(FeedIdentifier::Local {
        feed_url: feed.url.clone(),
    });

    let result = provider
        .pull_entries(
            scope,
            saved_state.as_ref().map(|state| SyncCursor {
                continuation: None,
                since: None,
                etag: normalize_http_etag_validator(state.etag.clone()),
                last_modified: normalize_http_last_modified_validator(state.last_modified.clone()),
            }),
        )
        .await?;

    let articles: Vec<Article> = if result.not_modified {
        Vec::new()
    } else {
        result
            .entries
            .iter()
            .map(|entry| article_from_remote_entry(account_id, feed, entry))
            .collect()
    };

    let effective_scope_key = local_feed_effective_scope_key(&scope_key, &result);
    let next_state = SyncState {
        account_id: account_id.clone(),
        scope_key: effective_scope_key.as_string(),
        timestamp_usec: None,
        continuation: None,
        etag: normalize_http_etag_validator(
            result
                .next_cursor
                .as_ref()
                .and_then(|cursor| cursor.etag.clone()),
        ),
        last_modified: normalize_http_last_modified_validator(
            result
                .next_cursor
                .as_ref()
                .and_then(|cursor| cursor.last_modified.clone()),
        ),
        last_success_at: Some(chrono::Utc::now().to_rfc3339()),
        last_error: None,
        error_count: 0,
        next_retry_at: None,
    };
    let next_states = local_feed_validator_states_for_scope_keys(next_state, &scope_key);
    let db_guard = lock_db(db)?;
    let tx = db_guard
        .writer()
        .unchecked_transaction()
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)?;
    save_local_feed_sync_result_in_current_transaction(
        &tx,
        account_id,
        feed,
        &articles,
        &next_states,
    )?;
    tx.commit()
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)?;

    Ok(())
}
