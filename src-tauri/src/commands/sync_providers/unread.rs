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
use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
use crate::infra::provider::greader::GReaderProvider;
use crate::repository::article::ArticleRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::pending_mutation::{PendingMutationAxis, PendingMutationRepository};

use super::build_article_from_remote_entry;
use super::subscriptions::is_provider_managed_greader_feed;

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
        // Safe: target_feeds is filtered to feeds with a provider-managed remote_id above.
        let remote_id = feed
            .remote_id
            .as_deref()
            .expect("target_feeds only contains feeds with a remote_id");
        let server_unread_count = server_unread_counts.get(remote_id).copied().unwrap_or(0);
        let local_unread_count = local_unread_counts.get(&feed.id).copied().unwrap_or(0);

        if server_unread_count != local_unread_count {
            match reconcile_greader_unread_state_for_feed(db, provider, account, feed).await {
                Ok(()) => {
                    if server_unread_count > local_unread_count {
                        backfilled_feeds += 1;
                    }
                }
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
    mark_muted_unread_as_read_for_feed_with_conn(db_guard.writer(), &account.id, &feed.id)?;

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::account::ConnectionVerificationStatus;
    use crate::domain::article::Article;
    use crate::domain::provider::ProviderKind;
    use crate::domain::types::{AccountId, ArticleId};
    use crate::infra::db::sqlite_account::SqliteAccountRepository;
    use crate::infra::provider::traits::{Credentials, FeedProvider};
    use crate::infra::sanitizer;
    use crate::repository::account::AccountRepository;
    use crate::repository::article::ArticleRepository;
    use chrono::Utc;

    fn test_db() -> Mutex<DbManager> {
        Mutex::new(DbManager::new_in_memory().unwrap())
    }

    fn test_account() -> Account {
        Account {
            id: AccountId::new(),
            kind: ProviderKind::FreshRss,
            name: "FreshRSS".to_string(),
            server_url: Some("http://localhost".to_string()),
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

    fn test_feed(account_id: &AccountId, remote_id: &str, url: &str) -> Feed {
        Feed {
            id: FeedId::new(),
            account_id: account_id.clone(),
            folder_id: None,
            remote_id: Some(remote_id.to_string()),
            title: "Feed".to_string(),
            url: url.to_string(),
            site_url: "https://example.com".to_string(),
            icon: None,
            icon_url: None,
            unread_count: 0,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        }
    }

    fn test_article(feed_id: &FeedId, remote_id: &str, is_read: bool) -> Article {
        let now = Utc::now();
        Article {
            id: ArticleId(format!("{}-{remote_id}", feed_id.0)),
            feed_id: feed_id.clone(),
            remote_id: Some(remote_id.to_string()),
            title: "Article".to_string(),
            content_raw: "body".to_string(),
            content_sanitized: "body".to_string(),
            sanitizer_version: sanitizer::SANITIZER_VERSION,
            summary: None,
            url: None,
            author: None,
            published_at: now,
            thumbnail: None,
            is_read,
            is_starred: false,
            fetched_at: now,
        }
    }

    #[tokio::test]
    async fn reconcile_greader_unread_counts_batch_recalculates_multiple_feeds_in_one_call() {
        let db = test_db();
        let account = test_account();
        let feed_a = test_feed(&account.id, "feed/a", "https://example.com/a.rss");
        let feed_b = test_feed(&account.id, "feed/b", "https://example.com/b.rss");

        {
            let db_guard = db.lock().unwrap();
            let account_repo = SqliteAccountRepository::new(db_guard.writer());
            let feed_repo = SqliteFeedRepository::new(db_guard.writer());
            let article_repo = SqliteArticleRepository::new(db_guard.writer());
            account_repo.save(&account).unwrap();
            feed_repo.save(&feed_a).unwrap();
            feed_repo.save(&feed_b).unwrap();
            // Two unread articles per feed, while feeds.unread_count stays at the
            // stale default (0) until recalculation runs.
            article_repo
                .upsert(&[
                    test_article(&feed_a.id, "a1", false),
                    test_article(&feed_a.id, "a2", false),
                    test_article(&feed_b.id, "b1", false),
                    test_article(&feed_b.id, "b2", false),
                ])
                .unwrap();
        }

        // Server counts match the (stale) local column value of 0, so no per-feed
        // reconciliation network call is triggered; only the final batch
        // recalculate should run and correct the stored unread_count.
        let server_unread_counts =
            HashMap::from([("feed/a".to_string(), 0), ("feed/b".to_string(), 0)]);
        let provider = GReaderProvider::for_freshrss("http://localhost");

        let backfilled = reconcile_greader_unread_counts(
            &db,
            &provider,
            &account,
            &[feed_a.clone(), feed_b.clone()],
            &server_unread_counts,
        )
        .await
        .unwrap();

        assert_eq!(backfilled, 0);

        let db_guard = db.lock().unwrap();
        let feed_repo = SqliteFeedRepository::new(db_guard.reader());
        assert_eq!(
            feed_repo
                .find_by_id(&feed_a.id)
                .unwrap()
                .unwrap()
                .unread_count,
            2,
            "feed A unread_count should be recalculated from its actual unread articles"
        );
        assert_eq!(
            feed_repo
                .find_by_id(&feed_b.id)
                .unwrap()
                .unwrap()
                .unread_count,
            2,
            "feed B unread_count should be recalculated from its actual unread articles"
        );
    }

    #[tokio::test]
    async fn reconcile_greader_unread_counts_recalculates_earlier_feeds_when_a_later_feed_fails() {
        let db = test_db();
        let account = test_account();
        let feed_a = test_feed(&account.id, "feed/a", "https://example.com/a.rss");
        let feed_b = test_feed(&account.id, "feed/b", "https://example.com/b.rss");

        {
            let db_guard = db.lock().unwrap();
            let account_repo = SqliteAccountRepository::new(db_guard.writer());
            let feed_repo = SqliteFeedRepository::new(db_guard.writer());
            account_repo.save(&account).unwrap();
            feed_repo.save(&feed_a).unwrap();
            feed_repo.save(&feed_b).unwrap();
        }

        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;
        // feed/a's stream-contents endpoint is mocked and succeeds, reporting two
        // unread entries for feed A.
        server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/feed%2Fa",
            )
            .match_query(mockito::Matcher::Any)
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"items": [{"id": "feed-a-entry-1"}, {"id": "feed-a-entry-2"}]}"#)
            .create_async()
            .await;
        // feed/b's stream-contents endpoint is intentionally left unmocked, so the
        // request fails (mockito returns 501 for unmatched routes).

        let mut provider = GReaderProvider::for_freshrss(&server.url());
        provider
            .authenticate(&Credentials {
                password: Some("password".to_string()),
                token: Some("user".to_string()),
            })
            .await
            .unwrap();

        // Both feeds start at the stale local unread_count of 0 (from feed_repo.save
        // above) and disagree with the server counts below, so both are queued for
        // per-feed reconciliation; feed_b's reconciliation will fail.
        let server_unread_counts =
            HashMap::from([("feed/a".to_string(), 2), ("feed/b".to_string(), 2)]);

        let result = reconcile_greader_unread_counts(
            &db,
            &provider,
            &account,
            &[feed_a.clone(), feed_b.clone()],
            &server_unread_counts,
        )
        .await;

        assert!(
            result.is_err(),
            "reconciliation should surface feed_b's failure to the caller"
        );

        let db_guard = db.lock().unwrap();
        let feed_repo = SqliteFeedRepository::new(db_guard.reader());
        assert_eq!(
            feed_repo
                .find_by_id(&feed_a.id)
                .unwrap()
                .unwrap()
                .unread_count,
            2,
            "feed A should still be recalculated from its actual unread articles \
             even though feed B's reconciliation failed afterward"
        );
    }
}
