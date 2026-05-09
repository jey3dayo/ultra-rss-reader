use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::Instant;

use tracing::{info, warn};

use crate::commands::dto::{AccountSyncWarningKind, AppError};
use crate::domain::account::Account;
use crate::domain::article::{generate_entry_id, Article};
use crate::domain::feed::Feed;
use crate::domain::provider::{FeedIdentifier, Mutation, PullScope, SyncCursor};
use crate::domain::types::{AccountId, FeedId, FolderId};
use crate::infra::db::connection::DbManager;
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
use crate::repository::sync_state::{SyncState, SyncStateRepository, SyncStateScopeKey};

use super::feed_commands::lock_db;

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

    Ok(
        now.signed_duration_since(last_success_at.with_timezone(&chrono::Utc))
            >= chrono::Duration::minutes(GREADER_REMOTE_STATE_PULL_COOLDOWN_MINUTES),
    )
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
                etag: state.etag.clone(),
                last_modified: state.last_modified.clone(),
            }),
        )
        .await?;

    if !result.not_modified {
        let articles: Vec<Article> = result
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
            .collect();

        if !articles.is_empty() {
            let db_guard = lock_db(db)?;
            let article_repo = SqliteArticleRepository::new(db_guard.writer());
            let feed_repo_w = SqliteFeedRepository::new(db_guard.writer());
            article_repo.upsert(&articles)?;
            let candidate_ids = articles
                .iter()
                .map(|article| article.id.clone())
                .collect::<Vec<_>>();
            article_repo.mark_muted_unread_as_read(account_id, Some(&candidate_ids))?;
            feed_repo_w.recalculate_unread_count(&feed.id)?;
        }
    }

    let next_state = SyncState {
        account_id: account_id.clone(),
        scope_key: scope_key.as_string(),
        timestamp_usec: None,
        continuation: None,
        etag: result
            .next_cursor
            .as_ref()
            .and_then(|cursor| cursor.etag.clone()),
        last_modified: result
            .next_cursor
            .as_ref()
            .and_then(|cursor| cursor.last_modified.clone()),
        last_success_at: Some(chrono::Utc::now().to_rfc3339()),
        last_error: None,
        error_count: 0,
        next_retry_at: None,
    };
    let db_guard = lock_db(db)?;
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
    sync_state_repo.save(&next_state)?;

    Ok(())
}

/// Sync a GReader-compatible account: authenticate, sync folders, subscriptions, entries, state, unread counts.
pub(super) async fn sync_greader_account(
    db: &Mutex<DbManager>,
    account: &Account,
    mut provider: GReaderProvider,
) -> Result<ProviderSyncOutcome, AppError> {
    use crate::domain::folder::Folder;

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
        for rf in &remote_folders {
            let existing_id = folder_repo
                .find_by_remote_id(&account.id, &rf.remote_id)?
                .map(|f| f.id);
            let folder = Folder {
                id: existing_id.unwrap_or_else(FolderId::new),
                account_id: account.id.clone(),
                remote_id: Some(rf.remote_id.clone()),
                name: rf.name.clone(),
                sort_order: rf.sort_order.unwrap_or(0),
            };
            folder_repo.save(&folder)?;
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

fn pending_mutation_targets_provider_managed_greader_feed(
    db: &Mutex<DbManager>,
    pending_mutation_id: i64,
) -> Result<bool, AppError> {
    let db_guard = lock_db(db)?;
    match db_guard.reader().query_row(
        "SELECT f.remote_id
             FROM pending_mutations pm
             JOIN articles a ON a.remote_id = pm.remote_entry_id
             JOIN feeds f ON f.id = a.feed_id
             WHERE pm.id = ?1 AND f.account_id = pm.account_id
             LIMIT 1",
        rusqlite::params![pending_mutation_id],
        |row| row.get::<_, Option<String>>(0),
    ) {
        Ok(feed_remote_id) => Ok(is_provider_managed_greader_feed(feed_remote_id.as_deref())),
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
    let mut latest_timestamp_usec = saved_state.as_ref().and_then(|state| state.timestamp_usec);
    let mut skipped_entries = 0usize;
    let mut entries_upserted = 0usize;
    let mut delta_pages = 0usize;
    let mut seen_feed_ids = HashSet::new();

    loop {
        let result = provider
            .pull_entries(PullScope::All, cursor.clone())
            .await?;
        delta_pages += 1;
        skipped_entries += result.skipped_entries;
        update_latest_timestamp_usec(&mut latest_timestamp_usec, result.next_cursor.as_ref());

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
    {
        let db_guard = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        for rs in &remote_subs {
            let existing = feed_repo.find_by_remote_id(&account.id, &rs.remote_id)?;
            let feed = Feed {
                id: existing
                    .as_ref()
                    .map(|f| f.id.clone())
                    .unwrap_or_else(FeedId::new),
                account_id: account.id.clone(),
                folder_id: resolve_greader_subscription_folder_id(
                    rs.folder_remote_id.as_deref(),
                    &folder_remote_id_map,
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
    }
    info!(
        account_id = %account.id.as_ref(),
        account_name = %account.name,
        phase = "subscriptions",
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
    let remote_subscription_ids = remote_subs
        .iter()
        .map(|subscription| subscription.remote_id.as_str())
        .collect::<HashSet<_>>();
    warnings.extend(detect_stale_remote_subscriptions(
        account,
        &feeds,
        &remote_subscription_ids,
    ));
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
                warnings.push(ProviderSyncWarning {
                    kind: AccountSyncWarningKind::RetryPending,
                    message: format!(
                        "Local change '{}' for entry {} will retry next sync.",
                        pm.mutation_type.as_str(),
                        pm.remote_entry_id
                    ),
                    retry_at: None,
                    retry_in_seconds: None,
                });
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
        since: state
            .timestamp_usec
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
    let mut latest_timestamp_usec = saved_state.as_ref().and_then(|state| state.timestamp_usec);
    let mut skipped_entries = 0usize;

    loop {
        let scope = PullScope::Feed(FeedIdentifier::Remote {
            remote_id: remote_id.clone(),
        });
        let result = provider.pull_entries(scope, cursor.clone()).await?;
        skipped_entries += result.skipped_entries;

        if let Some(next_cursor) = result.next_cursor.as_ref() {
            if let Some(next_timestamp_usec) = next_cursor.since.map(|ts| ts.timestamp_micros()) {
                latest_timestamp_usec = Some(
                    latest_timestamp_usec
                        .map(|current| current.max(next_timestamp_usec))
                        .unwrap_or(next_timestamp_usec),
                );
            }
        }

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

fn detect_stale_remote_subscriptions(
    account: &Account,
    feeds: &[Feed],
    remote_subscription_ids: &HashSet<&str>,
) -> Vec<ProviderSyncWarning> {
    feeds
        .iter()
        .filter_map(|feed| {
            let remote_id = feed.remote_id.as_deref()?;
            if !is_provider_managed_greader_feed(Some(remote_id))
                || remote_subscription_ids.contains(remote_id)
            {
                return None;
            }
            warn!(
                "FreshRSS account '{}' feed '{}' is missing from the remote subscription list",
                account.name, feed.title
            );
            Some(ProviderSyncWarning {
                kind: AccountSyncWarningKind::Generic,
                message: format!(
                    "Remote subscription '{}' is no longer present on FreshRSS.",
                    feed.title
                ),
                retry_at: None,
                retry_in_seconds: None,
            })
        })
        .collect()
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

    const FEED_REMOTE_ID: &str = "feed/https://example.com/rss";
    const LOCAL_ETAG_OLD: &str = "\"etag-old\"";
    const LOCAL_ETAG_NEW: &str = "\"etag-new\"";
    const LOCAL_LAST_MODIFIED_OLD: &str = "Wed, 01 Jan 2025 00:00:00 GMT";
    const LOCAL_LAST_MODIFIED_NEW: &str = "Thu, 02 Jan 2025 00:00:00 GMT";
    static DEV_CREDENTIALS_ENV_LOCK: std::sync::LazyLock<tokio::sync::Mutex<()>> =
        std::sync::LazyLock::new(|| tokio::sync::Mutex::new(()));

    struct DevCredentialsContext {
        _guard: tokio::sync::MutexGuard<'static, ()>,
        _dir: tempfile::TempDir,
    }

    impl Drop for DevCredentialsContext {
        fn drop(&mut self) {
            std::env::remove_var("DEV_CREDENTIALS");
            std::env::remove_var("XDG_DATA_HOME");
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
    fn detects_stale_remote_subscriptions_without_deleting_local_feed() {
        let account = test_account("https://rss.example.com");
        let feeds = vec![
            Feed {
                id: FeedId("feed-present".to_string()),
                account_id: account.id.clone(),
                folder_id: None,
                remote_id: Some("feed/https://example.com/present.xml".to_string()),
                title: "Present".to_string(),
                url: "https://example.com/present.xml".to_string(),
                site_url: "https://example.com".to_string(),
                icon: None,
                unread_count: 0,
                reader_mode: "inherit".to_string(),
                web_preview_mode: "inherit".to_string(),
            },
            Feed {
                id: FeedId("feed-stale".to_string()),
                account_id: account.id.clone(),
                folder_id: None,
                remote_id: Some("feed/https://example.com/stale.xml".to_string()),
                title: "Stale".to_string(),
                url: "https://example.com/stale.xml".to_string(),
                site_url: "https://example.com".to_string(),
                icon: None,
                unread_count: 0,
                reader_mode: "inherit".to_string(),
                web_preview_mode: "inherit".to_string(),
            },
            Feed {
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
            },
        ];
        let remote_ids = HashSet::from(["feed/https://example.com/present.xml"]);

        let warnings = detect_stale_remote_subscriptions(&account, &feeds, &remote_ids);

        assert_eq!(warnings.len(), 1);
        assert_eq!(warnings[0].kind, AccountSyncWarningKind::Generic);
        assert!(warnings[0].message.contains("Stale"));
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
        std::env::set_var("DEV_CREDENTIALS", "1");
        let credentials_dir = tempfile::tempdir().unwrap();
        std::env::set_var("XDG_DATA_HOME", credentials_dir.path());
        keyring_store::set_password(account_id.as_ref(), "p").unwrap();
        DevCredentialsContext {
            _guard: guard,
            _dir: credentials_dir,
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

    #[tokio::test]
    async fn sync_greader_account_uses_account_stream_for_full_sync_and_maps_entries_to_feeds() {
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
                        { "id": "feed/https://example.com/feed-1.xml", "count": 1 },
                        { "id": "feed/https://example.com/feed-2.xml", "count": 1 }
                    ]
                }"#,
            )
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
    async fn sync_greader_feed_entries_keeps_previous_state_when_later_page_fails() {
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

        assert_eq!(state.timestamp_usec, saved_state.timestamp_usec);
        assert_eq!(state.continuation, saved_state.continuation);
        assert_eq!(state.etag, saved_state.etag);
        assert_eq!(state.last_modified, saved_state.last_modified);
        assert_eq!(state.last_success_at, saved_state.last_success_at);
        assert_eq!(state.last_error, saved_state.last_error);
        assert_eq!(state.error_count, saved_state.error_count);
        assert_eq!(state.next_retry_at, saved_state.next_retry_at);
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
        match error {
            AppError::UserVisible { message } => {
                assert!(message.contains("no such table: preferences"));
            }
            AppError::Retryable { message } => {
                panic!("post-write DB failures should not be retryable: {message}");
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
