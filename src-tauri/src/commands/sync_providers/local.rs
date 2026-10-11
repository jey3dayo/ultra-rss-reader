use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::commands::dto::AppError;
use crate::commands::dto::LocalFeedSyncErrorKind;
use crate::commands::sync_commands::log_local_feed_fetch_failure;
use crate::domain::article::Article;
use crate::domain::error::DomainError;
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

const PRIVATE_ADDRESS_BLOCKED_MESSAGE: &str =
    crate::domain::url_policy::PRIVATE_URL_VALIDATION_MESSAGE;

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct LocalFeedFailureRecord {
    error_kind: LocalFeedSyncErrorKind,
    attempted_at: String,
    diagnostic_id: String,
}

fn local_feed_error_kind(error: &DomainError) -> LocalFeedSyncErrorKind {
    match error {
        DomainError::Validation(message) if message == PRIVATE_ADDRESS_BLOCKED_MESSAGE => {
            LocalFeedSyncErrorKind::PrivateAddressBlocked
        }
        DomainError::Validation(_) => LocalFeedSyncErrorKind::Validation,
        DomainError::Network(_)
        | DomainError::RateLimit(_)
        | DomainError::RateLimitWithRetryAfter { .. } => LocalFeedSyncErrorKind::Network,
        DomainError::Parse(_) => LocalFeedSyncErrorKind::Parse,
        DomainError::Persistence(_) => LocalFeedSyncErrorKind::Persistence,
        _ => LocalFeedSyncErrorKind::Other,
    }
}

fn local_feed_failure_record(last_error: &str) -> Option<LocalFeedFailureRecord> {
    let record = serde_json::from_str::<LocalFeedFailureRecord>(last_error).ok()?;
    (chrono::DateTime::parse_from_rfc3339(&record.attempted_at).is_ok()
        && Uuid::parse_str(&record.diagnostic_id).is_ok())
    .then_some(record)
}

fn validated_timestamp(value: Option<String>) -> Option<String> {
    value.filter(|value| chrono::DateTime::parse_from_rfc3339(value).is_ok())
}

pub(crate) fn local_feed_sync_status(
    feed_id: &crate::domain::types::FeedId,
    state: Option<SyncState>,
) -> crate::commands::dto::LocalFeedSyncStatus {
    let failure = state
        .as_ref()
        .and_then(|state| state.last_error.as_deref())
        .and_then(local_feed_failure_record);
    let has_error = state
        .as_ref()
        .is_some_and(|state| state.last_error.is_some());
    let last_success_at = state
        .as_ref()
        .and_then(|state| validated_timestamp(state.last_success_at.clone()));
    let error_count = state.as_ref().map_or(0, |state| state.error_count.max(0));
    crate::commands::dto::LocalFeedSyncStatus {
        feed_id: feed_id.as_ref().to_string(),
        last_attempt_at: if has_error {
            failure.as_ref().map(|record| record.attempted_at.clone())
        } else {
            last_success_at.clone()
        },
        last_success_at: last_success_at.clone(),
        error_kind: if has_error && failure.is_none() {
            Some(LocalFeedSyncErrorKind::Other)
        } else {
            failure.as_ref().map(|record| record.error_kind)
        },
        error_count,
        diagnostic_id: failure.as_ref().map(|record| record.diagnostic_id.clone()),
    }
}

fn failed_local_feed_sync_state(
    account_id: &AccountId,
    scope_key: &SyncStateScopeKey,
    saved_state: Option<SyncState>,
    error_kind: LocalFeedSyncErrorKind,
    attempted_at: String,
    diagnostic_id: String,
) -> Result<SyncState, AppError> {
    let mut state = saved_state.unwrap_or_else(|| SyncState {
        account_id: account_id.clone(),
        scope_key: scope_key.as_string(),
        timestamp_usec: None,
        continuation: None,
        etag: None,
        last_modified: None,
        last_success_at: None,
        last_error: None,
        error_count: 0,
        next_retry_at: None,
    });
    state.last_error = Some(
        serde_json::to_string(&LocalFeedFailureRecord {
            error_kind,
            attempted_at,
            diagnostic_id,
        })
        .map_err(|error| AppError::UserVisible {
            message: format!("Persistence error: Failed to encode local feed sync status: {error}"),
        })?,
    );
    state.error_count = state.error_count.max(0).saturating_add(1);
    Ok(state)
}

use crate::commands::lock_db;

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

pub(crate) fn local_feed_scope_key(feed_url: &str) -> SyncStateScopeKey {
    SyncStateScopeKey::local_feed(feed_url)
}

/// Read the saved sync state for a single local feed, inside a single
/// reader lock scope.
fn load_local_feed_sync_state(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    scope_key: &SyncStateScopeKey,
) -> Result<Option<SyncState>, AppError> {
    let db_guard = lock_db(db)?;
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    Ok(sync_state_repo.get(account_id, scope_key)?)
}

/// Commit the pulled articles and sync-state updates for a single local
/// feed inside one writer lock and transaction. See
/// `save_local_feed_sync_result_in_current_transaction` for what runs
/// inside the transaction.
fn commit_local_feed_sync_result(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    feed: &Feed,
    articles: &[Article],
    next_states: &[SyncState],
) -> Result<(), AppError> {
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
        articles,
        next_states,
    )?;
    tx.commit()
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)
}

fn persist_local_feed_fetch_failure(
    db: &Mutex<DbManager>,
    state: &SyncState,
    error_kind: LocalFeedSyncErrorKind,
    diagnostic_id: &str,
) -> Result<(), AppError> {
    let db_guard = lock_db(db).map_err(|storage_error| {
        log::error!(
            target: "sync",
            "event=feed-fetch-status-persist-failed diagnostic_id={} fetch_error_kind={} storage_error_kind={}",
            diagnostic_id,
            error_kind.diagnostic_label(),
            storage_error.diagnostic_kind()
        );
        AppError::UserVisible {
            message: format!(
                "Persistence error: Could not save local feed sync status after {} fetch failure: {storage_error}",
                error_kind.diagnostic_label()
            ),
        }
    })?;
    if let Err(persistence_error) = SqliteSyncStateRepository::new(db_guard.writer()).save(state) {
        log::error!(
            target: "sync",
            "event=feed-fetch-status-persist-failed diagnostic_id={} fetch_error_kind={}",
            diagnostic_id,
            error_kind.diagnostic_label()
        );
        return Err(AppError::from(persistence_error));
    }
    Ok(())
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
    let saved_state = load_local_feed_sync_state(db, account_id, &scope_key)?;
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
        .await;
    let result = match result {
        Ok(result) => result,
        Err(error) => {
            let error_kind = local_feed_error_kind(&error);
            let attempted_at = chrono::Utc::now().to_rfc3339();
            let diagnostic_id = Uuid::new_v4().to_string();
            let app_error = AppError::from(error);
            log_local_feed_fetch_failure(
                crate::commands::sync_providers::redacted_feed_host_class(&feed.url),
                &app_error,
                error_kind,
                &diagnostic_id,
            );
            let next_state = failed_local_feed_sync_state(
                account_id,
                &scope_key,
                saved_state,
                error_kind,
                attempted_at,
                diagnostic_id.clone(),
            )?;
            persist_local_feed_fetch_failure(db, &next_state, error_kind, &diagnostic_id)?;
            return Err(app_error);
        }
    };

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
    commit_local_feed_sync_result(db, account_id, feed, &articles, &next_states)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_feed_sync_status_sanitizes_invalid_legacy_errors() {
        let mut state = SyncState {
            account_id: AccountId("account".to_string()),
            scope_key: "local_feed:https://example.test/feed".to_string(),
            timestamp_usec: None,
            continuation: Some("cursor-secret".to_string()),
            etag: Some("\"etag\"".to_string()),
            last_modified: None,
            last_success_at: Some("2026-10-10T23:00:00Z".to_string()),
            last_error: Some("https://private.test/feed?token=secret".to_string()),
            error_count: -3,
            next_retry_at: None,
        };

        let status = local_feed_sync_status(
            &crate::domain::types::FeedId("feed-id".into()),
            Some(state.clone()),
        );

        assert_eq!(status.error_kind, Some(LocalFeedSyncErrorKind::Other));
        assert_eq!(status.last_attempt_at, None);
        assert_eq!(
            status.last_success_at.as_deref(),
            Some("2026-10-10T23:00:00Z")
        );
        assert_eq!(status.error_count, 0);
        assert_eq!(status.diagnostic_id, None);
        let serialized = serde_json::to_string(&status).expect("status should serialize");
        assert!(!serialized.contains("private.test"));
        assert!(!serialized.contains("token=secret"));

        state.last_error = Some(
            r#"{"error_kind":"future_secret_kind","attempted_at":"2026-10-11T00:00:00Z","diagnostic_id":"8cb8465f-9d0c-429e-83f8-a7d511597be6"}"#.into(),
        );
        let status =
            local_feed_sync_status(&crate::domain::types::FeedId("feed-id".into()), Some(state));
        assert_eq!(status.error_kind, Some(LocalFeedSyncErrorKind::Other));
        assert_eq!(status.last_attempt_at, None);
        assert_eq!(status.diagnostic_id, None);
    }

    #[test]
    fn local_feed_fetch_error_categories_are_stable_and_safe() {
        assert_eq!(
            local_feed_error_kind(&DomainError::Validation(
                PRIVATE_ADDRESS_BLOCKED_MESSAGE.to_string()
            )),
            LocalFeedSyncErrorKind::PrivateAddressBlocked
        );
        assert_eq!(
            local_feed_error_kind(&DomainError::Validation("bad url".to_string())),
            LocalFeedSyncErrorKind::Validation
        );
        assert_eq!(
            local_feed_error_kind(&DomainError::Network("secret host".to_string())),
            LocalFeedSyncErrorKind::Network
        );
        assert_eq!(
            local_feed_error_kind(&DomainError::Parse("private content".to_string())),
            LocalFeedSyncErrorKind::Parse
        );
        assert_eq!(
            local_feed_error_kind(&DomainError::Persistence("private path".to_string())),
            LocalFeedSyncErrorKind::Persistence
        );
        assert_eq!(
            local_feed_error_kind(&DomainError::Auth("secret".to_string())),
            LocalFeedSyncErrorKind::Other
        );
    }
}
