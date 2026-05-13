use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::Instant;

use tracing::{info, warn};

use crate::commands::dto::{AccountSyncWarningKind, AppError};
use crate::domain::account::Account;
use crate::domain::article::{generate_entry_id, Article};
use crate::domain::feed::Feed;
use crate::domain::folder::Folder;
use crate::domain::provider::{
    FeedIdentifier, Mutation, PullResult, PullScope, RemoteEntry, RemoteSubscription, SyncCursor,
};
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_article::mark_muted_unread_as_read_with_conn;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_folder::SqliteFolderRepository;
use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::infra::keyring_store;
use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::local::LocalProvider;
use crate::infra::provider::traits::{Credentials, FeedProvider};
use crate::infra::sanitizer;
use crate::repository::article::ArticleRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;
use crate::repository::pending_mutation::{
    PendingMutationAxis, PendingMutationRepository, PendingMutationType,
};
use crate::repository::sync_state::{
    normalize_http_etag_validator, normalize_http_last_modified_validator, SyncState,
    SyncStateRepository, SyncStateScopeKey,
};

use super::feed_commands::lock_db;

fn upsert_articles_in_current_transaction(
    conn: &rusqlite::Connection,
    articles: &[Article],
) -> Result<(), AppError> {
    let mut stmt = conn
        .prepare(
            "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, summary, url, author, published_at, thumbnail, is_read, is_starred, fetched_at, content_text)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
             ON CONFLICT(id) DO UPDATE SET
               title = excluded.title,
               content_raw = excluded.content_raw,
               content_sanitized = excluded.content_sanitized,
               content_text = excluded.content_text,
               sanitizer_version = excluded.sanitizer_version,
               summary = excluded.summary,
               url = excluded.url,
               author = excluded.author,
               published_at = excluded.published_at,
               thumbnail = excluded.thumbnail,
               fetched_at = excluded.fetched_at",
        )
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)?;
    for article in articles {
        stmt.execute(rusqlite::params![
            article.id.0,
            article.feed_id.0,
            article.remote_id,
            article.title,
            article.content_raw,
            article.content_sanitized,
            article.sanitizer_version,
            article.summary,
            article.url,
            article.author,
            article.published_at.to_rfc3339(),
            article.thumbnail,
            article.is_read,
            article.is_starred,
            article.fetched_at.to_rfc3339(),
            if article.content_sanitized.trim().is_empty() {
                article.summary.clone().unwrap_or_default()
            } else {
                sanitizer::extract_visible_text(&article.content_sanitized)
            },
        ])
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)?;
    }
    Ok(())
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
        mark_muted_unread_as_read_with_conn(conn, account_id, None)?;
    }
    feed_repo.recalculate_unread_count(&feed.id)?;

    let sync_state_repo = SqliteSyncStateRepository::new(conn);
    for next_state in next_states {
        sync_state_repo.save(next_state)?;
    }
    Ok(())
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

#[derive(Debug, Clone, Default, PartialEq, Eq)]
struct GReaderFeedSyncOutcome {
    skipped_entries: usize,
}

#[derive(Debug, Clone)]
struct ProviderManagedFeedSnapshot {
    article_count: usize,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
struct GReaderAccountEntriesSyncOutcome {
    skipped_entries: usize,
    entries_upserted: usize,
    delta_pages: usize,
    feeds_seen: usize,
}

const GREADER_REMOTE_STATE_PULL_COOLDOWN_MINUTES: i64 = 10;

fn pending_mutation_retry_warning(mutation_type: PendingMutationType) -> ProviderSyncWarning {
    ProviderSyncWarning {
        kind: AccountSyncWarningKind::RetryPending,
        message: format!(
            "Local change '{}' will retry next sync.",
            mutation_type.as_str()
        ),
        retry_at: None,
        retry_in_seconds: None,
    }
}

fn dropped_pending_mutation_warning(mutation_type: PendingMutationType) -> ProviderSyncWarning {
    ProviderSyncWarning {
        kind: AccountSyncWarningKind::Generic,
        message: format!(
            "Local change '{}' could not be sent because the feed is no longer managed by FreshRSS. Sync again after refreshing the feed.",
            mutation_type.as_str()
        ),
        retry_at: None,
        retry_in_seconds: None,
    }
}

fn build_article_from_remote_entry(
    account: &Account,
    feed: &Feed,
    entry: &crate::domain::provider::RemoteEntry,
) -> Article {
    let id = generate_entry_id(
        account.id.as_ref(),
        entry.id.as_deref(),
        &feed.url,
        entry.url.as_deref(),
        Some(&entry.title),
    );
    Article {
        id,
        feed_id: feed.id.clone(),
        remote_id: entry.id.clone(),
        title: entry.title.clone(),
        content_raw: entry.content.clone(),
        content_sanitized: sanitizer::sanitize_html(&entry.content),
        sanitizer_version: sanitizer::SANITIZER_VERSION,
        summary: entry.summary.clone(),
        url: entry.url.clone(),
        author: entry.author.clone(),
        published_at: entry.published_at.unwrap_or_else(chrono::Utc::now),
        thumbnail: entry.thumbnail.clone(),
        is_read: entry.is_read.unwrap_or(false),
        is_starred: entry.is_starred.unwrap_or(false),
        fetched_at: chrono::Utc::now(),
    }
}

fn update_latest_timestamp_usec(
    latest_timestamp_usec: &mut Option<i64>,
    next_cursor: Option<&SyncCursor>,
) {
    if let Some(next_timestamp_usec) = next_cursor
        .and_then(|cursor| cursor.since)
        .map(|ts| ts.timestamp_micros())
        .and_then(valid_sync_cursor_timestamp_usec)
    {
        *latest_timestamp_usec = Some(
            latest_timestamp_usec
                .map(|current| current.max(next_timestamp_usec))
                .unwrap_or(next_timestamp_usec),
        );
    }
}

fn valid_sync_cursor_timestamp_usec(timestamp_usec: i64) -> Option<i64> {
    if timestamp_usec < 0 {
        return None;
    }
    let timestamp = chrono::DateTime::from_timestamp_micros(timestamp_usec)?;
    if timestamp > chrono::Utc::now() {
        return None;
    }
    Some(timestamp_usec)
}

fn sync_state_timestamp_usec(state: Option<&SyncState>) -> Option<i64> {
    state
        .and_then(|state| state.timestamp_usec)
        .and_then(valid_sync_cursor_timestamp_usec)
}

fn update_latest_timestamp_usec_from_entries(
    latest_timestamp_usec: &mut Option<i64>,
    entries: &[RemoteEntry],
) {
    if let Some(next_timestamp_usec) = entries
        .iter()
        .filter_map(|entry| entry.updated_at.or(entry.published_at))
        .map(|timestamp| timestamp.timestamp_micros())
        .filter_map(valid_sync_cursor_timestamp_usec)
        .max()
    {
        *latest_timestamp_usec = Some(
            latest_timestamp_usec
                .map(|current| current.max(next_timestamp_usec))
                .unwrap_or(next_timestamp_usec),
        );
    }
}

fn load_sync_state(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    scope_key: &SyncStateScopeKey,
) -> Result<Option<SyncState>, AppError> {
    let db_guard = lock_db(db)?;
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    Ok(sync_state_repo.get(account_id, scope_key)?)
}

fn save_sync_state(db: &Mutex<DbManager>, state: &SyncState) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
    sync_state_repo.save(state)?;
    Ok(())
}

fn save_greader_sync_failure_state(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    scope_key: &SyncStateScopeKey,
    saved_state: Option<&SyncState>,
    latest_timestamp_usec: Option<i64>,
    error: &AppError,
) -> Result<(), AppError> {
    save_sync_state(
        db,
        &SyncState {
            account_id: account_id.clone(),
            scope_key: scope_key.as_string(),
            timestamp_usec: latest_timestamp_usec
                .or_else(|| saved_state.and_then(|state| state.timestamp_usec)),
            continuation: None,
            etag: None,
            last_modified: None,
            last_success_at: saved_state.and_then(|state| state.last_success_at.clone()),
            last_error: Some(error.to_string()),
            error_count: saved_state
                .map(|state| state.error_count.saturating_add(1))
                .unwrap_or(1),
            next_retry_at: None,
        },
    )
}

fn should_pull_remote_state(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    now: chrono::DateTime<chrono::Utc>,
) -> Result<bool, AppError> {
    let scope_key = SyncStateScopeKey::greader_remote_state_full();
    let state = load_sync_state(db, account_id, &scope_key)?;
    let Some(last_success_at) = state.and_then(|saved| saved.last_success_at) else {
        return Ok(true);
    };

    let Ok(last_success_at) = chrono::DateTime::parse_from_rfc3339(&last_success_at) else {
        return Ok(true);
    };
    let last_success_at = last_success_at.with_timezone(&chrono::Utc);
    if last_success_at > now {
        return Ok(true);
    }

    Ok(now.signed_duration_since(last_success_at)
        >= chrono::Duration::minutes(GREADER_REMOTE_STATE_PULL_COOLDOWN_MINUTES))
}

fn mark_remote_state_sync_completed(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    now: chrono::DateTime<chrono::Utc>,
) -> Result<(), AppError> {
    let scope_key = SyncStateScopeKey::greader_remote_state_full();
    save_sync_state(
        db,
        &SyncState {
            account_id: account_id.clone(),
            scope_key: scope_key.as_string(),
            timestamp_usec: Some(now.timestamp_micros()),
            continuation: None,
            etag: None,
            last_modified: None,
            last_success_at: Some(now.to_rfc3339()),
            last_error: None,
            error_count: 0,
            next_retry_at: None,
        },
    )
}

/// Fetch articles for a single local feed and save them to DB.
pub(super) async fn sync_local_feed(
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
            .map(|entry| {
                let id = generate_entry_id(
                    account_id.as_ref(),
                    entry.id.as_deref(),
                    &feed.url,
                    entry.url.as_deref(),
                    Some(&entry.title),
                );
                Article {
                    id,
                    feed_id: feed.id.clone(),
                    remote_id: entry.id.clone(),
                    title: entry.title.clone(),
                    content_raw: entry.content.clone(),
                    content_sanitized: sanitizer::sanitize_html(&entry.content),
                    sanitizer_version: sanitizer::SANITIZER_VERSION,
                    summary: entry.summary.clone(),
                    url: entry.url.clone(),
                    author: entry.author.clone(),
                    published_at: entry.published_at.unwrap_or_else(chrono::Utc::now),
                    thumbnail: entry.thumbnail.clone(),
                    is_read: entry.is_read.unwrap_or(false),
                    is_starred: entry.is_starred.unwrap_or(false),
                    fetched_at: chrono::Utc::now(),
                }
            })
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

/// Sync a GReader-compatible account: authenticate, sync folders, subscriptions, entries, state, unread counts.
pub(super) async fn sync_greader_account(
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
    let password = keyring_store::get_password(account.id.as_ref())?;
    provider
        .authenticate(&Credentials {
            token: Some(username),
            password: Some(password),
        })
        .await?;
    info!(
        account_id = %account.id.as_ref(),
        account_name = %account.name,
        phase = "auth",
        elapsed_ms = auth_started_at.elapsed().as_millis() as u64,
        "FreshRSS sync phase completed"
    );

    // Step 2: Sync folders
    let folders_started_at = Instant::now();
    let remote_folders = provider.get_folders().await?;
    {
        let db_guard = lock_db(db)?;
        let folder_repo = SqliteFolderRepository::new(db_guard.writer());
        let mut local_folders = folder_repo.find_by_account(&account.id)?;
        let mut next_sort_order = local_folders
            .iter()
            .map(|folder| folder.sort_order)
            .max()
            .map_or(0, |sort_order| sort_order.saturating_add(1));
        for rf in &remote_folders {
            let existing_remote_index = local_folders
                .iter()
                .position(|folder| folder.remote_id.as_deref() == Some(rf.remote_id.as_str()));
            let existing_name_index = if existing_remote_index.is_none() {
                let remote_name_key = folder_name_case_key(&rf.name);
                local_folders
                    .iter()
                    .position(|folder| folder_name_case_key(&folder.name) == remote_name_key)
            } else {
                None
            };
            let existing_index = existing_remote_index.or(existing_name_index);
            let existing_folder = existing_index.and_then(|index| local_folders.get(index));
            let sort_order = resolve_greader_folder_sort_order(
                rf.sort_order,
                existing_folder,
                &mut next_sort_order,
            );
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
    }
    info!(
        account_id = %account.id.as_ref(),
        account_name = %account.name,
        phase = "folders",
        elapsed_ms = folders_started_at.elapsed().as_millis() as u64,
        "FreshRSS sync phase completed"
    );

    // Steps 3-7
    let outcome = sync_greader_feeds(db, &provider, account).await?;

    info!(
        account_id = %account.id.as_ref(),
        account_name = %account.name,
        phase = "total",
        elapsed_ms = total_started_at.elapsed().as_millis() as u64,
        "FreshRSS sync phase completed"
    );

    Ok(outcome)
}

pub(super) async fn repair_greader_remote_state(
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

    let password = keyring_store::get_password(account.id.as_ref())?;
    provider
        .authenticate(&Credentials {
            token: Some(username),
            password: Some(password),
        })
        .await?;

    let (pending_read_remote_ids, pending_starred_remote_ids): (Vec<String>, Vec<String>) = {
        let db_guard = lock_db(db)?;
        let pending_repo = SqlitePendingMutationRepository::new(db_guard.reader());
        let pending = pending_repo.find_by_account(&account.id)?;
        let pending_read_ids = pending
            .iter()
            .filter(|pm| pm.mutation_type.axis() == PendingMutationAxis::ReadState)
            .map(|pm| pm.remote_entry_id.clone())
            .collect();
        let pending_starred_ids = pending
            .iter()
            .filter(|pm| pm.mutation_type.axis() == PendingMutationAxis::StarState)
            .map(|pm| pm.remote_entry_id.clone())
            .collect();
        (pending_read_ids, pending_starred_ids)
    };

    let remote_state = provider.pull_state().await?;
    let feeds = {
        let db_guard = lock_db(db)?;
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        article_repo.apply_remote_state(
            &account.id,
            &remote_state.read_ids,
            &remote_state.starred_ids,
            &pending_read_remote_ids,
            &pending_starred_remote_ids,
        )?;

        let feed_repo = SqliteFeedRepository::new(db_guard.reader());
        feed_repo.find_by_account(&account.id)?
    };

    {
        let db_guard = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        for feed in &feeds {
            if is_provider_managed_greader_feed(feed.remote_id.as_deref()) {
                feed_repo.recalculate_unread_count(&feed.id)?;
            }
        }
    }

    let server_unread_counts = provider.get_unread_count_map().await?;
    let _ = reconcile_greader_unread_counts(db, &provider, account, &feeds, &server_unread_counts)
        .await?;
    mark_remote_state_sync_completed(db, &account.id, now)?;

    Ok(())
}

pub(super) async fn sync_greader_feed(
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

    let password = keyring_store::get_password(account.id.as_ref())?;
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
    {
        let db_guard = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        feed_repo.recalculate_unread_count(&feed.id)?;
    }
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
        });
    }

    Ok(ProviderSyncOutcome { warnings })
}

fn is_provider_managed_greader_feed(remote_id: Option<&str>) -> bool {
    remote_id.is_some_and(|remote_id| remote_id.starts_with("feed/"))
}

fn resolve_greader_subscription_folder_id(
    remote_folder_id: Option<&str>,
    folder_remote_id_map: &HashMap<String, FolderId>,
    existing_feed: Option<&Feed>,
) -> Option<FolderId> {
    remote_folder_id
        .and_then(|remote_id| folder_remote_id_map.get(remote_id))
        .cloned()
        .or_else(|| existing_feed.and_then(|feed| feed.folder_id.clone()))
}

fn save_greader_subscriptions(
    db: &Mutex<DbManager>,
    account: &Account,
    folder_remote_id_map: &HashMap<String, FolderId>,
    remote_subs: &[RemoteSubscription],
    sync_started_remote_feed_ids: &HashSet<String>,
) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    for rs in remote_subs {
        let existing = feed_repo.find_by_remote_id(&account.id, &rs.remote_id)?;
        if existing.is_none() && sync_started_remote_feed_ids.contains(&rs.remote_id) {
            continue;
        }
        let feed = Feed {
            id: existing
                .as_ref()
                .map(|f| f.id.clone())
                .unwrap_or_else(FeedId::new),
            account_id: account.id.clone(),
            folder_id: resolve_greader_subscription_folder_id(
                rs.folder_remote_id.as_deref(),
                folder_remote_id_map,
                existing.as_ref(),
            ),
            remote_id: Some(rs.remote_id.clone()),
            title: rs.title.clone(),
            url: rs.url.clone(),
            site_url: rs.site_url.clone(),
            icon: existing.as_ref().and_then(|f| f.icon.clone()),
            unread_count: 0,
            reader_mode: existing
                .as_ref()
                .map(|f| f.reader_mode.clone())
                .unwrap_or_else(|| "inherit".to_string()),
            web_preview_mode: existing
                .as_ref()
                .map(|f| f.web_preview_mode.clone())
                .unwrap_or_else(|| "inherit".to_string()),
        };
        feed_repo.save(&feed)?;
    }
    Ok(())
}

fn delete_missing_greader_subscriptions(
    db: &Mutex<DbManager>,
    account: &Account,
    remote_subscription_ids: &HashSet<String>,
) -> Result<usize, AppError> {
    let db_guard = lock_db(db)?;
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    let feeds = feed_repo.find_by_account(&account.id)?;
    let mut deleted_count = 0usize;

    for feed in feeds {
        let Some(remote_id) = feed.remote_id.as_deref() else {
            continue;
        };
        if !is_provider_managed_greader_feed(Some(remote_id))
            || remote_subscription_ids.contains(remote_id)
        {
            continue;
        }

        info!(
            account_id = %account.id.as_ref(),
            account_name = %account.name,
            feed_id = %feed.id.as_ref(),
            remote_id = %remote_id,
            feed_title = %feed.title,
            "Deleting local FreshRSS feed missing from remote subscriptions"
        );
        feed_repo.delete(&feed.id)?;
        deleted_count = deleted_count.saturating_add(1);
    }

    Ok(deleted_count)
}

fn provider_managed_remote_feed_ids(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> Result<HashSet<String>, AppError> {
    let db_guard = lock_db(db)?;
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    Ok(feed_repo
        .find_by_account(account_id)?
        .into_iter()
        .filter_map(|feed| feed.remote_id)
        .filter(|remote_id| is_provider_managed_greader_feed(Some(remote_id)))
        .collect())
}

fn folder_name_case_key(name: &str) -> String {
    name.trim().to_lowercase()
}

fn resolve_greader_folder_sort_order(
    remote_sort_order: Option<i32>,
    existing_folder: Option<&Folder>,
    next_sort_order: &mut i32,
) -> i32 {
    remote_sort_order
        .or_else(|| existing_folder.map(|folder| folder.sort_order))
        .unwrap_or_else(|| {
            let sort_order = *next_sort_order;
            *next_sort_order = next_sort_order.saturating_add(1);
            sort_order
        })
}

fn pending_mutation_targets_provider_managed_greader_feed(
    db: &Mutex<DbManager>,
    pending_mutation_id: i64,
) -> Result<bool, AppError> {
    let db_guard = lock_db(db)?;
    match db_guard.reader().query_row(
        "SELECT EXISTS (
                 SELECT 1
                 FROM pending_mutations pm
                 JOIN articles a ON a.remote_id = pm.remote_entry_id
                 JOIN feeds f ON f.id = a.feed_id
                 WHERE pm.id = ?1
                   AND f.account_id = pm.account_id
                   AND f.remote_id LIKE 'feed/%'
             ) AND NOT EXISTS (
                 SELECT 1
                 FROM pending_mutations pm
                 JOIN articles a ON a.remote_id = pm.remote_entry_id
                 JOIN feeds f ON f.id = a.feed_id
                 WHERE pm.id = ?1
                   AND f.account_id = pm.account_id
                   AND (f.remote_id IS NULL OR f.remote_id NOT LIKE 'feed/%')
             )",
        rusqlite::params![pending_mutation_id],
        |row| row.get::<_, bool>(0),
    ) {
        Ok(targets_provider_feed) => Ok(targets_provider_feed),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(false),
        Err(error) => Err(AppError::from(crate::domain::error::DomainError::from(
            error,
        ))),
    }
}

async fn sync_greader_account_entries(
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
                    "Sync anomaly for account '{}' remote feed '{}': no local feed mapping",
                    account.name, remote_id
                );
                skipped_entries += 1;
                continue;
            };

            seen_feed_ids.insert(feed.id.as_ref().to_string());
            articles.push(build_article_from_remote_entry(account, feed, entry));
        }

        if !articles.is_empty() {
            let candidate_ids = articles
                .iter()
                .map(|article| article.id.clone())
                .collect::<Vec<_>>();
            entries_upserted += articles.len();

            let db_guard = lock_db(db)?;
            let article_repo = SqliteArticleRepository::new(db_guard.writer());
            article_repo.upsert(&articles)?;
            article_repo.mark_muted_unread_as_read(&account.id, Some(&candidate_ids))?;
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
async fn sync_greader_feeds(
    db: &Mutex<DbManager>,
    provider: &GReaderProvider,
    account: &Account,
) -> Result<ProviderSyncOutcome, AppError> {
    let total_started_at = Instant::now();
    let article_counts_before = provider_managed_feed_snapshots(db, &account.id)?;
    let sync_started_remote_feed_ids = provider_managed_remote_feed_ids(db, &account.id)?;

    let folder_remote_id_map: HashMap<String, FolderId> = {
        let db_guard = lock_db(db)?;
        let folder_repo = SqliteFolderRepository::new(db_guard.reader());
        let folders = folder_repo.find_by_account(&account.id)?;
        folders
            .into_iter()
            .filter_map(|folder| folder.remote_id.map(|remote_id| (remote_id, folder.id)))
            .collect()
    };

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
        account_name = %account.name,
        phase = "subscriptions",
        deleted_subscription_count = deleted_subscription_count,
        elapsed_ms = subscriptions_started_at.elapsed().as_millis() as u64,
        "FreshRSS sync phase completed"
    );

    let feeds = {
        let db_guard = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db_guard.reader());
        feed_repo.find_by_account(&account.id)?
    };

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
            });
        }
    }
    for feed in &feeds {
        if is_provider_managed_greader_feed(feed.remote_id.as_deref()) {
            continue;
        }
        if let Err(error) = sync_local_feed(db, &local_provider, &account.id, feed).await {
            warn!("Failed to pull entries for feed {}: {error}", feed.url);
            warnings.push(ProviderSyncWarning {
                kind: AccountSyncWarningKind::Generic,
                message: format!(
                    "Local feed '{}' failed during provider sync: {error}",
                    feed.title
                ),
                retry_at: None,
                retry_in_seconds: None,
            });
        }
    }
    info!(
        account_id = %account.id.as_ref(),
        account_name = %account.name,
        phase = "account_delta_entries",
        elapsed_ms = account_entries_started_at.elapsed().as_millis() as u64,
        feeds_seen = account_entries_outcome.feeds_seen,
        entries_upserted = account_entries_outcome.entries_upserted,
        delta_pages = account_entries_outcome.delta_pages,
        skipped_entries = account_entries_outcome.skipped_entries,
        "FreshRSS sync phase completed"
    );

    let pending_mutations = {
        let db_guard = lock_db(db)?;
        let pending_repo = SqlitePendingMutationRepository::new(db_guard.reader());
        pending_repo.find_by_account(&account.id)?
    };

    let mut pushed_read_remote_ids: Vec<String> = Vec::new();
    let mut pushed_starred_remote_ids: Vec<String> = Vec::new();
    for pm in &pending_mutations {
        let Some(pending_mutation_id) = pm.id else {
            continue;
        };

        if !pending_mutation_targets_provider_managed_greader_feed(db, pending_mutation_id)? {
            warn!(
                "Dropping pending mutation {} for non-GReader feed entry {}",
                pm.mutation_type.as_str(),
                pm.remote_entry_id
            );
            warnings.push(dropped_pending_mutation_warning(pm.mutation_type));
            let db_guard = lock_db(db)?;
            let pending_repo = SqlitePendingMutationRepository::new(db_guard.writer());
            pending_repo.delete(&[pending_mutation_id])?;
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
                let db_guard = lock_db(db)?;
                let pending_repo = SqlitePendingMutationRepository::new(db_guard.writer());
                pending_repo.delete(&[pending_mutation_id])?;
            }
            Err(error) => {
                warn!(
                    "Failed to push mutation {} for entry {}: {error}. Will retry next sync.",
                    pm.mutation_type.as_str(),
                    pm.remote_entry_id
                );
                warnings.push(pending_mutation_retry_warning(pm.mutation_type));
            }
        }
    }

    let pull_state_started_at = Instant::now();
    let (pending_read_remote_ids, pending_starred_remote_ids): (Vec<String>, Vec<String>) = {
        let db_guard = lock_db(db)?;
        let pending_repo = SqlitePendingMutationRepository::new(db_guard.reader());
        let pending = pending_repo.find_by_account(&account.id)?;
        let mut read_ids: Vec<String> = pending
            .iter()
            .filter(|pm| pm.mutation_type.axis() == PendingMutationAxis::ReadState)
            .map(|pm| pm.remote_entry_id.clone())
            .collect();
        read_ids.extend(pushed_read_remote_ids);
        read_ids.sort();
        read_ids.dedup();

        let mut starred_ids: Vec<String> = pending
            .iter()
            .filter(|pm| pm.mutation_type.axis() == PendingMutationAxis::StarState)
            .map(|pm| pm.remote_entry_id.clone())
            .collect();
        starred_ids.extend(pushed_starred_remote_ids);
        starred_ids.sort();
        starred_ids.dedup();

        (read_ids, starred_ids)
    };
    let now = chrono::Utc::now();
    let should_pull_remote_state = should_pull_remote_state(db, &account.id, now)?;
    if should_pull_remote_state {
        let remote_state = provider.pull_state().await?;
        {
            let db_guard = lock_db(db)?;
            let article_repo = SqliteArticleRepository::new(db_guard.writer());
            article_repo.apply_remote_state(
                &account.id,
                &remote_state.read_ids,
                &remote_state.starred_ids,
                &pending_read_remote_ids,
                &pending_starred_remote_ids,
            )?;
        }
        mark_remote_state_sync_completed(db, &account.id, now)?;
    }
    info!(
        account_id = %account.id.as_ref(),
        account_name = %account.name,
        phase = "pull_state",
        elapsed_ms = pull_state_started_at.elapsed().as_millis() as u64,
        skipped = !should_pull_remote_state,
        "FreshRSS sync phase completed"
    );

    {
        let db_guard = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        for feed in &feeds {
            feed_repo.recalculate_unread_count(&feed.id)?;
        }
    }

    let unread_reconcile_started_at = Instant::now();
    let server_unread_counts = provider.get_unread_count_map().await?;
    let backfilled_feeds =
        reconcile_greader_unread_counts(db, provider, account, &feeds, &server_unread_counts)
            .await?;
    info!(
        account_id = %account.id.as_ref(),
        account_name = %account.name,
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
                "Sync anomaly for account '{}' feed '{}': article count dropped from {} to 0 after sync",
                account.name,
                feed.title,
                before_count
            );
            warnings.push(ProviderSyncWarning {
                kind: AccountSyncWarningKind::Generic,
                message: format!(
                    "Feed '{}' had {} saved article(s) before sync and 0 after sync.",
                    feed.title, before_count
                ),
                retry_at: None,
                retry_in_seconds: None,
            });
        }
    }

    info!(
        account_id = %account.id.as_ref(),
        account_name = %account.name,
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

async fn reconcile_greader_unread_counts(
    db: &Mutex<DbManager>,
    provider: &GReaderProvider,
    account: &Account,
    feeds: &[Feed],
    server_unread_counts: &HashMap<String, i32>,
) -> Result<usize, AppError> {
    let mut backfilled_feeds = 0usize;
    for feed in feeds {
        let Some(remote_id) = feed.remote_id.as_deref() else {
            continue;
        };
        if !is_provider_managed_greader_feed(Some(remote_id)) {
            continue;
        }

        let server_unread_count = server_unread_counts.get(remote_id).copied().unwrap_or(0);
        let local_unread_count = {
            let db_guard = lock_db(db)?;
            let feed_repo = SqliteFeedRepository::new(db_guard.reader());
            feed_repo
                .find_by_id(&feed.id)?
                .map(|current_feed| current_feed.unread_count)
                .unwrap_or(0)
        };

        if server_unread_count != local_unread_count {
            reconcile_greader_unread_state_for_feed(db, provider, account, feed).await?;
            if server_unread_count > local_unread_count {
                backfilled_feeds += 1;
            }
        }

        let db_guard = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        feed_repo.recalculate_unread_count(&feed.id)?;
    }

    Ok(backfilled_feeds)
}

async fn reconcile_greader_unread_state_for_feed(
    db: &Mutex<DbManager>,
    provider: &GReaderProvider,
    account: &Account,
    feed: &Feed,
) -> Result<(), AppError> {
    let unread_remote_ids =
        fetch_greader_unread_entries_for_feed(db, provider, account, feed).await?;
    let pending_remote_ids = {
        let db_guard = lock_db(db)?;
        let pending_repo = SqlitePendingMutationRepository::new(db_guard.reader());
        pending_repo
            .find_by_account(&account.id)?
            .into_iter()
            .filter(|mutation| mutation.mutation_type.axis() == PendingMutationAxis::ReadState)
            .map(|mutation| mutation.remote_entry_id)
            .collect::<HashSet<_>>()
    };

    let db_guard = lock_db(db)?;
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
                    !unread_remote_ids.contains(&remote_id),
                    article_id
                ])
                .map_err(crate::domain::error::DomainError::from)
                .map_err(AppError::from)?;
        }
    }

    tx.commit()
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)?;
    drop(db_guard);

    let db_guard = lock_db(db)?;
    let article_repo = SqliteArticleRepository::new(db_guard.writer());
    article_repo.mark_muted_unread_as_read(&account.id, None)?;

    Ok(())
}

async fn fetch_greader_unread_entries_for_feed(
    db: &Mutex<DbManager>,
    provider: &GReaderProvider,
    account: &Account,
    feed: &Feed,
) -> Result<HashSet<String>, AppError> {
    let Some(remote_id) = feed.remote_id.as_deref() else {
        return Ok(HashSet::new());
    };

    let mut unread_remote_ids = HashSet::new();
    let mut cursor: Option<SyncCursor> = None;
    loop {
        let result = provider
            .pull_unread_entries_for_feed(remote_id, cursor.clone())
            .await?;

        let articles: Vec<Article> = result
            .entries
            .iter()
            .map(|entry| {
                if let Some(remote_id) = entry.id.as_ref() {
                    unread_remote_ids.insert(remote_id.clone());
                }
                build_article_from_remote_entry(account, feed, entry)
            })
            .collect();

        if !articles.is_empty() {
            let db_guard = lock_db(db)?;
            let article_repo = SqliteArticleRepository::new(db_guard.writer());
            article_repo.upsert(&articles)?;
            let candidate_ids = articles
                .iter()
                .map(|article| article.id.clone())
                .collect::<Vec<_>>();
            article_repo.mark_muted_unread_as_read(&account.id, Some(&candidate_ids))?;
        }

        if !result.has_more {
            break;
        }
        cursor = result.next_cursor;
    }

    Ok(unread_remote_ids)
}

fn feed_scope_key(remote_id: &str) -> SyncStateScopeKey {
    SyncStateScopeKey::feed(remote_id)
}

fn local_feed_scope_key(feed_url: &str) -> SyncStateScopeKey {
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

fn article_count_for_feed(db: &Mutex<DbManager>, feed_id: &FeedId) -> Result<usize, AppError> {
    let db_guard = lock_db(db)?;
    let count = db_guard
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE feed_id = ?1",
            rusqlite::params![feed_id.as_ref()],
            |row| row.get::<_, i64>(0),
        )
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)?;
    Ok(count as usize)
}

fn cursor_from_state(state: Option<&SyncState>) -> Option<SyncCursor> {
    state.map(|state| SyncCursor {
        // Cross-sync resumes are timestamp-based. Continuation tokens are only
        // valid within a single pagination run and must not be revived later.
        continuation: None,
        since: sync_state_timestamp_usec(Some(state))
            .and_then(chrono::DateTime::from_timestamp_micros),
        etag: None,
        last_modified: None,
    })
}

async fn sync_greader_feed_entries(
    db: &Mutex<DbManager>,
    provider: &GReaderProvider,
    account: &Account,
    feed: &Feed,
) -> Result<GReaderFeedSyncOutcome, AppError> {
    let Some(remote_id) = feed.remote_id.as_ref() else {
        return Ok(GReaderFeedSyncOutcome::default());
    };

    let scope_key = feed_scope_key(remote_id);
    let saved_state = {
        let db_guard = lock_db(db)?;
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
        sync_state_repo.get(&account.id, &scope_key)?
    };
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
            .map(|entry| {
                let id = generate_entry_id(
                    account.id.as_ref(),
                    entry.id.as_deref(),
                    &feed.url,
                    entry.url.as_deref(),
                    Some(&entry.title),
                );
                Article {
                    id,
                    feed_id: feed.id.clone(),
                    remote_id: entry.id.clone(),
                    title: entry.title.clone(),
                    content_raw: entry.content.clone(),
                    content_sanitized: sanitizer::sanitize_html(&entry.content),
                    sanitizer_version: sanitizer::SANITIZER_VERSION,
                    summary: entry.summary.clone(),
                    url: entry.url.clone(),
                    author: entry.author.clone(),
                    published_at: entry.published_at.unwrap_or_else(chrono::Utc::now),
                    thumbnail: entry.thumbnail.clone(),
                    is_read: entry.is_read.unwrap_or(false),
                    is_starred: entry.is_starred.unwrap_or(false),
                    fetched_at: chrono::Utc::now(),
                }
            })
            .collect();

        if !articles.is_empty() {
            let db_guard = lock_db(db)?;
            let article_repo = SqliteArticleRepository::new(db_guard.writer());
            article_repo.upsert(&articles)?;
            let candidate_ids = articles
                .iter()
                .map(|article| article.id.clone())
                .collect::<Vec<_>>();
            article_repo.mark_muted_unread_as_read(&account.id, Some(&candidate_ids))?;
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
    let db_guard = lock_db(db)?;
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
    sync_state_repo.save(&next_state)?;

    Ok(GReaderFeedSyncOutcome { skipped_entries })
}

fn provider_managed_feed_snapshots(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> Result<HashMap<String, ProviderManagedFeedSnapshot>, AppError> {
    let db_guard = lock_db(db)?;
    let mut stmt = db_guard
        .reader()
        .prepare(
            "SELECT f.id, f.title, COUNT(a.id)
         FROM feeds f
         LEFT JOIN articles a ON a.feed_id = f.id
         WHERE f.account_id = ?1 AND f.remote_id LIKE 'feed/%'
         GROUP BY f.id, f.title",
        )
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::account::ConnectionVerificationStatus;
    use crate::domain::provider::ProviderKind;
    use crate::infra::db::sqlite_account::SqliteAccountRepository;
    use crate::repository::account::AccountRepository;
    use crate::repository::article::{ArticleRepository, Pagination};
    use mockito::Matcher;
    use std::borrow::Cow;

    const FEED_REMOTE_ID: &str = "feed/https://example.com/rss";
    const LOCAL_ETAG_OLD: &str = "\"etag-old\"";
    const LOCAL_ETAG_NEW: &str = "\"etag-new\"";
    const LOCAL_LAST_MODIFIED_OLD: &str = "Wed, 01 Jan 2025 00:00:00 GMT";
    const LOCAL_LAST_MODIFIED_NEW: &str = "Thu, 02 Jan 2025 00:00:00 GMT";
    static DEV_CREDENTIALS_ENV_LOCK: std::sync::LazyLock<tokio::sync::Mutex<()>> =
        std::sync::LazyLock::new(|| tokio::sync::Mutex::new(()));

    struct ProviderHttpResponseFixture<'a> {
        status: usize,
        headers: &'a [(&'a str, &'a str)],
        body: Cow<'a, str>,
    }

    impl<'a> ProviderHttpResponseFixture<'a> {
        fn status(status: usize) -> Self {
            Self {
                status,
                headers: &[],
                body: Cow::Borrowed(""),
            }
        }

        fn body(mut self, body: impl Into<Cow<'a, str>>) -> Self {
            self.body = body.into();
            self
        }

        fn headers(mut self, headers: &'a [(&'a str, &'a str)]) -> Self {
            self.headers = headers;
            self
        }

        fn ok(body: &'static str) -> ProviderHttpResponseFixture<'static> {
            ProviderHttpResponseFixture::status(200).body(body)
        }

        fn json(body: &'static str) -> ProviderHttpResponseFixture<'static> {
            Self::ok(body).headers(&[("content-type", "application/json")])
        }

        fn auth_token() -> ProviderHttpResponseFixture<'static> {
            Self::ok("Auth=tok\n")
        }

        fn empty_item_refs() -> ProviderHttpResponseFixture<'static> {
            Self::json(r#"{ "itemRefs": [] }"#)
        }
    }

    trait ProviderMockResponseExt {
        fn with_provider_response(self, response: ProviderHttpResponseFixture<'_>) -> Self;
    }

    impl ProviderMockResponseExt for mockito::Mock {
        fn with_provider_response(self, response: ProviderHttpResponseFixture<'_>) -> Self {
            response.headers.iter().fold(
                self.with_status(response.status)
                    .with_body(response.body.as_ref()),
                |mock, (name, value)| mock.with_header(*name, value),
            )
        }
    }

    struct DevCredentialsContext {
        _guard: tokio::sync::MutexGuard<'static, ()>,
        _dir: tempfile::TempDir,
        previous_home: Option<String>,
    }

    impl Drop for DevCredentialsContext {
        fn drop(&mut self) {
            std::env::remove_var("DEV_CREDENTIALS");
            std::env::remove_var("XDG_DATA_HOME");
            match self.previous_home.as_ref() {
                Some(home) => std::env::set_var("HOME", home),
                None => std::env::remove_var("HOME"),
            }
        }
    }
    const LOCAL_RSS_INITIAL: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
    <channel>
        <title>Local Feed</title>
        <item>
            <title>Local Article</title>
            <link>https://example.com/1</link>
            <guid>local-guid-1</guid>
        </item>
    </channel>
    </rss>"#;
    const LOCAL_RSS_UPDATED: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
    <channel>
        <title>Local Feed</title>
        <item>
            <title>Local Article Updated</title>
            <link>https://example.com/1</link>
            <guid>local-guid-1</guid>
        </item>
    </channel>
    </rss>"#;

    fn test_db() -> Mutex<DbManager> {
        Mutex::new(DbManager::new_in_memory().unwrap())
    }

    fn test_account(server_url: &str) -> Account {
        Account {
            id: AccountId::new(),
            kind: ProviderKind::FreshRss,
            name: "FreshRSS".to_string(),
            server_url: Some(server_url.to_string()),
            username: Some("u".to_string()),
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        }
    }

    #[test]
    fn delete_missing_greader_subscriptions_removes_only_remote_managed_feeds() {
        let db = test_db();
        let (account, feeds) = insert_account_and_feeds(
            &db,
            "https://rss.example.com",
            &[
                (
                    "feed/https://example.com/present.xml",
                    "Present",
                    "https://example.com/present.xml",
                    "https://example.com",
                ),
                (
                    "feed/https://example.com/stale.xml",
                    "Stale",
                    "https://example.com/stale.xml",
                    "https://example.com",
                ),
            ],
        );
        let local_feed = Feed {
            id: FeedId("feed-local".to_string()),
            account_id: account.id.clone(),
            folder_id: None,
            remote_id: None,
            title: "Local".to_string(),
            url: "https://example.com/local.xml".to_string(),
            site_url: "https://example.com".to_string(),
            icon: None,
            unread_count: 0,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        };
        {
            let db_guard = db.lock().unwrap();
            let feed_repo = SqliteFeedRepository::new(db_guard.writer());
            feed_repo.save(&local_feed).unwrap();
        }
        let remote_ids = HashSet::from(["feed/https://example.com/present.xml".to_string()]);

        let deleted_count =
            delete_missing_greader_subscriptions(&db, &account, &remote_ids).unwrap();

        assert_eq!(deleted_count, 1);
        let db_guard = db.lock().unwrap();
        let feed_repo = SqliteFeedRepository::new(db_guard.reader());
        assert!(feed_repo.find_by_id(&feeds[0].id).unwrap().is_some());
        assert!(feed_repo.find_by_id(&feeds[1].id).unwrap().is_none());
        assert!(feed_repo.find_by_id(&local_feed.id).unwrap().is_some());
    }

    #[test]
    fn save_greader_subscriptions_does_not_recreate_feed_deleted_after_sync_started() {
        let db = test_db();
        let (account, feed) = insert_account_and_feed(&db, "https://rss.example.com");
        let sync_started_remote_feed_ids =
            HashSet::from([feed.remote_id.clone().expect("test feed has remote id")]);
        {
            let db_guard = db.lock().unwrap();
            let feed_repo = SqliteFeedRepository::new(db_guard.writer());
            feed_repo
                .delete(&feed.id)
                .expect("test feed delete should succeed");
        }

        save_greader_subscriptions(
            &db,
            &account,
            &HashMap::new(),
            &[RemoteSubscription {
                remote_id: FEED_REMOTE_ID.to_string(),
                title: "Example Feed".to_string(),
                url: "https://example.com/rss".to_string(),
                site_url: "https://example.com".to_string(),
                folder_remote_id: None,
                icon_url: None,
            }],
            &sync_started_remote_feed_ids,
        )
        .expect("stale subscription persist should skip deleted feed without failing");

        let db_guard = db.lock().unwrap();
        let feed_repo = SqliteFeedRepository::new(db_guard.reader());
        assert!(
            feed_repo.find_by_id(&feed.id).unwrap().is_none(),
            "in-flight subscription sync must not recreate a feed deleted after sync started"
        );
        assert!(
            feed_repo
                .find_by_remote_id(&account.id, FEED_REMOTE_ID)
                .unwrap()
                .is_none(),
            "deleted remote feed must stay absent after stale subscription persist"
        );
    }

    #[test]
    fn save_greader_subscriptions_persists_new_remote_subscription_not_seen_at_sync_start() {
        let db = test_db();
        let account = test_account("https://rss.example.com");
        {
            let db_guard = db.lock().unwrap();
            let account_repo = SqliteAccountRepository::new(db_guard.writer());
            account_repo.save(&account).unwrap();
        }

        save_greader_subscriptions(
            &db,
            &account,
            &HashMap::new(),
            &[RemoteSubscription {
                remote_id: FEED_REMOTE_ID.to_string(),
                title: "Example Feed".to_string(),
                url: "https://example.com/rss".to_string(),
                site_url: "https://example.com".to_string(),
                folder_remote_id: None,
                icon_url: None,
            }],
            &HashSet::new(),
        )
        .expect("new subscription persist should succeed");

        let db_guard = db.lock().unwrap();
        let feed_repo = SqliteFeedRepository::new(db_guard.reader());
        assert!(
            feed_repo
                .find_by_remote_id(&account.id, FEED_REMOTE_ID)
                .unwrap()
                .is_some(),
            "remote subscriptions not present at sync start are regular additions"
        );
    }

    #[test]
    fn pending_mutation_retry_warning_keeps_remote_entry_id_out_of_public_copy() {
        let warning = pending_mutation_retry_warning(PendingMutationType::MarkRead);

        assert_eq!(warning.kind, AccountSyncWarningKind::RetryPending);
        assert_eq!(
            warning.message,
            "Local change 'mark_read' will retry next sync."
        );
        assert!(!warning.message.contains("remote_entry_id"));
        assert!(!warning.message.contains("https://"));
    }

    #[test]
    fn dropped_pending_mutation_warning_is_user_visible_without_remote_entry_id() {
        let warning = dropped_pending_mutation_warning(PendingMutationType::Star);

        assert_eq!(warning.kind, AccountSyncWarningKind::Generic);
        assert_eq!(
            warning.message,
            "Local change 'star' could not be sent because the feed is no longer managed by FreshRSS. Sync again after refreshing the feed."
        );
        assert!(!warning.message.contains("remote_entry_id"));
        assert!(!warning.message.contains("https://"));
    }

    #[test]
    fn should_pull_remote_state_ignores_future_success_timestamp() {
        let db = test_db();
        let account = test_account("https://rss.example.com");
        let now = chrono::DateTime::parse_from_rfc3339("2026-05-10T00:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);
        {
            let db_guard = db.lock().unwrap();
            let account_repo = SqliteAccountRepository::new(db_guard.writer());
            let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
            account_repo.save(&account).unwrap();
            sync_state_repo
                .save(&SyncState {
                    account_id: account.id.clone(),
                    scope_key: SyncStateScopeKey::greader_remote_state_full().as_string(),
                    timestamp_usec: Some((now + chrono::Duration::hours(1)).timestamp_micros()),
                    continuation: None,
                    etag: None,
                    last_modified: None,
                    last_success_at: Some((now + chrono::Duration::hours(1)).to_rfc3339()),
                    last_error: None,
                    error_count: 0,
                    next_retry_at: None,
                })
                .unwrap();
        }

        assert!(should_pull_remote_state(&db, &account.id, now).unwrap());
    }

    #[test]
    fn greader_cursor_timestamp_policy_ignores_invalid_saved_and_entry_values() {
        let future = chrono::Utc::now() + chrono::Duration::hours(1);
        let saved_state = SyncState {
            account_id: AccountId("account".to_string()),
            scope_key: feed_scope_key("feed/remote").as_string(),
            timestamp_usec: Some(future.timestamp_micros()),
            continuation: Some("stale-page".to_string()),
            etag: Some("etag".to_string()),
            last_modified: Some("Wed, 01 Jan 2025 00:00:00 GMT".to_string()),
            last_success_at: None,
            last_error: None,
            error_count: 0,
            next_retry_at: None,
        };
        let cursor = cursor_from_state(Some(&saved_state))
            .expect("existing sync state should still build a cursor");

        assert_eq!(cursor.continuation, None);
        assert_eq!(cursor.since, None);
        assert_eq!(sync_state_timestamp_usec(Some(&saved_state)), None);

        let mut latest_timestamp_usec = Some(1_700_000_000_000_000);
        update_latest_timestamp_usec(
            &mut latest_timestamp_usec,
            Some(&SyncCursor {
                continuation: None,
                since: Some(future),
                etag: None,
                last_modified: None,
            }),
        );
        assert_eq!(latest_timestamp_usec, Some(1_700_000_000_000_000));
    }

    #[test]
    fn pending_mutation_target_lookup_returns_db_error_without_deleting_pending_mutation() {
        let db = test_db();
        let account = test_account("https://rss.example.com");
        let pending_mutation_id = {
            let db_guard = db.lock().unwrap();
            let account_repo = SqliteAccountRepository::new(db_guard.writer());
            account_repo.save(&account).unwrap();
            db_guard
                .writer()
                .execute(
                    "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![
                        account.id.as_ref(),
                        PendingMutationType::MarkRead.as_str(),
                        "entry-1",
                        "2024-01-01T00:00:00Z"
                    ],
                )
                .unwrap();
            let pending_mutation_id = db_guard.writer().last_insert_rowid();
            db_guard
                .writer()
                .execute("DROP TABLE articles", [])
                .unwrap();
            pending_mutation_id
        };

        let result =
            pending_mutation_targets_provider_managed_greader_feed(&db, pending_mutation_id);

        assert!(result.is_err());
        let pending_count: i64 = db
            .lock()
            .unwrap()
            .reader()
            .query_row("SELECT COUNT(*) FROM pending_mutations", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(pending_count, 1);
    }

    #[test]
    fn pending_mutation_target_lookup_treats_missing_target_as_non_greader() {
        let db = test_db();
        let account = test_account("https://rss.example.com");
        let pending_mutation_id = {
            let db_guard = db.lock().unwrap();
            let account_repo = SqliteAccountRepository::new(db_guard.writer());
            account_repo.save(&account).unwrap();
            db_guard
                .writer()
                .execute(
                    "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![
                        account.id.as_ref(),
                        PendingMutationType::MarkRead.as_str(),
                        "missing-entry",
                        "2024-01-01T00:00:00Z"
                    ],
                )
                .unwrap();
            db_guard.writer().last_insert_rowid()
        };

        let targets_greader =
            pending_mutation_targets_provider_managed_greader_feed(&db, pending_mutation_id)
                .unwrap();

        assert!(!targets_greader);
    }

    #[test]
    fn pending_mutation_target_lookup_rejects_remote_entry_id_collision_across_feeds() {
        let db = test_db();
        let (account, feeds) = insert_account_and_feeds(
            &db,
            "https://rss.example.com",
            &[
                (
                    "",
                    "Local Collision",
                    "https://example.com/local.xml",
                    "https://example.com/local",
                ),
                (
                    "feed/https://example.com/remote.xml",
                    "Remote Collision",
                    "https://example.com/remote.xml",
                    "https://example.com/remote",
                ),
            ],
        );
        let remote_entry_id = "duplicate-entry";
        let pending_mutation_id = {
            let db_guard = db.lock().unwrap();
            let article_repo = SqliteArticleRepository::new(db_guard.writer());
            article_repo
                .upsert(&[
                    Article {
                        id: ArticleId("local-duplicate-entry".to_string()),
                        feed_id: feeds[0].id.clone(),
                        remote_id: Some(remote_entry_id.to_string()),
                        title: "Local Collision".to_string(),
                        content_raw: "body".to_string(),
                        content_sanitized: "body".to_string(),
                        sanitizer_version: sanitizer::SANITIZER_VERSION,
                        summary: None,
                        url: Some("https://example.com/local-entry".to_string()),
                        author: None,
                        published_at: chrono::Utc::now(),
                        thumbnail: None,
                        is_read: false,
                        is_starred: false,
                        fetched_at: chrono::Utc::now(),
                    },
                    Article {
                        id: ArticleId("remote-duplicate-entry".to_string()),
                        feed_id: feeds[1].id.clone(),
                        remote_id: Some(remote_entry_id.to_string()),
                        title: "Remote Collision".to_string(),
                        content_raw: "body".to_string(),
                        content_sanitized: "body".to_string(),
                        sanitizer_version: sanitizer::SANITIZER_VERSION,
                        summary: None,
                        url: Some("https://example.com/remote-entry".to_string()),
                        author: None,
                        published_at: chrono::Utc::now(),
                        thumbnail: None,
                        is_read: false,
                        is_starred: false,
                        fetched_at: chrono::Utc::now(),
                    },
                ])
                .unwrap();
            db_guard
                .writer()
                .execute(
                    "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![
                        account.id.as_ref(),
                        PendingMutationType::MarkRead.as_str(),
                        remote_entry_id,
                        "2024-01-01T00:00:00Z"
                    ],
                )
                .unwrap();
            db_guard.writer().last_insert_rowid()
        };

        let targets_greader =
            pending_mutation_targets_provider_managed_greader_feed(&db, pending_mutation_id)
                .unwrap();

        assert!(!targets_greader);
    }

    fn test_feed(account_id: &AccountId) -> Feed {
        Feed {
            id: FeedId::new(),
            account_id: account_id.clone(),
            folder_id: None,
            remote_id: Some(FEED_REMOTE_ID.to_string()),
            title: "Example Feed".to_string(),
            url: "https://example.com/rss".to_string(),
            site_url: "https://example.com".to_string(),
            icon: None,
            unread_count: 0,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        }
    }

    fn insert_account_and_feed(db: &Mutex<DbManager>, server_url: &str) -> (Account, Feed) {
        let account = test_account(server_url);
        let feed = test_feed(&account.id);

        let db_guard = db.lock().unwrap();
        let account_repo = SqliteAccountRepository::new(db_guard.writer());
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        account_repo.save(&account).unwrap();
        feed_repo.save(&feed).unwrap();

        (account, feed)
    }

    fn make_test_feed(
        account_id: &AccountId,
        remote_id: &str,
        title: &str,
        url: &str,
        site_url: &str,
    ) -> Feed {
        Feed {
            id: FeedId::new(),
            account_id: account_id.clone(),
            folder_id: None,
            remote_id: Some(remote_id.to_string()),
            title: title.to_string(),
            url: url.to_string(),
            site_url: site_url.to_string(),
            icon: None,
            unread_count: 0,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        }
    }

    fn insert_account_and_feeds(
        db: &Mutex<DbManager>,
        server_url: &str,
        feed_specs: &[(&str, &str, &str, &str)],
    ) -> (Account, Vec<Feed>) {
        let account = test_account(server_url);
        let feeds = feed_specs
            .iter()
            .map(|(remote_id, title, url, site_url)| {
                make_test_feed(&account.id, remote_id, title, url, site_url)
            })
            .collect::<Vec<_>>();

        let db_guard = db.lock().unwrap();
        let account_repo = SqliteAccountRepository::new(db_guard.writer());
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        account_repo.save(&account).unwrap();
        for feed in &feeds {
            feed_repo.save(feed).unwrap();
        }

        (account, feeds)
    }

    fn test_local_account() -> Account {
        Account {
            id: AccountId::new(),
            kind: ProviderKind::Local,
            name: "Local".to_string(),
            server_url: None,
            username: None,
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        }
    }

    fn test_local_feed(account_id: &AccountId, feed_url: &str) -> Feed {
        Feed {
            id: FeedId::new(),
            account_id: account_id.clone(),
            folder_id: None,
            remote_id: None,
            title: "Local Feed".to_string(),
            url: feed_url.to_string(),
            site_url: "https://example.com".to_string(),
            icon: None,
            unread_count: 0,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        }
    }

    fn insert_local_account_and_feed(db: &Mutex<DbManager>, feed_url: &str) -> (Account, Feed) {
        let account = test_local_account();
        let feed = test_local_feed(&account.id, feed_url);

        let db_guard = db.lock().unwrap();
        let account_repo = SqliteAccountRepository::new(db_guard.writer());
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        account_repo.save(&account).unwrap();
        feed_repo.save(&feed).unwrap();

        (account, feed)
    }

    async fn authenticated_provider(server_url: &str) -> GReaderProvider {
        let mut provider = GReaderProvider::for_freshrss(server_url);
        provider
            .authenticate(&Credentials {
                token: Some("u".to_string()),
                password: Some("p".to_string()),
            })
            .await
            .unwrap();
        provider
    }

    async fn configure_dev_credentials(account_id: &AccountId) -> DevCredentialsContext {
        let guard = DEV_CREDENTIALS_ENV_LOCK.lock().await;
        let previous_home = std::env::var("HOME").ok();
        std::env::set_var("DEV_CREDENTIALS", "1");
        let credentials_dir = tempfile::tempdir().unwrap();
        std::env::set_var("XDG_DATA_HOME", credentials_dir.path());
        std::env::set_var("HOME", credentials_dir.path());
        std::fs::create_dir_all(credentials_dir.path().join("ultra-rss-reader")).unwrap();
        std::fs::write(
            credentials_dir
                .path()
                .join("ultra-rss-reader")
                .join("dev-credentials.json"),
            "{}",
        )
        .unwrap();
        keyring_store::set_password(account_id.as_ref(), "p").unwrap();
        DevCredentialsContext {
            _guard: guard,
            _dir: credentials_dir,
            previous_home,
        }
    }

    #[test]
    fn resolve_greader_subscription_folder_id_preserves_existing_folder_when_remote_folder_is_missing(
    ) {
        let account_id = AccountId::new();
        let existing_folder_id = FolderId::new();
        let existing_feed = Feed {
            id: FeedId::new(),
            account_id,
            folder_id: Some(existing_folder_id.clone()),
            remote_id: Some("feed/https://example.com/rss".to_string()),
            title: "Feed".to_string(),
            url: "https://example.com/rss".to_string(),
            site_url: "https://example.com".to_string(),
            icon: None,
            unread_count: 0,
            reader_mode: "on".to_string(),
            web_preview_mode: "off".to_string(),
        };
        let folder_remote_id_map = HashMap::new();

        let resolved = resolve_greader_subscription_folder_id(
            Some("user/-/label/Deleted Remote Folder"),
            &folder_remote_id_map,
            Some(&existing_feed),
        );

        assert_eq!(resolved, Some(existing_folder_id));
    }

    #[test]
    fn resolve_greader_subscription_folder_id_uses_remote_folder_when_present() {
        let remote_folder_id = FolderId::new();
        let folder_remote_id_map = HashMap::from([(
            "user/-/label/Remote Folder".to_string(),
            remote_folder_id.clone(),
        )]);

        let resolved = resolve_greader_subscription_folder_id(
            Some("user/-/label/Remote Folder"),
            &folder_remote_id_map,
            None,
        );

        assert_eq!(resolved, Some(remote_folder_id));
    }

    #[test]
    fn resolve_greader_folder_sort_order_preserves_existing_order_when_remote_order_is_missing() {
        let account_id = AccountId::new();
        let folder = Folder {
            id: FolderId::new(),
            account_id,
            remote_id: Some("user/-/label/Tech".to_string()),
            name: "Tech".to_string(),
            sort_order: 7,
        };
        let mut next_sort_order = 12;

        let sort_order =
            resolve_greader_folder_sort_order(None, Some(&folder), &mut next_sort_order);

        assert_eq!(sort_order, 7);
        assert_eq!(next_sort_order, 12);
    }

    #[test]
    fn resolve_greader_folder_sort_order_assigns_new_missing_remote_order_to_tail() {
        let mut next_sort_order = 12;

        let sort_order = resolve_greader_folder_sort_order(None, None, &mut next_sort_order);

        assert_eq!(sort_order, 12);
        assert_eq!(next_sort_order, 13);
    }

    #[test]
    fn resolve_greader_folder_sort_order_prefers_remote_order_when_present() {
        let account_id = AccountId::new();
        let folder = Folder {
            id: FolderId::new(),
            account_id,
            remote_id: Some("user/-/label/Tech".to_string()),
            name: "Tech".to_string(),
            sort_order: 7,
        };
        let mut next_sort_order = 12;

        let sort_order =
            resolve_greader_folder_sort_order(Some(3), Some(&folder), &mut next_sort_order);

        assert_eq!(sort_order, 3);
        assert_eq!(next_sort_order, 12);
    }

    #[tokio::test]
    async fn sync_greader_account_uses_account_stream_for_full_sync_and_maps_entries_to_feeds() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_provider_response(ProviderHttpResponseFixture::auth_token())
            .create_async()
            .await;

        server
            .mock("GET", "/api/greader.php/reader/api/0/tag/list")
            .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_provider_response(ProviderHttpResponseFixture::json(r#"{ "tags": [] }"#))
            .create_async()
            .await;

        server
            .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
            .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_provider_response(ProviderHttpResponseFixture::json(
                r#"{
                    "subscriptions": [
                        {
                            "id": "feed/https://example.com/feed-1.xml",
                            "title": "Feed One",
                            "url": "https://example.com/feed-1.xml",
                            "htmlUrl": "https://example.com/one",
                            "categories": [],
                            "iconUrl": "https://example.com/icon-one.png"
                        },
                        {
                            "id": "feed/https://example.com/feed-2.xml",
                            "title": "Feed Two",
                            "url": "https://example.com/feed-2.xml",
                            "htmlUrl": "https://example.com/two",
                            "categories": []
                        }
                    ]
                }"#,
            ))
            .create_async()
            .await;

        let account_stream_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_provider_response(ProviderHttpResponseFixture::json(
                r#"{
                    "items": [
                        {
                            "id": "entry-1",
                            "title": "Article One",
                            "alternate": [{"href": "https://example.com/articles/1"}],
                            "summary": {"content": "Summary One"},
                            "content": {"content": "<p>Body One</p>"},
                            "timestampUsec": "1700000100000000",
                            "published": 1700000000,
                            "updated": 1700000100,
                            "origin": {
                                "streamId": "feed/https://example.com/feed-1.xml",
                                "title": "Feed One"
                            },
                            "categories": ["user/-/state/com.google/reading-list"]
                        },
                        {
                            "id": "entry-2",
                            "title": "Article Two",
                            "alternate": [{"href": "https://example.com/articles/2"}],
                            "summary": {"content": "Summary Two"},
                            "content": {"content": "<p>Body Two</p>"},
                            "timestampUsec": "1700000200000000",
                            "published": 1700000100,
                            "updated": 1700000200,
                            "origin": {
                                "streamId": "feed/https://example.com/feed-2.xml",
                                "title": "Feed Two"
                            },
                            "categories": ["user/-/state/com.google/reading-list"]
                        }
                    ]
                }"#,
            ))
            .create_async()
            .await;

        let per_feed_one_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/feed%2Fhttps%3A%2F%2Fexample.com%2Ffeed-1.xml",
            )
            .expect(0)
            .create_async()
            .await;
        let per_feed_two_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/feed%2Fhttps%3A%2F%2Fexample.com%2Ffeed-2.xml",
            )
            .expect(0)
            .create_async()
            .await;

        server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "10000".into()),
                Matcher::UrlEncoded("s".into(), "user/-/state/com.google/read".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_provider_response(ProviderHttpResponseFixture::empty_item_refs())
            .create_async()
            .await;
        server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "10000".into()),
                Matcher::UrlEncoded("s".into(), "user/-/state/com.google/starred".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_provider_response(ProviderHttpResponseFixture::empty_item_refs())
            .create_async()
            .await;
        server
            .mock("GET", "/api/greader.php/reader/api/0/unread-count")
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("all".into(), "true".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_provider_response(ProviderHttpResponseFixture::json(
                r#"{
                    "unreadcounts": [
                        { "id": "feed/https://example.com/feed-1.xml", "count": 1 },
                        { "id": "feed/https://example.com/feed-2.xml", "count": 1 }
                    ]
                }"#,
            ))
            .create_async()
            .await;

        let db = test_db();
        let (account, feeds) = insert_account_and_feeds(
            &db,
            &server.url(),
            &[
                (
                    "feed/https://example.com/feed-1.xml",
                    "Feed One",
                    "https://example.com/feed-1.xml",
                    "https://example.com/one",
                ),
                (
                    "feed/https://example.com/feed-2.xml",
                    "Feed Two",
                    "https://example.com/feed-2.xml",
                    "https://example.com/two",
                ),
            ],
        );
        let _credentials = configure_dev_credentials(&account.id).await;

        let provider = GReaderProvider::for_freshrss(&server.url());
        let outcome = sync_greader_account(&db, &account, provider).await.unwrap();

        account_stream_mock.assert_async().await;
        per_feed_one_mock.assert_async().await;
        per_feed_two_mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.reader());
        let feed_repo = SqliteFeedRepository::new(db_guard.reader());
        let feed_one_articles = article_repo
            .find_by_feed(&feeds[0].id, &Pagination::default())
            .unwrap();
        let feed_two_articles = article_repo
            .find_by_feed(&feeds[1].id, &Pagination::default())
            .unwrap();
        let feed_one = feed_repo.find_by_id(&feeds[0].id).unwrap().unwrap();
        let feed_two = feed_repo.find_by_id(&feeds[1].id).unwrap().unwrap();

        assert!(outcome.warnings.is_empty());
        assert_eq!(feed_one.icon.as_deref(), None);
        assert_eq!(feed_one_articles.len(), 1);
        assert_eq!(feed_two_articles.len(), 1);
        assert_eq!(feed_one_articles[0].title, "Article One");
        assert_eq!(feed_two_articles[0].title, "Article Two");
        assert_eq!(feed_one.unread_count, 1);
        assert_eq!(feed_two.unread_count, 1);
    }

    #[tokio::test]
    async fn reconcile_greader_unread_counts_keeps_local_count_when_backfill_returns_no_articles() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let unread_stream_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/feed%2Fhttps%3A%2F%2Fexample.com%2Frss",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
                Matcher::UrlEncoded("xt".into(), "user/-/state/com.google/read".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "items": [] }"#)
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_account_and_feed(&db, &server.url());
        let provider = authenticated_provider(&server.url()).await;
        let server_unread_counts = HashMap::from([(FEED_REMOTE_ID.to_string(), 1)]);

        let backfilled = reconcile_greader_unread_counts(
            &db,
            &provider,
            &account,
            std::slice::from_ref(&feed),
            &server_unread_counts,
        )
        .await
        .unwrap();

        unread_stream_mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let feed_repo = SqliteFeedRepository::new(db_guard.reader());
        let reconciled_feed = feed_repo.find_by_id(&feed.id).unwrap().unwrap();

        assert_eq!(backfilled, 1);
        assert_eq!(reconciled_feed.unread_count, 0);
    }

    #[tokio::test]
    async fn reconcile_greader_unread_counts_marks_local_surplus_unread_as_read() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let unread_stream_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/feed%2Fhttps%3A%2F%2Fexample.com%2Frss",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
                Matcher::UrlEncoded("xt".into(), "user/-/state/com.google/read".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "items": [
                        {
                            "id": "tag:google.com,2005:reader/item/0000000000000001",
                            "title": "Still Unread",
                            "alternate": [{ "href": "https://example.com/1" }],
                            "categories": [],
                            "published": 1767225600
                        }
                    ]
                }"#,
            )
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_account_and_feed(&db, &server.url());
        let local_articles = [
            Article {
                id: generate_entry_id(
                    account.id.as_ref(),
                    Some("tag:google.com,2005:reader/item/0000000000000001"),
                    &feed.url,
                    Some("https://example.com/1"),
                    Some("Still Unread"),
                ),
                feed_id: feed.id.clone(),
                remote_id: Some("tag:google.com,2005:reader/item/0000000000000001".to_string()),
                title: "Still Unread".to_string(),
                content_raw: "body".to_string(),
                content_sanitized: "body".to_string(),
                sanitizer_version: sanitizer::SANITIZER_VERSION,
                summary: None,
                url: Some("https://example.com/1".to_string()),
                author: None,
                published_at: chrono::Utc::now(),
                thumbnail: None,
                is_read: false,
                is_starred: false,
                fetched_at: chrono::Utc::now(),
            },
            Article {
                id: generate_entry_id(
                    account.id.as_ref(),
                    Some("tag:google.com,2005:reader/item/0000000000000002"),
                    &feed.url,
                    Some("https://example.com/2"),
                    Some("Stale Unread"),
                ),
                feed_id: feed.id.clone(),
                remote_id: Some("tag:google.com,2005:reader/item/0000000000000002".to_string()),
                title: "Stale Unread".to_string(),
                content_raw: "body".to_string(),
                content_sanitized: "body".to_string(),
                sanitizer_version: sanitizer::SANITIZER_VERSION,
                summary: None,
                url: Some("https://example.com/2".to_string()),
                author: None,
                published_at: chrono::Utc::now(),
                thumbnail: None,
                is_read: false,
                is_starred: false,
                fetched_at: chrono::Utc::now(),
            },
        ];
        {
            let db_guard = db.lock().unwrap();
            let article_repo = SqliteArticleRepository::new(db_guard.writer());
            let feed_repo = SqliteFeedRepository::new(db_guard.writer());
            article_repo.upsert(&local_articles).unwrap();
            feed_repo.update_unread_count(&feed.id, 2).unwrap();
        }

        let provider = authenticated_provider(&server.url()).await;
        let server_unread_counts = HashMap::from([(FEED_REMOTE_ID.to_string(), 1)]);

        let backfilled = reconcile_greader_unread_counts(
            &db,
            &provider,
            &account,
            std::slice::from_ref(&feed),
            &server_unread_counts,
        )
        .await
        .unwrap();

        unread_stream_mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.reader());
        let feed_repo = SqliteFeedRepository::new(db_guard.reader());
        let articles = article_repo
            .find_by_feed(&feed.id, &Pagination::default())
            .unwrap();
        let reconciled_feed = feed_repo.find_by_id(&feed.id).unwrap().unwrap();
        let read_by_remote_id = articles
            .iter()
            .map(|article| (article.remote_id.as_deref(), article.is_read))
            .collect::<HashMap<_, _>>();

        assert_eq!(backfilled, 0);
        assert_eq!(reconciled_feed.unread_count, 1);
        assert_eq!(
            read_by_remote_id.get(&Some("tag:google.com,2005:reader/item/0000000000000001")),
            Some(&false)
        );
        assert_eq!(
            read_by_remote_id.get(&Some("tag:google.com,2005:reader/item/0000000000000002")),
            Some(&true)
        );
    }

    #[tokio::test]
    async fn reconcile_greader_unread_counts_does_not_treat_star_pending_as_read_pending() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let unread_stream_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/feed%2Fhttps%3A%2F%2Fexample.com%2Frss",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
                Matcher::UrlEncoded("xt".into(), "user/-/state/com.google/read".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "items": [] }"#)
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_account_and_feed(&db, &server.url());
        let remote_entry_id = "tag:google.com,2005:reader/item/star-pending-only";
        {
            let db_guard = db.lock().unwrap();
            let article_repo = SqliteArticleRepository::new(db_guard.writer());
            let feed_repo = SqliteFeedRepository::new(db_guard.writer());
            article_repo
                .upsert(&[Article {
                    id: generate_entry_id(
                        account.id.as_ref(),
                        Some(remote_entry_id),
                        &feed.url,
                        Some("https://example.com/star-pending"),
                        Some("Star Pending Only"),
                    ),
                    feed_id: feed.id.clone(),
                    remote_id: Some(remote_entry_id.to_string()),
                    title: "Star Pending Only".to_string(),
                    content_raw: "body".to_string(),
                    content_sanitized: "body".to_string(),
                    sanitizer_version: sanitizer::SANITIZER_VERSION,
                    summary: None,
                    url: Some("https://example.com/star-pending".to_string()),
                    author: None,
                    published_at: chrono::Utc::now(),
                    thumbnail: None,
                    is_read: false,
                    is_starred: false,
                    fetched_at: chrono::Utc::now(),
                }])
                .unwrap();
            feed_repo.update_unread_count(&feed.id, 1).unwrap();
            db_guard
                .writer()
                .execute(
                    "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![
                        account.id.as_ref(),
                        PendingMutationType::Star.as_str(),
                        remote_entry_id,
                        "2024-01-01T00:00:00Z"
                    ],
                )
                .unwrap();
        }

        let provider = authenticated_provider(&server.url()).await;
        let server_unread_counts = HashMap::from([(FEED_REMOTE_ID.to_string(), 0)]);

        reconcile_greader_unread_counts(
            &db,
            &provider,
            &account,
            std::slice::from_ref(&feed),
            &server_unread_counts,
        )
        .await
        .unwrap();

        unread_stream_mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.reader());
        let articles = article_repo
            .find_by_feed(&feed.id, &Pagination::default())
            .unwrap();

        assert_eq!(articles[0].remote_id.as_deref(), Some(remote_entry_id));
        assert!(articles[0].is_read);
    }

    #[tokio::test]
    async fn sync_greader_account_uses_account_sync_state_for_incremental_sync() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        server
            .mock("GET", "/api/greader.php/reader/api/0/tag/list")
            .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "tags": [] }"#)
            .create_async()
            .await;

        server
            .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
            .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "subscriptions": [
                        {
                            "id": "feed/https://example.com/feed-1.xml",
                            "title": "Feed One",
                            "url": "https://example.com/feed-1.xml",
                            "htmlUrl": "https://example.com/one",
                            "categories": []
                        }
                    ]
                }"#,
            )
            .create_async()
            .await;

        let account_stream_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
                Matcher::UrlEncoded("ot".into(), "1700000000000000".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "items": [] }"#)
            .create_async()
            .await;

        server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "10000".into()),
                Matcher::UrlEncoded("s".into(), "user/-/state/com.google/read".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "itemRefs": [] }"#)
            .create_async()
            .await;
        server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "10000".into()),
                Matcher::UrlEncoded("s".into(), "user/-/state/com.google/starred".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "itemRefs": [] }"#)
            .create_async()
            .await;
        server
            .mock("GET", "/api/greader.php/reader/api/0/unread-count")
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("all".into(), "true".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "unreadcounts": [] }"#)
            .create_async()
            .await;

        let db = test_db();
        let (account, _feeds) = insert_account_and_feeds(
            &db,
            &server.url(),
            &[(
                "feed/https://example.com/feed-1.xml",
                "Feed One",
                "https://example.com/feed-1.xml",
                "https://example.com/one",
            )],
        );
        {
            let db_guard = db.lock().unwrap();
            let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
            sync_state_repo
                .save(&SyncState {
                    account_id: account.id.clone(),
                    scope_key: SyncStateScopeKey::greader_account_all().as_string(),
                    timestamp_usec: Some(1_700_000_000_000_000),
                    continuation: None,
                    etag: None,
                    last_modified: None,
                    last_success_at: None,
                    last_error: Some("stale".to_string()),
                    error_count: 2,
                    next_retry_at: Some("2025-01-01T01:00:00Z".to_string()),
                })
                .unwrap();
        }
        let _credentials = configure_dev_credentials(&account.id).await;

        let provider = GReaderProvider::for_freshrss(&server.url());
        sync_greader_account(&db, &account, provider).await.unwrap();

        account_stream_mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
        let state = sync_state_repo
            .get(&account.id, &SyncStateScopeKey::greader_account_all())
            .unwrap()
            .unwrap();

        assert_eq!(state.timestamp_usec, Some(1_700_000_000_000_000));
        assert_eq!(state.last_error, None);
        assert_eq!(state.error_count, 0);
        assert_eq!(state.next_retry_at, None);
        assert!(state.last_success_at.is_some());
    }

    #[tokio::test]
    async fn sync_greader_account_entries_records_failure_state_when_later_page_fails() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let page1_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
                Matcher::UrlEncoded("ot".into(), "1700000000000000".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "items": [
                        {
                            "id": "entry-1",
                            "title": "Page 1",
                            "alternate": [{"href": "https://example.com/1"}],
                            "summary": {"content": "Summary 1"},
                            "timestampUsec": "1700000100000000",
                            "published": 1700000100,
                            "origin": {
                                "streamId": "feed/https://example.com/rss",
                                "title": "Example"
                            },
                            "categories": []
                        }
                    ],
                    "continuation": "page-2"
                }"#,
            )
            .create_async()
            .await;

        let page2_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
                Matcher::UrlEncoded("c".into(), "page-2".into()),
                Matcher::UrlEncoded("ot".into(), "1700000100000000".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(500)
            .with_body("boom")
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_account_and_feed(&db, &server.url());
        let saved_state = SyncState {
            account_id: account.id.clone(),
            scope_key: SyncStateScopeKey::greader_account_all().as_string(),
            timestamp_usec: Some(1_700_000_000_000_000),
            continuation: None,
            etag: Some("etag-old".to_string()),
            last_modified: Some("Wed, 01 Jan 2025 00:00:00 GMT".to_string()),
            last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
            last_error: Some("old error".to_string()),
            error_count: 1,
            next_retry_at: Some("2025-01-01T01:00:00Z".to_string()),
        };
        {
            let db_guard = db.lock().unwrap();
            let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
            sync_state_repo.save(&saved_state).unwrap();
        }

        let provider = authenticated_provider(&server.url()).await;
        let feeds_by_remote_id = HashMap::from([(FEED_REMOTE_ID.to_string(), feed.clone())]);
        let error = sync_greader_account_entries(&db, &provider, &account, &feeds_by_remote_id)
            .await
            .unwrap_err();

        page1_mock.assert_async().await;
        page2_mock.assert_async().await;
        assert!(error.to_string().contains("500"));

        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.reader());
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
        let articles = article_repo
            .find_by_feed(&feed.id, &Pagination::default())
            .unwrap();
        let state = sync_state_repo
            .get(&account.id, &SyncStateScopeKey::greader_account_all())
            .unwrap()
            .unwrap();

        assert_eq!(articles.len(), 1);
        assert_eq!(state.timestamp_usec, Some(1_700_000_100_000_000));
        assert_eq!(state.continuation, None);
        assert_eq!(state.etag, None);
        assert_eq!(state.last_modified, None);
        assert_eq!(state.last_success_at, saved_state.last_success_at);
        assert!(state
            .last_error
            .as_deref()
            .is_some_and(|message| message.contains("500")));
        assert_eq!(state.error_count, 2);
        assert_eq!(state.next_retry_at, None);
    }

    #[tokio::test]
    async fn sync_greader_account_turns_account_level_skips_into_warnings() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        server
            .mock("GET", "/api/greader.php/reader/api/0/tag/list")
            .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "tags": [] }"#)
            .create_async()
            .await;

        server
            .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
            .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "subscriptions": [
                        {
                            "id": "feed/https://example.com/feed-1.xml",
                            "title": "Feed One",
                            "url": "https://example.com/feed-1.xml",
                            "htmlUrl": "https://example.com/one",
                            "categories": []
                        }
                    ]
                }"#,
            )
            .create_async()
            .await;

        let account_stream_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "items": [
                        {
                            "id": "entry-without-origin",
                            "title": "Missing Origin",
                            "categories": []
                        }
                    ]
                }"#,
            )
            .create_async()
            .await;

        let per_feed_one_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/feed%2Fhttps%3A%2F%2Fexample.com%2Ffeed-1.xml",
            )
            .expect(0)
            .create_async()
            .await;

        server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "10000".into()),
                Matcher::UrlEncoded("s".into(), "user/-/state/com.google/read".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "itemRefs": [] }"#)
            .create_async()
            .await;
        server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "10000".into()),
                Matcher::UrlEncoded("s".into(), "user/-/state/com.google/starred".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "itemRefs": [] }"#)
            .create_async()
            .await;
        server
            .mock("GET", "/api/greader.php/reader/api/0/unread-count")
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("all".into(), "true".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "unreadcounts": [
                        { "id": "feed/https://example.com/feed-1.xml", "count": 0 }
                    ]
                }"#,
            )
            .create_async()
            .await;
        let local_failure_mock = server
            .mock("GET", "/local-broken.xml")
            .expect(0)
            .with_status(500)
            .with_body("server error")
            .create_async()
            .await;

        let local_broken_url = format!("{}/local-broken.xml", server.url());
        let db = test_db();
        let (account, feeds) = insert_account_and_feeds(
            &db,
            &server.url(),
            &[
                (
                    "feed/https://example.com/feed-1.xml",
                    "Feed One",
                    "https://example.com/feed-1.xml",
                    "https://example.com/one",
                ),
                (
                    "",
                    "Broken Local",
                    &local_broken_url,
                    "https://example.com/local",
                ),
            ],
        );
        let _credentials = configure_dev_credentials(&account.id).await;

        let provider = GReaderProvider::for_freshrss(&server.url());
        let outcome = sync_greader_account(&db, &account, provider).await.unwrap();

        account_stream_mock.assert_async().await;
        per_feed_one_mock.assert_async().await;
        local_failure_mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.reader());
        let articles = article_repo
            .find_by_feed(&feeds[0].id, &Pagination::default())
            .unwrap();

        assert!(articles.is_empty());
        assert_eq!(outcome.warnings.len(), 2);
        assert!(outcome.warnings.iter().any(|warning| warning
            .message
            .contains("skipped 1 entry item(s) during sync")));
        assert!(outcome.warnings.iter().any(|warning| warning
            .message
            .contains("Local feed 'Broken Local' failed during provider sync")));
    }

    #[tokio::test]
    async fn sync_greader_account_skips_pull_state_when_recent_remote_state_sync_exists() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        server
            .mock("GET", "/api/greader.php/reader/api/0/tag/list")
            .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "tags": [] }"#)
            .create_async()
            .await;

        server
            .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
            .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "subscriptions": [
                        {
                            "id": "feed/https://example.com/feed-1.xml",
                            "title": "Feed One",
                            "url": "https://example.com/feed-1.xml",
                            "htmlUrl": "https://example.com/one",
                            "categories": []
                        }
                    ]
                }"#,
            )
            .create_async()
            .await;

        server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "items": [] }"#)
            .create_async()
            .await;

        let pull_state_read_mock = server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "10000".into()),
                Matcher::UrlEncoded("s".into(), "user/-/state/com.google/read".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .expect(0)
            .create_async()
            .await;
        let pull_state_starred_mock = server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "10000".into()),
                Matcher::UrlEncoded("s".into(), "user/-/state/com.google/starred".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .expect(0)
            .create_async()
            .await;

        server
            .mock("GET", "/api/greader.php/reader/api/0/unread-count")
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("all".into(), "true".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "unreadcounts": [] }"#)
            .create_async()
            .await;

        let db = test_db();
        let (account, _feeds) = insert_account_and_feeds(
            &db,
            &server.url(),
            &[(
                "feed/https://example.com/feed-1.xml",
                "Feed One",
                "https://example.com/feed-1.xml",
                "https://example.com/one",
            )],
        );
        {
            let db_guard = db.lock().unwrap();
            let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
            sync_state_repo
                .save(&SyncState {
                    account_id: account.id.clone(),
                    scope_key: SyncStateScopeKey::greader_remote_state_full().as_string(),
                    timestamp_usec: Some(chrono::Utc::now().timestamp_micros()),
                    continuation: None,
                    etag: None,
                    last_modified: None,
                    last_success_at: Some(chrono::Utc::now().to_rfc3339()),
                    last_error: None,
                    error_count: 0,
                    next_retry_at: None,
                })
                .unwrap();
        }
        let _credentials = configure_dev_credentials(&account.id).await;

        let provider = GReaderProvider::for_freshrss(&server.url());
        sync_greader_account(&db, &account, provider).await.unwrap();

        pull_state_read_mock.assert_async().await;
        pull_state_starred_mock.assert_async().await;
    }

    #[tokio::test]
    async fn sync_greader_feed_entries_uses_saved_timestamp_for_incremental_sync() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let stream_mock = server
            .mock(
                "GET",
                Matcher::Regex(r"/api/greader.php/reader/api/0/stream/contents/.*".to_string()),
            )
            .match_query(Matcher::Regex(
                "^output=json&n=200&ot=1700000000000000$".to_string(),
            ))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "items": [] }"#)
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_account_and_feed(&db, &server.url());
        let saved_state = SyncState {
            account_id: account.id.clone(),
            scope_key: feed_scope_key(FEED_REMOTE_ID).as_string(),
            timestamp_usec: Some(1_700_000_000_000_000),
            continuation: Some("stale-continuation".to_string()),
            etag: Some("etag-old".to_string()),
            last_modified: Some("Wed, 01 Jan 2025 00:00:00 GMT".to_string()),
            last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
            last_error: Some("previous failure".to_string()),
            error_count: 2,
            next_retry_at: Some("2025-01-01T01:00:00Z".to_string()),
        };
        {
            let db_guard = db.lock().unwrap();
            let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
            sync_state_repo.save(&saved_state).unwrap();
        }

        let provider = authenticated_provider(&server.url()).await;
        sync_greader_feed_entries(&db, &provider, &account, &feed)
            .await
            .unwrap();

        stream_mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
        let state = sync_state_repo
            .get(&account.id, &feed_scope_key(FEED_REMOTE_ID))
            .unwrap()
            .unwrap();

        assert_eq!(state.timestamp_usec, Some(1_700_000_000_000_000));
        assert_eq!(state.continuation, None);
        assert_eq!(state.etag, None);
        assert_eq!(state.last_modified, None);
        assert_eq!(state.last_error, None);
        assert_eq!(state.error_count, 0);
        assert_eq!(state.next_retry_at, None);
        assert!(state.last_success_at.is_some());
    }

    #[tokio::test]
    async fn sync_greader_feed_entries_advances_timestamp_from_entries_without_next_cursor() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let stream_mock = server
            .mock(
                "GET",
                Matcher::Regex(r"/api/greader.php/reader/api/0/stream/contents/.*".to_string()),
            )
            .match_query(Matcher::Regex("^output=json&n=200$".to_string()))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "items": [
                        {
                            "id": "entry-without-provider-cursor",
                            "title": "No Cursor",
                            "alternate": [{"href": "https://example.com/no-cursor"}],
                            "published": 1700000100,
                            "origin": {
                                "streamId": "feed/https://example.com/rss",
                                "title": "Example"
                            },
                            "categories": []
                        }
                    ]
                }"#,
            )
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_account_and_feed(&db, &server.url());
        let provider = authenticated_provider(&server.url()).await;

        sync_greader_feed_entries(&db, &provider, &account, &feed)
            .await
            .unwrap();

        stream_mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
        let state = sync_state_repo
            .get(&account.id, &feed_scope_key(FEED_REMOTE_ID))
            .unwrap()
            .unwrap();

        assert_eq!(state.timestamp_usec, Some(1_700_000_100_000_000));
    }

    #[tokio::test]
    async fn sync_greader_feed_entries_advances_timestamp_after_all_pages_finish() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let page1_mock = server
            .mock(
                "GET",
                Matcher::Regex(r"/api/greader.php/reader/api/0/stream/contents/.*".to_string()),
            )
            .match_query(Matcher::Regex(
                "^output=json&n=200&ot=1700000000000000$".to_string(),
            ))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "items": [
                        {
                            "id": "entry-1",
                            "title": "Page 1",
                            "alternate": [{"href": "https://example.com/1"}],
                            "summary": {"content": "Summary 1"},
                            "timestampUsec": "1700000100000000",
                            "published": 1700000100,
                            "origin": {
                                "streamId": "feed/https://example.com/rss",
                                "title": "Example"
                            },
                            "categories": []
                        }
                    ],
                    "continuation": "page-2"
                }"#,
            )
            .create_async()
            .await;

        let page2_mock = server
            .mock(
                "GET",
                Matcher::Regex(r"/api/greader.php/reader/api/0/stream/contents/.*".to_string()),
            )
            .match_query(Matcher::Regex(
                "^output=json&n=200&c=page-2&ot=1700000100000000$".to_string(),
            ))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "items": [
                        {
                            "id": "entry-2",
                            "title": "Page 2",
                            "alternate": [{"href": "https://example.com/2"}],
                            "summary": {"content": "Summary 2"},
                            "updated": 1700000200,
                            "published": 1700000190,
                            "origin": {
                                "streamId": "feed/https://example.com/rss",
                                "title": "Example"
                            },
                            "categories": ["user/-/state/com.google/read"]
                        }
                    ]
                }"#,
            )
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_account_and_feed(&db, &server.url());
        {
            let db_guard = db.lock().unwrap();
            let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
            sync_state_repo
                .save(&SyncState {
                    account_id: account.id.clone(),
                    scope_key: feed_scope_key(FEED_REMOTE_ID).as_string(),
                    timestamp_usec: Some(1_700_000_000_000_000),
                    continuation: None,
                    etag: None,
                    last_modified: None,
                    last_success_at: None,
                    last_error: None,
                    error_count: 0,
                    next_retry_at: None,
                })
                .unwrap();
        }

        let provider = authenticated_provider(&server.url()).await;
        sync_greader_feed_entries(&db, &provider, &account, &feed)
            .await
            .unwrap();

        page1_mock.assert_async().await;
        page2_mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.reader());
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
        let articles = article_repo
            .find_by_feed(&feed.id, &Pagination::default())
            .unwrap();
        let state = sync_state_repo
            .get(&account.id, &feed_scope_key(FEED_REMOTE_ID))
            .unwrap()
            .unwrap();

        assert_eq!(articles.len(), 2);
        assert_eq!(state.timestamp_usec, Some(1_700_000_200_000_000));
        assert_eq!(state.continuation, None);
    }

    #[tokio::test]
    async fn sync_greader_feed_entries_records_failure_state_when_later_page_fails() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let page1_mock = server
            .mock(
                "GET",
                Matcher::Regex(r"/api/greader.php/reader/api/0/stream/contents/.*".to_string()),
            )
            .match_query(Matcher::Regex(
                "^output=json&n=200&ot=1700000000000000$".to_string(),
            ))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "items": [
                        {
                            "id": "entry-1",
                            "title": "Page 1",
                            "alternate": [{"href": "https://example.com/1"}],
                            "summary": {"content": "Summary 1"},
                            "timestampUsec": "1700000100000000",
                            "published": 1700000100,
                            "origin": {
                                "streamId": "feed/https://example.com/rss",
                                "title": "Example"
                            },
                            "categories": []
                        }
                    ],
                    "continuation": "page-2"
                }"#,
            )
            .create_async()
            .await;

        let page2_mock = server
            .mock(
                "GET",
                Matcher::Regex(r"/api/greader.php/reader/api/0/stream/contents/.*".to_string()),
            )
            .match_query(Matcher::Regex(
                "^output=json&n=200&c=page-2&ot=1700000100000000$".to_string(),
            ))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(500)
            .with_body("boom")
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_account_and_feed(&db, &server.url());
        let saved_state = SyncState {
            account_id: account.id.clone(),
            scope_key: feed_scope_key(FEED_REMOTE_ID).as_string(),
            timestamp_usec: Some(1_700_000_000_000_000),
            continuation: None,
            etag: Some("etag-old".to_string()),
            last_modified: Some("Wed, 01 Jan 2025 00:00:00 GMT".to_string()),
            last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
            last_error: Some("old error".to_string()),
            error_count: 1,
            next_retry_at: Some("2025-01-01T01:00:00Z".to_string()),
        };
        {
            let db_guard = db.lock().unwrap();
            let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
            sync_state_repo.save(&saved_state).unwrap();
        }

        let provider = authenticated_provider(&server.url()).await;
        let error = sync_greader_feed_entries(&db, &provider, &account, &feed)
            .await
            .unwrap_err();

        page1_mock.assert_async().await;
        page2_mock.assert_async().await;
        assert!(error.to_string().contains("500"));

        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
        let state = sync_state_repo
            .get(&account.id, &feed_scope_key(FEED_REMOTE_ID))
            .unwrap()
            .unwrap();

        assert_eq!(state.timestamp_usec, Some(1_700_000_100_000_000));
        assert_eq!(state.continuation, None);
        assert_eq!(state.etag, None);
        assert_eq!(state.last_modified, None);
        assert_eq!(state.last_success_at, saved_state.last_success_at);
        assert!(state
            .last_error
            .as_deref()
            .is_some_and(|message| message.contains("500")));
        assert_eq!(state.error_count, 2);
        assert_eq!(state.next_retry_at, None);
    }

    #[tokio::test]
    async fn repair_greader_remote_state_applies_read_flags_and_recalculates_counts() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "10000".into()),
                Matcher::UrlEncoded("s".into(), "user/-/state/com.google/read".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "itemRefs": [{ "id": "1" }] }"#)
            .create_async()
            .await;

        server
            .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "10000".into()),
                Matcher::UrlEncoded("s".into(), "user/-/state/com.google/starred".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "itemRefs": [] }"#)
            .create_async()
            .await;

        server
            .mock("GET", "/api/greader.php/reader/api/0/unread-count")
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("all".into(), "true".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(format!(
                r#"{{ "unreadcounts": [{{ "id": "{FEED_REMOTE_ID}", "count": 0 }}] }}"#
            ))
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_account_and_feed(&db, &server.url());
        {
            let db_guard = db.lock().unwrap();
            let article_repo = SqliteArticleRepository::new(db_guard.writer());
            let feed_repo = SqliteFeedRepository::new(db_guard.writer());
            let article = Article {
                id: generate_entry_id(
                    account.id.as_ref(),
                    Some("tag:google.com,2005:reader/item/0000000000000001"),
                    &feed.url,
                    Some("https://example.com/1"),
                    Some("Example Article"),
                ),
                feed_id: feed.id.clone(),
                remote_id: Some("tag:google.com,2005:reader/item/0000000000000001".to_string()),
                title: "Example Article".to_string(),
                content_raw: "body".to_string(),
                content_sanitized: "body".to_string(),
                sanitizer_version: sanitizer::SANITIZER_VERSION,
                summary: None,
                url: Some("https://example.com/1".to_string()),
                author: None,
                published_at: chrono::Utc::now(),
                thumbnail: None,
                is_read: false,
                is_starred: false,
                fetched_at: chrono::Utc::now(),
            };
            article_repo.upsert(&[article]).unwrap();
            feed_repo.update_unread_count(&feed.id, 1).unwrap();
        }

        let _credentials = configure_dev_credentials(&account.id).await;

        let provider = GReaderProvider::for_freshrss(&server.url());
        repair_greader_remote_state(&db, &account, provider)
            .await
            .unwrap();

        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.reader());
        let feed_repo = SqliteFeedRepository::new(db_guard.reader());
        let articles = article_repo
            .find_by_feed(&feed.id, &Pagination::default())
            .unwrap();
        let repaired_feed = feed_repo.find_by_id(&feed.id).unwrap().unwrap();

        assert_eq!(articles.len(), 1);
        assert!(articles[0].is_read);
        assert_eq!(repaired_feed.unread_count, 0);
    }

    #[tokio::test]
    async fn sync_local_feed_initial_fetch_saves_articles_and_validators() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .match_header("if-none-match", Matcher::Missing)
            .match_header("if-modified-since", Matcher::Missing)
            .with_status(200)
            .with_header("content-type", "application/rss+xml")
            .with_header("etag", LOCAL_ETAG_NEW)
            .with_header("last-modified", LOCAL_LAST_MODIFIED_NEW)
            .with_body(LOCAL_RSS_INITIAL)
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();

        sync_local_feed(&db, &provider, &account.id, &feed)
            .await
            .unwrap();

        mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.reader());
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
        let articles = article_repo
            .find_by_feed(&feed.id, &Pagination::default())
            .unwrap();
        let state = sync_state_repo
            .get(&account.id, &local_feed_scope_key(&feed.url))
            .unwrap()
            .unwrap();

        assert_eq!(articles.len(), 1);
        assert_eq!(articles[0].title, "Local Article");
        assert_eq!(state.etag.as_deref(), Some(LOCAL_ETAG_NEW));
        assert_eq!(
            state.last_modified.as_deref(),
            Some(LOCAL_LAST_MODIFIED_NEW)
        );
        assert_eq!(state.continuation, None);
        assert_eq!(state.timestamp_usec, None);
        assert_eq!(state.error_count, 0);
        assert!(state.last_success_at.is_some());
    }

    #[tokio::test]
    async fn sync_local_feed_saves_validators_under_requested_and_redirect_final_scope_keys() {
        let mut server = mockito::Server::new_async().await;
        let requested_feed_url = format!("{}/old-feed.xml?z=last&a=first", server.url());
        let redirect = server
            .mock("GET", "/old-feed.xml")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("z".into(), "last".into()),
                mockito::Matcher::UrlEncoded("a".into(), "first".into()),
            ]))
            .with_status(308)
            .with_header("location", "/feed.xml?b=2&a=1")
            .create_async()
            .await;
        let final_feed = server
            .mock("GET", "/feed.xml")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("b".into(), "2".into()),
                mockito::Matcher::UrlEncoded("a".into(), "1".into()),
            ]))
            .with_status(200)
            .with_header("content-type", "application/rss+xml")
            .with_header("etag", LOCAL_ETAG_NEW)
            .with_header("last-modified", LOCAL_LAST_MODIFIED_NEW)
            .with_body(LOCAL_RSS_INITIAL)
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_local_account_and_feed(&db, &requested_feed_url);
        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();

        sync_local_feed(&db, &provider, &account.id, &feed)
            .await
            .unwrap();

        redirect.assert_async().await;
        final_feed.assert_async().await;

        let db_guard = db.lock().unwrap();
        let feed_repo = SqliteFeedRepository::new(db_guard.reader());
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
        let saved_feed = feed_repo.find_by_id(&feed.id).unwrap().unwrap();
        let requested_state = sync_state_repo
            .get(&account.id, local_feed_scope_key(&requested_feed_url))
            .unwrap()
            .unwrap();
        let final_state = sync_state_repo
            .get(
                &account.id,
                local_feed_scope_key(&format!("{}/feed.xml?a=1&b=2", server.url())),
            )
            .unwrap()
            .unwrap();

        assert_eq!(requested_state.etag.as_deref(), Some(LOCAL_ETAG_NEW));
        assert_eq!(final_state.etag.as_deref(), Some(LOCAL_ETAG_NEW));
        assert_eq!(
            requested_state.last_modified.as_deref(),
            Some(LOCAL_LAST_MODIFIED_NEW)
        );
        assert_eq!(
            final_state.last_modified.as_deref(),
            Some(LOCAL_LAST_MODIFIED_NEW)
        );
        assert_eq!(saved_feed.url, requested_feed_url);
    }

    #[tokio::test]
    async fn sync_local_feed_keeps_http_validators_in_sync_state_not_feed_http_cache() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .with_status(200)
            .with_header("content-type", "application/rss+xml")
            .with_header("etag", LOCAL_ETAG_NEW)
            .with_header("last-modified", LOCAL_LAST_MODIFIED_NEW)
            .with_body(LOCAL_RSS_INITIAL)
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();

        sync_local_feed(&db, &provider, &account.id, &feed)
            .await
            .unwrap();

        mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
        let state = sync_state_repo
            .get(&account.id, &local_feed_scope_key(&feed.url))
            .unwrap()
            .unwrap();
        let feed_http_cache_count: i64 = db_guard
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM feed_http_cache WHERE feed_id = ?1",
                rusqlite::params![feed.id.as_ref()],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(state.etag.as_deref(), Some(LOCAL_ETAG_NEW));
        assert_eq!(
            state.last_modified.as_deref(),
            Some(LOCAL_LAST_MODIFIED_NEW)
        );
        assert_eq!(feed_http_cache_count, 0);
    }

    #[tokio::test]
    async fn sync_local_feed_returns_post_write_integrity_error() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .with_status(200)
            .with_header("content-type", "application/rss+xml")
            .with_body(LOCAL_RSS_INITIAL)
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
        {
            let db_guard = db.lock().unwrap();
            db_guard
                .writer()
                .execute("DROP TABLE preferences", [])
                .unwrap();
        }

        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
        let error = sync_local_feed(&db, &provider, &account.id, &feed)
            .await
            .expect_err("post-write integrity failures should be returned");

        mock.assert_async().await;
        let db_guard = db.lock().unwrap();
        let article_count: i64 = db_guard
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM articles WHERE feed_id = ?1",
                rusqlite::params![feed.id.as_ref()],
                |row| row.get(0),
            )
            .unwrap();
        let sync_state_count: i64 = db_guard
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM sync_state WHERE account_id = ?1 AND scope_key = ?2",
                rusqlite::params![
                    account.id.as_ref(),
                    local_feed_scope_key(&feed.url).as_string()
                ],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(article_count, 0);
        assert_eq!(sync_state_count, 0);
        match error {
            AppError::UserVisible { message } => {
                assert!(message.contains("no such table: preferences"));
            }
            AppError::Retryable { message } | AppError::RetryableWithMetadata { message, .. } => {
                panic!("post-write DB failures should not be retryable: {message}");
            }
        }
    }

    #[tokio::test]
    async fn sync_local_feed_rolls_back_articles_when_sync_state_save_fails() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .with_status(200)
            .with_header("content-type", "application/rss+xml")
            .with_header("etag", LOCAL_ETAG_NEW)
            .with_body(LOCAL_RSS_INITIAL)
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
        {
            let db_guard = db.lock().unwrap();
            db_guard
                .writer()
                .execute_batch(
                    "CREATE TEMP TRIGGER fail_local_feed_sync_state_save
                     BEFORE INSERT ON sync_state
                     WHEN NEW.scope_key LIKE 'local_feed:%'
                     BEGIN
                       SELECT RAISE(ABORT, 'forced sync_state failure');
                     END;",
                )
                .unwrap();
        }

        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
        let error = sync_local_feed(&db, &provider, &account.id, &feed)
            .await
            .expect_err("sync_state failure should roll back article writes");

        mock.assert_async().await;
        let db_guard = db.lock().unwrap();
        let article_count: i64 = db_guard
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM articles WHERE feed_id = ?1",
                rusqlite::params![feed.id.as_ref()],
                |row| row.get(0),
            )
            .unwrap();
        let sync_state_count: i64 = db_guard
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM sync_state WHERE account_id = ?1 AND scope_key = ?2",
                rusqlite::params![
                    account.id.as_ref(),
                    local_feed_scope_key(&feed.url).as_string()
                ],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(article_count, 0);
        assert_eq!(sync_state_count, 0);
        match error {
            AppError::UserVisible { message } => {
                assert!(message.contains("forced sync_state failure"));
            }
            AppError::Retryable { message } | AppError::RetryableWithMetadata { message, .. } => {
                panic!("sync_state DB failures should not be retryable: {message}");
            }
        }
    }

    #[tokio::test]
    async fn sync_local_feed_updates_validators_and_article_on_200_response() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .match_header("if-none-match", LOCAL_ETAG_OLD)
            .match_header("if-modified-since", LOCAL_LAST_MODIFIED_OLD)
            .with_status(200)
            .with_header("content-type", "application/rss+xml")
            .with_header("etag", LOCAL_ETAG_NEW)
            .with_header("last-modified", LOCAL_LAST_MODIFIED_NEW)
            .with_body(LOCAL_RSS_UPDATED)
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
        let existing_article = Article {
            id: generate_entry_id(
                account.id.as_ref(),
                Some("local-guid-1"),
                &feed.url,
                Some("https://example.com/1"),
                Some("Local Article"),
            ),
            feed_id: feed.id.clone(),
            remote_id: Some("local-guid-1".to_string()),
            title: "Local Article".to_string(),
            content_raw: "old".to_string(),
            content_sanitized: "old".to_string(),
            sanitizer_version: sanitizer::SANITIZER_VERSION,
            summary: None,
            url: Some("https://example.com/1".to_string()),
            author: None,
            published_at: chrono::Utc::now(),
            thumbnail: None,
            is_read: false,
            is_starred: false,
            fetched_at: chrono::Utc::now(),
        };
        {
            let db_guard = db.lock().unwrap();
            let article_repo = SqliteArticleRepository::new(db_guard.writer());
            let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
            article_repo.upsert(&[existing_article]).unwrap();
            sync_state_repo
                .save(&SyncState {
                    account_id: account.id.clone(),
                    scope_key: local_feed_scope_key(&feed.url).as_string(),
                    timestamp_usec: None,
                    continuation: None,
                    etag: Some(LOCAL_ETAG_OLD.to_string()),
                    last_modified: Some(LOCAL_LAST_MODIFIED_OLD.to_string()),
                    last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
                    last_error: Some("old error".to_string()),
                    error_count: 2,
                    next_retry_at: Some("2025-01-01T01:00:00Z".to_string()),
                })
                .unwrap();
        }

        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
        sync_local_feed(&db, &provider, &account.id, &feed)
            .await
            .unwrap();

        mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.reader());
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
        let articles = article_repo
            .find_by_feed(&feed.id, &Pagination::default())
            .unwrap();
        let state = sync_state_repo
            .get(&account.id, &local_feed_scope_key(&feed.url))
            .unwrap()
            .unwrap();

        assert_eq!(articles.len(), 1);
        assert_eq!(articles[0].title, "Local Article Updated");
        assert_eq!(state.etag.as_deref(), Some(LOCAL_ETAG_NEW));
        assert_eq!(
            state.last_modified.as_deref(),
            Some(LOCAL_LAST_MODIFIED_NEW)
        );
        assert_eq!(state.error_count, 0);
        assert_eq!(state.last_error, None);
        assert_eq!(state.next_retry_at, None);
        assert!(state.last_success_at.is_some());
    }

    #[tokio::test]
    async fn sync_local_feed_preserves_weak_etag_and_drops_invalid_last_modified() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .with_status(200)
            .with_header("content-type", "application/rss+xml")
            .with_header("etag", "W/\"weak-etag\"")
            .with_header("last-modified", "not-a-date")
            .with_body(LOCAL_RSS_INITIAL)
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();

        sync_local_feed(&db, &provider, &account.id, &feed)
            .await
            .unwrap();

        mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
        let state = sync_state_repo
            .get(&account.id, &local_feed_scope_key(&feed.url))
            .unwrap()
            .unwrap();

        assert_eq!(state.etag.as_deref(), Some("W/\"weak-etag\""));
        assert_eq!(state.last_modified, None);
    }

    #[tokio::test]
    async fn sync_local_feed_drops_invalid_saved_validators_before_request() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .with_status(200)
            .with_header("content-type", "application/rss+xml")
            .with_header("etag", LOCAL_ETAG_NEW)
            .with_header("last-modified", LOCAL_LAST_MODIFIED_NEW)
            .with_body(LOCAL_RSS_INITIAL)
            .expect(1)
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
        {
            let db_guard = db.lock().unwrap();
            let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
            sync_state_repo
                .save(&SyncState {
                    account_id: account.id.clone(),
                    scope_key: local_feed_scope_key(&feed.url).as_string(),
                    timestamp_usec: None,
                    continuation: None,
                    etag: Some("unquoted-etag".to_string()),
                    last_modified: Some("invalid-date".to_string()),
                    last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
                    last_error: None,
                    error_count: 0,
                    next_retry_at: None,
                })
                .unwrap();
        }

        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
        sync_local_feed(&db, &provider, &account.id, &feed)
            .await
            .unwrap();

        mock.assert_async().await;
    }

    #[tokio::test]
    async fn sync_local_feed_skips_upsert_when_server_returns_not_modified() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .match_header("if-none-match", LOCAL_ETAG_OLD)
            .match_header("if-modified-since", LOCAL_LAST_MODIFIED_OLD)
            .with_status(304)
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
        let existing_fetched_at = chrono::Utc::now() - chrono::Duration::days(1);
        let existing_article = Article {
            id: generate_entry_id(
                account.id.as_ref(),
                Some("local-guid-1"),
                &feed.url,
                Some("https://example.com/1"),
                Some("Local Article"),
            ),
            feed_id: feed.id.clone(),
            remote_id: Some("local-guid-1".to_string()),
            title: "Local Article".to_string(),
            content_raw: "old".to_string(),
            content_sanitized: "old".to_string(),
            sanitizer_version: sanitizer::SANITIZER_VERSION,
            summary: None,
            url: Some("https://example.com/1".to_string()),
            author: None,
            published_at: chrono::Utc::now() - chrono::Duration::days(2),
            thumbnail: None,
            is_read: false,
            is_starred: false,
            fetched_at: existing_fetched_at,
        };
        {
            let db_guard = db.lock().unwrap();
            let article_repo = SqliteArticleRepository::new(db_guard.writer());
            let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
            article_repo.upsert(&[existing_article]).unwrap();
            sync_state_repo
                .save(&SyncState {
                    account_id: account.id.clone(),
                    scope_key: local_feed_scope_key(&feed.url).as_string(),
                    timestamp_usec: None,
                    continuation: None,
                    etag: Some(LOCAL_ETAG_OLD.to_string()),
                    last_modified: Some(LOCAL_LAST_MODIFIED_OLD.to_string()),
                    last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
                    last_error: Some("old error".to_string()),
                    error_count: 3,
                    next_retry_at: Some("2025-01-01T01:00:00Z".to_string()),
                })
                .unwrap();
        }

        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
        sync_local_feed(&db, &provider, &account.id, &feed)
            .await
            .unwrap();

        mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.reader());
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
        let articles = article_repo
            .find_by_feed(&feed.id, &Pagination::default())
            .unwrap();
        let state = sync_state_repo
            .get(&account.id, &local_feed_scope_key(&feed.url))
            .unwrap()
            .unwrap();

        assert_eq!(articles.len(), 1);
        assert_eq!(articles[0].title, "Local Article");
        assert_eq!(articles[0].fetched_at, existing_fetched_at);
        assert_eq!(state.etag.as_deref(), Some(LOCAL_ETAG_OLD));
        assert_eq!(
            state.last_modified.as_deref(),
            Some(LOCAL_LAST_MODIFIED_OLD)
        );
        assert_eq!(state.error_count, 0);
        assert_eq!(state.last_error, None);
        assert_eq!(state.next_retry_at, None);
        assert!(state.last_success_at.is_some());
    }

    #[tokio::test]
    async fn sync_local_feed_repairs_mute_and_unread_count_on_not_modified() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .match_header("if-none-match", LOCAL_ETAG_OLD)
            .match_header("if-modified-since", LOCAL_LAST_MODIFIED_OLD)
            .with_status(304)
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
        let mut existing_article = Article {
            id: ArticleId("local-muted-article".to_string()),
            feed_id: feed.id.clone(),
            remote_id: Some("local-guid-muted".to_string()),
            title: "Kindle Unlimited local".to_string(),
            content_raw: "old".to_string(),
            content_sanitized: "old".to_string(),
            sanitizer_version: sanitizer::SANITIZER_VERSION,
            summary: None,
            url: Some("https://example.com/muted".to_string()),
            author: None,
            published_at: chrono::Utc::now(),
            thumbnail: None,
            is_read: false,
            is_starred: false,
            fetched_at: chrono::Utc::now(),
        };
        existing_article.id = generate_entry_id(
            account.id.as_ref(),
            existing_article.remote_id.as_deref(),
            &feed.url,
            existing_article.url.as_deref(),
            Some(&existing_article.title),
        );
        {
            let db_guard = db.lock().unwrap();
            let article_repo = SqliteArticleRepository::new(db_guard.writer());
            let feed_repo = SqliteFeedRepository::new(db_guard.writer());
            let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
            article_repo.upsert(&[existing_article.clone()]).unwrap();
            feed_repo.update_unread_count(&feed.id, 99).unwrap();
            db_guard
                .writer()
                .execute(
                    "INSERT INTO preferences (key, value) VALUES ('mute_auto_mark_read', 'true')",
                    [],
                )
                .unwrap();
            db_guard
                .writer()
                .execute(
                    "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?4)",
                    rusqlite::params![
                        uuid::Uuid::new_v4().to_string(),
                        "kindle unlimited",
                        "title",
                        chrono::Utc::now().to_rfc3339()
                    ],
                )
                .unwrap();
            sync_state_repo
                .save(&SyncState {
                    account_id: account.id.clone(),
                    scope_key: local_feed_scope_key(&feed.url).as_string(),
                    timestamp_usec: None,
                    continuation: None,
                    etag: Some(LOCAL_ETAG_OLD.to_string()),
                    last_modified: Some(LOCAL_LAST_MODIFIED_OLD.to_string()),
                    last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
                    last_error: None,
                    error_count: 0,
                    next_retry_at: None,
                })
                .unwrap();
        }

        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
        sync_local_feed(&db, &provider, &account.id, &feed)
            .await
            .unwrap();

        mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let article_is_read: bool = db_guard
            .reader()
            .query_row(
                "SELECT is_read FROM articles WHERE id = ?1",
                rusqlite::params![existing_article.id.as_ref()],
                |row| row.get(0),
            )
            .unwrap();
        let unread_count: i64 = db_guard
            .reader()
            .query_row(
                "SELECT unread_count FROM feeds WHERE id = ?1",
                rusqlite::params![feed.id.as_ref()],
                |row| row.get(0),
            )
            .unwrap();

        assert!(article_is_read);
        assert_eq!(unread_count, 0);
    }

    #[tokio::test]
    async fn sync_local_feed_clears_validators_when_server_does_not_support_them() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .match_header("if-none-match", LOCAL_ETAG_OLD)
            .match_header("if-modified-since", LOCAL_LAST_MODIFIED_OLD)
            .with_status(200)
            .with_header("content-type", "application/rss+xml")
            .with_body(LOCAL_RSS_UPDATED)
            .create_async()
            .await;

        let db = test_db();
        let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
        {
            let db_guard = db.lock().unwrap();
            let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
            sync_state_repo
                .save(&SyncState {
                    account_id: account.id.clone(),
                    scope_key: local_feed_scope_key(&feed.url).as_string(),
                    timestamp_usec: None,
                    continuation: None,
                    etag: Some(LOCAL_ETAG_OLD.to_string()),
                    last_modified: Some(LOCAL_LAST_MODIFIED_OLD.to_string()),
                    last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
                    last_error: None,
                    error_count: 0,
                    next_retry_at: None,
                })
                .unwrap();
        }

        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
        sync_local_feed(&db, &provider, &account.id, &feed)
            .await
            .unwrap();

        mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.reader());
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
        let articles = article_repo
            .find_by_feed(&feed.id, &Pagination::default())
            .unwrap();
        let state = sync_state_repo
            .get(&account.id, &local_feed_scope_key(&feed.url))
            .unwrap()
            .unwrap();

        assert_eq!(articles.len(), 1);
        assert_eq!(articles[0].title, "Local Article Updated");
        assert_eq!(state.etag, None);
        assert_eq!(state.last_modified, None);
        assert_eq!(state.error_count, 0);
        assert!(state.last_success_at.is_some());
    }

    #[test]
    fn greader_feed_routing_distinguishes_provider_managed_and_local_like_ids() {
        assert!(is_provider_managed_greader_feed(Some("feed/1")));
        assert!(is_provider_managed_greader_feed(Some(
            "feed/http://example.com/rss"
        )));

        assert!(!is_provider_managed_greader_feed(Some(
            "https://example.com/feed.xml"
        )));
        assert!(!is_provider_managed_greader_feed(Some(
            "tag:google.com,2005:reader/item/123"
        )));
        assert!(!is_provider_managed_greader_feed(None));
    }
}
