use std::collections::HashMap;
use std::sync::Mutex;

use tracing::warn;

use crate::commands::dto::AppError;
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
use crate::repository::pending_mutation::PendingMutationRepository;
use crate::repository::sync_state::{SyncState, SyncStateRepository};

use super::feed_commands::lock_db;

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
            let _ = feed_repo_w.recalculate_unread_count(&feed.id);
        }
    }

    let next_state = SyncState {
        account_id: account_id.clone(),
        scope_key,
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

/// Sync a GReader-compatible account (FreshRSS, Inoreader): authenticate, sync folders, subscriptions, entries, state, unread counts.
pub(super) async fn sync_greader_account(
    db: &Mutex<DbManager>,
    account: &Account,
    mut provider: GReaderProvider,
) -> Result<(), AppError> {
    use crate::domain::folder::Folder;

    let username = match &account.username {
        Some(u) => u.clone(),
        None => {
            warn!(
                "GReader account {} has no username, skipping",
                account.id.as_ref()
            );
            return Ok(());
        }
    };

    // Step 1: Authenticate (no DB lock)
    let password = keyring_store::get_password(account.id.as_ref())?;
    provider
        .authenticate(&Credentials {
            token: Some(username),
            password: Some(password),
        })
        .await?;

    // Step 2: Sync folders
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

    // Steps 3-7
    sync_greader_feeds(db, &provider, account).await?;

    Ok(())
}

/// Steps 3-7: sync subscriptions, pull entries, push mutations, apply remote state, recalculate unread counts.
async fn sync_greader_feeds(
    db: &Mutex<DbManager>,
    provider: &GReaderProvider,
    account: &Account,
) -> Result<(), AppError> {
    // Build remote_id -> FolderId map from existing folders
    let folder_remote_id_map: HashMap<String, FolderId> = {
        let db_guard = lock_db(db)?;
        let folder_repo = SqliteFolderRepository::new(db_guard.reader());
        let folders = folder_repo.find_by_account(&account.id)?;
        folders
            .into_iter()
            .filter_map(|f| f.remote_id.map(|rid| (rid, f.id)))
            .collect()
    };

    // Step 3: Sync subscriptions
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
                folder_id: rs
                    .folder_remote_id
                    .as_ref()
                    .and_then(|rid| folder_remote_id_map.get(rid))
                    .cloned()
                    .or_else(|| existing.as_ref().and_then(|f| f.folder_id.clone())),
                remote_id: Some(rs.remote_id.clone()),
                title: rs.title.clone(),
                url: rs.url.clone(),
                site_url: rs.site_url.clone(),
                icon: None,
                unread_count: 0,
                display_mode: existing
                    .as_ref()
                    .map(|f| f.display_mode.clone())
                    .unwrap_or_else(|| "inherit".to_string()),
            };
            feed_repo.save(&feed)?;
        }
    }

    // Step 4: Pull entries per feed
    let feeds = {
        let db_guard = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db_guard.reader());
        feed_repo.find_by_account(&account.id)?
    };

    for feed in &feeds {
        if let Err(e) = sync_greader_feed_entries(db, provider, account, feed).await {
            warn!("Failed to pull entries for feed {}: {e}", feed.url);
        }
    }

    // Step 5: Push pending mutations to server one by one
    let pending_mutations = {
        let db_guard = lock_db(db)?;
        let pending_repo = SqlitePendingMutationRepository::new(db_guard.reader());
        pending_repo.find_by_account(&account.id)?
    };

    let mut pushed_remote_ids: Vec<String> = Vec::new();
    for pm in &pending_mutations {
        let mutation = match pm.mutation_type.as_str() {
            "mark_read" => Mutation::MarkRead {
                remote_entry_id: pm.remote_entry_id.clone(),
            },
            "mark_unread" => Mutation::MarkUnread {
                remote_entry_id: pm.remote_entry_id.clone(),
            },
            "star" => Mutation::SetStarred {
                remote_entry_id: pm.remote_entry_id.clone(),
                starred: true,
            },
            "unstar" => Mutation::SetStarred {
                remote_entry_id: pm.remote_entry_id.clone(),
                starred: false,
            },
            other => {
                warn!("Unknown mutation type: {other}");
                continue;
            }
        };

        match provider.push_mutations(&[mutation]).await {
            Ok(()) => {
                pushed_remote_ids.push(pm.remote_entry_id.clone());
                if let Some(id) = pm.id {
                    let db_guard = lock_db(db)?;
                    let pending_repo = SqlitePendingMutationRepository::new(db_guard.writer());
                    pending_repo.delete(&[id])?;
                }
            }
            Err(e) => {
                warn!(
                    "Failed to push mutation {} for entry {}: {e}. Will retry next sync.",
                    pm.mutation_type, pm.remote_entry_id
                );
            }
        }
    }

    // Step 6: Pull remote state and apply (skip articles with pending or just-pushed mutations)
    let pending_remote_ids: Vec<String> = {
        let db_guard = lock_db(db)?;
        let pending_repo = SqlitePendingMutationRepository::new(db_guard.reader());
        let mut ids: Vec<String> = pending_repo
            .find_by_account(&account.id)?
            .into_iter()
            .map(|pm| pm.remote_entry_id)
            .collect();
        // Merge with successfully pushed IDs to prevent stale remote data from overwriting
        ids.extend(pushed_remote_ids);
        ids.sort();
        ids.dedup();
        ids
    };

    let remote_state = provider.pull_state().await?;
    {
        let db_guard = lock_db(db)?;
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        article_repo.apply_remote_state(
            &account.id,
            &remote_state.read_ids,
            &remote_state.starred_ids,
            &pending_remote_ids,
        )?;
    }

    // Step 7: Recalculate unread counts
    {
        let db_guard = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        for feed in &feeds {
            let _ = feed_repo.recalculate_unread_count(&feed.id);
        }
    }

    Ok(())
}

fn feed_scope_key(remote_id: &str) -> String {
    format!("feed:{remote_id}")
}

fn local_feed_scope_key(feed_url: &str) -> String {
    format!("local_feed:{feed_url}")
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
) -> Result<(), AppError> {
    let Some(remote_id) = feed.remote_id.as_ref() else {
        return Ok(());
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

    loop {
        let scope = PullScope::Feed(FeedIdentifier::Remote {
            remote_id: remote_id.clone(),
        });
        let result = provider.pull_entries(scope, cursor.clone()).await?;

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
        }

        if !result.has_more {
            break;
        }

        cursor = result.next_cursor.clone();
    }

    let next_state = SyncState {
        account_id: account.id.clone(),
        scope_key,
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

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
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
            sync_on_wake: false,
            keep_read_items_days: 30,
        }
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
            display_mode: "inherit".to_string(),
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

    fn test_local_account() -> Account {
        Account {
            id: AccountId::new(),
            kind: ProviderKind::Local,
            name: "Local".to_string(),
            server_url: None,
            username: None,
            sync_interval_secs: 3600,
            sync_on_wake: false,
            keep_read_items_days: 30,
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
            display_mode: "inherit".to_string(),
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
            scope_key: feed_scope_key(FEED_REMOTE_ID),
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
                    scope_key: feed_scope_key(FEED_REMOTE_ID),
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
            scope_key: feed_scope_key(FEED_REMOTE_ID),
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
        let provider = LocalProvider::new();

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
                    scope_key: local_feed_scope_key(&feed.url),
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

        let provider = LocalProvider::new();
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
                    scope_key: local_feed_scope_key(&feed.url),
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

        let provider = LocalProvider::new();
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
                    scope_key: local_feed_scope_key(&feed.url),
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

        let provider = LocalProvider::new();
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
}
