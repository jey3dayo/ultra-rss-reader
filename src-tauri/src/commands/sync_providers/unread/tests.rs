use super::*;
use crate::domain::account::ConnectionVerificationStatus;
use crate::domain::article::{generate_entry_id, Article};
use crate::domain::provider::ProviderKind;
use crate::domain::types::{AccountId, ArticleId};
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
use crate::infra::provider::traits::{Credentials, FeedProvider};
use crate::infra::sanitizer;
use crate::repository::account::AccountRepository;
use crate::repository::article::ArticleRepository;
use crate::repository::pending_mutation::{
    PendingMutation, PendingMutationRepository, PendingMutationType,
};
use chrono::Utc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

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

fn stream_items_response<I, S>(ids: I, continuation: Option<&str>) -> String
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let items = ids
        .into_iter()
        .map(|id| format!(r#"{{"id":"{}"}}"#, id.as_ref()))
        .collect::<Vec<_>>()
        .join(", ");
    let continuation = continuation
        .map(|value| format!(r#", "continuation": "{value}""#))
        .unwrap_or_default();
    format!(r#"{{"items":[{items}]{continuation}}}"#)
}

async fn authenticated_provider(server: &mut mockito::Server) -> GReaderProvider {
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("password".to_string()),
            token: Some("user".to_string()),
        })
        .await
        .unwrap();
    provider
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

fn save_unread_fixture(db: &Mutex<DbManager>, account: &Account, feed: &Feed) -> Article {
    let article = test_article(&feed.id, "local-unread", false);
    let db_guard = db.lock().unwrap();
    let account_repo = SqliteAccountRepository::new(db_guard.writer());
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    let article_repo = SqliteArticleRepository::new(db_guard.writer());
    account_repo.save(account).unwrap();
    feed_repo.save(feed).unwrap();
    article_repo.upsert(std::slice::from_ref(&article)).unwrap();
    article
}

fn assert_article_is_unread(db: &Mutex<DbManager>, feed: &Feed, article_id: &ArticleId) {
    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let article = article_repo
        .find_by_feed(&feed.id, &crate::repository::article::Pagination::default())
        .unwrap()
        .into_iter()
        .find(|article| article.id == *article_id)
        .expect("fixture article should be present");
    assert!(
        !article.is_read,
        "incomplete unread snapshots must not mark local articles read"
    );
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

#[tokio::test]
async fn reconcile_greader_unread_state_does_not_mark_read_when_stream_fails_midway() {
    let db = test_db();
    let account = test_account();
    let feed = test_feed(&account.id, "feed/a", "https://example.com/a.rss");
    let local_article = save_unread_fixture(&db, &account, &feed);

    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/stream/contents/feed%2Fa",
        )
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "200".into()),
            mockito::Matcher::UrlEncoded("xt".into(), "user/-/state/com.google/read".into()),
        ]))
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"items": [{"id": "remote-page-1"}], "continuation": "page-2"}"#)
        .expect(1)
        .create_async()
        .await;
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/stream/contents/feed%2Fa",
        )
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
            mockito::Matcher::UrlEncoded("n".into(), "200".into()),
            mockito::Matcher::UrlEncoded("xt".into(), "user/-/state/com.google/read".into()),
            mockito::Matcher::UrlEncoded("c".into(), "page-2".into()),
        ]))
        .with_status(503)
        .with_body("temporarily unavailable")
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("password".to_string()),
            token: Some("user".to_string()),
        })
        .await
        .unwrap();

    let mut outcome = ReconcileOutcome::SkippedIncomplete;
    let result =
        reconcile_greader_unread_state_for_feed(&db, &provider, &account, &feed, 2, &mut outcome)
            .await;
    assert!(
        result.is_err(),
        "a mid-stream provider error must be observable"
    );
    assert_article_is_unread(&db, &feed, &local_article.id);
}

#[tokio::test]
async fn reconcile_greader_unread_state_does_not_mark_read_for_empty_stream() {
    let db = test_db();
    let account = test_account();
    let feed = test_feed(&account.id, "feed/a", "https://example.com/a.rss");
    let local_article = save_unread_fixture(&db, &account, &feed);

    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/stream/contents/feed%2Fa",
        )
        .match_query(mockito::Matcher::UrlEncoded(
            "xt".into(),
            "user/-/state/com.google/read".into(),
        ))
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"items": []}"#)
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("password".to_string()),
            token: Some("user".to_string()),
        })
        .await
        .unwrap();

    let mut outcome = ReconcileOutcome::SkippedIncomplete;
    let result =
        reconcile_greader_unread_state_for_feed(&db, &provider, &account, &feed, 1, &mut outcome)
            .await;
    assert!(
        result.is_ok(),
        "an empty snapshot should be a warning-only no-op when its count is inconsistent"
    );
    assert_article_is_unread(&db, &feed, &local_article.id);
}

#[tokio::test]
async fn reconcile_greader_unread_state_does_not_mark_read_when_count_mismatches() {
    let db = test_db();
    let account = test_account();
    let feed = test_feed(&account.id, "feed/a", "https://example.com/a.rss");
    let local_article = save_unread_fixture(&db, &account, &feed);

    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/stream/contents/feed%2Fa",
        )
        .match_query(mockito::Matcher::UrlEncoded(
            "xt".into(),
            "user/-/state/com.google/read".into(),
        ))
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"items": [{"id": "remote-only"}]}"#)
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("password".to_string()),
            token: Some("user".to_string()),
        })
        .await
        .unwrap();

    let mut outcome = ReconcileOutcome::SkippedIncomplete;
    let result =
        reconcile_greader_unread_state_for_feed(&db, &provider, &account, &feed, 2, &mut outcome)
            .await;
    assert!(
        result.is_ok(),
        "a remote count mismatch should be a warning-only no-op"
    );
    assert_article_is_unread(&db, &feed, &local_article.id);
}

#[tokio::test]
async fn reconcile_greader_unread_state_keeps_article_marked_read_during_pull() {
    let db = std::sync::Arc::new(test_db());
    let account = test_account();
    let feed = test_feed(&account.id, "feed/a", "https://example.com/a.rss");
    let remote_entry_id = "entry-1".to_string();
    let article_id = generate_entry_id(
        account.id.as_ref(),
        Some(&remote_entry_id),
        &feed.url,
        None,
        None,
    );

    {
        let db_guard = db.lock().unwrap();
        let account_repo = SqliteAccountRepository::new(db_guard.writer());
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        account_repo.save(&account).unwrap();
        feed_repo.save(&feed).unwrap();
        article_repo
            .upsert(&[Article {
                id: article_id.clone(),
                feed_id: feed.id.clone(),
                remote_id: Some(remote_entry_id.clone()),
                title: "Read During Pull".to_string(),
                content_raw: "body".to_string(),
                content_sanitized: "body".to_string(),
                sanitizer_version: sanitizer::SANITIZER_VERSION,
                summary: None,
                url: None,
                author: None,
                published_at: Utc::now(),
                thumbnail: None,
                is_read: false,
                is_starred: false,
                fetched_at: Utc::now(),
            }])
            .unwrap();
    }

    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    // The remote stream still reports the entry as unread (it appears in the
    // items list). While that response is being produced (mid-fetch), the
    // user marks the article read locally, queueing a pending mutation. The
    // is_read UPDATE below must not revert that local read mark back to
    // unread when it later processes this feed's rows.
    let mark_read_db = std::sync::Arc::clone(&db);
    let mark_read_account_id = account.id.clone();
    let mark_read_article_id = article_id.clone();
    let mark_read_remote_entry_id = remote_entry_id.clone();
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/stream/contents/feed%2Fa",
        )
        .match_query(mockito::Matcher::UrlEncoded(
            "xt".into(),
            "user/-/state/com.google/read".into(),
        ))
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body_from_request(move |_| {
            let db_guard = mark_read_db.lock().unwrap();
            db_guard
                .writer()
                .execute(
                    "UPDATE articles SET is_read = 1 WHERE id = ?1",
                    rusqlite::params![mark_read_article_id.0],
                )
                .unwrap();
            let pending_repo = SqlitePendingMutationRepository::new(db_guard.writer());
            pending_repo
                .save(&PendingMutation {
                    id: None,
                    account_id: mark_read_account_id.clone(),
                    mutation_type: PendingMutationType::MarkRead,
                    remote_entry_id: mark_read_remote_entry_id.clone(),
                    created_at: chrono::Utc::now().to_rfc3339(),
                })
                .unwrap();
            format!(r#"{{"items": [{{"id": "{mark_read_remote_entry_id}"}}]}}"#).into_bytes()
        })
        .create_async()
        .await;

    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            password: Some("password".to_string()),
            token: Some("user".to_string()),
        })
        .await
        .unwrap();

    let mut outcome = ReconcileOutcome::SkippedIncomplete;
    reconcile_greader_unread_state_for_feed(&db, &provider, &account, &feed, 1, &mut outcome)
        .await
        .unwrap();

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let article = article_repo
        .find_by_feed(&feed.id, &crate::repository::article::Pagination::default())
        .unwrap()
        .into_iter()
        .find(|article| article.id == article_id)
        .unwrap();
    assert!(
        article.is_read,
        "a read marked during the unread-entries fetch should stay read after reconcile"
    );
}

#[tokio::test]
async fn reconcile_greader_unread_counts_skips_empty_page_with_continuation() {
    let db = test_db();
    let account = test_account();
    let feed = test_feed(&account.id, "feed/a", "https://example.com/a.rss");
    let local_article = save_unread_fixture(&db, &account, &feed);

    let mut server = mockito::Server::new_async().await;
    let unread_stream_mock = server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/stream/contents/feed%2Fa",
        )
        .match_query(mockito::Matcher::UrlEncoded(
            "xt".into(),
            "user/-/state/com.google/read".into(),
        ))
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"items": [], "continuation": "page-2"}"#)
        .create_async()
        .await;
    let provider = authenticated_provider(&mut server).await;

    let backfilled = reconcile_greader_unread_counts(
        &db,
        &provider,
        &account,
        std::slice::from_ref(&feed),
        &HashMap::from([("feed/a".to_string(), 1)]),
    )
    .await
    .unwrap();

    assert_eq!(backfilled, 0);
    unread_stream_mock.assert_async().await;
    assert_article_is_unread(&db, &feed, &local_article.id);
}

#[tokio::test]
async fn reconcile_greader_unread_state_skips_repeated_continuation() {
    let db = test_db();
    let account = test_account();
    let feed = test_feed(&account.id, "feed/a", "https://example.com/a.rss");
    let local_article = save_unread_fixture(&db, &account, &feed);

    let mut server = mockito::Server::new_async().await;
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/stream/contents/feed%2Fa",
        )
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("xt".into(), "user/-/state/com.google/read".into()),
            mockito::Matcher::UrlEncoded("output".into(), "json".into()),
        ]))
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(stream_items_response(["remote-page-1"], Some("same-page")))
        .create_async()
        .await;
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/stream/contents/feed%2Fa",
        )
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("xt".into(), "user/-/state/com.google/read".into()),
            mockito::Matcher::UrlEncoded("c".into(), "same-page".into()),
        ]))
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(stream_items_response(["remote-page-2"], Some("same-page")))
        .create_async()
        .await;
    let provider = authenticated_provider(&mut server).await;

    let mut outcome = ReconcileOutcome::SkippedIncomplete;
    let result =
        reconcile_greader_unread_state_for_feed(&db, &provider, &account, &feed, 2, &mut outcome)
            .await;

    assert!(result.is_ok());
    assert!(matches!(outcome, ReconcileOutcome::SkippedIncomplete));
    assert_article_is_unread(&db, &feed, &local_article.id);
}

#[tokio::test]
async fn reconcile_greader_unread_state_skips_full_page_without_continuation() {
    let db = test_db();
    let account = test_account();
    let feed = test_feed(&account.id, "feed/a", "https://example.com/a.rss");
    let local_article = save_unread_fixture(&db, &account, &feed);
    let ids = (0..200)
        .map(|index| format!("full-page-{index}"))
        .collect::<Vec<_>>();

    let mut server = mockito::Server::new_async().await;
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/stream/contents/feed%2Fa",
        )
        .match_query(mockito::Matcher::UrlEncoded(
            "xt".into(),
            "user/-/state/com.google/read".into(),
        ))
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(stream_items_response(&ids, None))
        .create_async()
        .await;
    let provider = authenticated_provider(&mut server).await;

    let mut outcome = ReconcileOutcome::SkippedIncomplete;
    let result =
        reconcile_greader_unread_state_for_feed(&db, &provider, &account, &feed, 200, &mut outcome)
            .await;

    assert!(result.is_ok());
    assert!(matches!(outcome, ReconcileOutcome::SkippedIncomplete));
    assert_article_is_unread(&db, &feed, &local_article.id);
}

#[tokio::test]
async fn reconcile_greader_unread_state_skips_when_snapshot_id_set_changes() {
    let db = test_db();
    let account = test_account();
    let feed = test_feed(&account.id, "feed/a", "https://example.com/a.rss");
    let local_article = save_unread_fixture(&db, &account, &feed);
    let response_count = Arc::new(AtomicUsize::new(0));

    let mut server = mockito::Server::new_async().await;
    let response_count_for_mock = Arc::clone(&response_count);
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/stream/contents/feed%2Fa",
        )
        .match_query(mockito::Matcher::UrlEncoded(
            "xt".into(),
            "user/-/state/com.google/read".into(),
        ))
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body_from_request(move |_| {
            if response_count_for_mock.fetch_add(1, Ordering::SeqCst) == 0 {
                stream_items_response(["remote-stable", "remote-old"], None)
            } else {
                stream_items_response(["remote-stable", "remote-new"], None)
            }
            .into_bytes()
        })
        .create_async()
        .await;
    let provider = authenticated_provider(&mut server).await;

    let mut outcome = ReconcileOutcome::SkippedIncomplete;
    let result =
        reconcile_greader_unread_state_for_feed(&db, &provider, &account, &feed, 2, &mut outcome)
            .await;

    assert!(result.is_ok());
    assert!(matches!(outcome, ReconcileOutcome::SkippedIncomplete));
    assert_eq!(response_count.load(Ordering::SeqCst), 2);
    assert_article_is_unread(&db, &feed, &local_article.id);
}

#[tokio::test]
async fn reconcile_greader_unread_state_skips_duplicate_ids_across_pages() {
    let db = test_db();
    let account = test_account();
    let feed = test_feed(&account.id, "feed/a", "https://example.com/a.rss");
    let local_article = save_unread_fixture(&db, &account, &feed);

    let mut server = mockito::Server::new_async().await;
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/stream/contents/feed%2Fa",
        )
        .match_query(mockito::Matcher::UrlEncoded(
            "xt".into(),
            "user/-/state/com.google/read".into(),
        ))
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(stream_items_response(["duplicate-id"], Some("page-2")))
        .create_async()
        .await;
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/stream/contents/feed%2Fa",
        )
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("xt".into(), "user/-/state/com.google/read".into()),
            mockito::Matcher::UrlEncoded("c".into(), "page-2".into()),
        ]))
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(stream_items_response(["duplicate-id"], None))
        .create_async()
        .await;
    let provider = authenticated_provider(&mut server).await;

    let mut outcome = ReconcileOutcome::SkippedIncomplete;
    let result =
        reconcile_greader_unread_state_for_feed(&db, &provider, &account, &feed, 1, &mut outcome)
            .await;

    assert!(result.is_ok());
    assert!(matches!(outcome, ReconcileOutcome::SkippedIncomplete));
    assert_article_is_unread(&db, &feed, &local_article.id);
}
