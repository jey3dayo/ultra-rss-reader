use super::*;
use crate::domain::article::{generate_entry_id, Article};
use crate::infra::sanitizer;
use crate::repository::pending_mutation::{
    PendingMutation, PendingMutationRepository, PendingMutationType,
};

fn unread_stream_path(remote_id: &str) -> String {
    format!(
        "/api/greader.php/reader/api/0/stream/contents/{}",
        remote_id
            .replace('/', "%2F")
            .replace(':', "%3A")
            .replace('/', "%2F")
    )
}

async fn empty_unread_stream_mock(
    server: &mut mockito::Server,
    remote_id: &str,
    expected: usize,
) -> mockito::Mock {
    server
        .mock("GET", Matcher::Exact(unread_stream_path(remote_id)))
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "200".into()),
            Matcher::UrlEncoded("xt".into(), "user/-/state/com.google/read".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "items": [] }"#)
        .expect(expected)
        .create_async()
        .await
}

async fn auth_mock(server: &mut mockito::Server) {
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;
}

#[tokio::test]
async fn reconcile_greader_unread_counts_checks_equal_count_feeds_on_first_rotation() {
    let mut server = mockito::Server::new_async().await;
    let unread_stream_mock = empty_unread_stream_mock(&mut server, FEED_REMOTE_ID, 2).await;
    auth_mock(&mut server).await;
    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    let provider = authenticated_provider(&server.url()).await;

    reconcile_greader_unread_counts(
        &db,
        &provider,
        &account,
        std::slice::from_ref(&feed),
        &HashMap::from([(FEED_REMOTE_ID.to_string(), 0)]),
        &[],
    )
    .await
    .unwrap();

    unread_stream_mock.assert_async().await;
    let db_guard = db.lock().unwrap();
    let state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    assert!(state_repo
        .get(
            &account.id,
            SyncStateScopeKey::greader_unread_drift(FEED_REMOTE_ID)
        )
        .unwrap()
        .and_then(|state| state.last_success_at)
        .is_some());
}

#[tokio::test]
async fn equal_count_drift_rotation_preserves_a_read_mark_during_reconcile() {
    let db = std::sync::Arc::new(test_db());
    let (account, feed) = insert_account_and_feed(&db, "http://localhost");
    let remote_entry_id = "entry-1";
    let article_id = generate_entry_id(
        account.id.as_ref(),
        Some(remote_entry_id),
        &feed.url,
        Some("https://example.com/1"),
        Some("Article"),
    );
    {
        let db_guard = db.lock().unwrap();
        SqliteArticleRepository::new(db_guard.writer())
            .upsert(&[Article {
                id: article_id.clone(),
                feed_id: feed.id.clone(),
                remote_id: Some(remote_entry_id.to_string()),
                title: "Article".to_string(),
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
            }])
            .unwrap();
    }

    let mut server = mockito::Server::new_async().await;
    auth_mock(&mut server).await;
    let mark_read_db = std::sync::Arc::clone(&db);
    let mark_read_account_id = account.id.clone();
    let mark_read_article_id = article_id.clone();
    let mark_read_remote_entry_id = remote_entry_id.to_string();
    let unread_stream_mock = server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/stream/contents/feed%2Fhttps%3A%2F%2Fexample.com%2Frss",
        )
        .match_query(Matcher::UrlEncoded(
            "xt".into(),
            "user/-/state/com.google/read".into(),
        ))
        .with_status(200)
        .with_body_from_request(move |_| {
            let db_guard = mark_read_db.lock().unwrap();
            db_guard
                .writer()
                .execute(
                    "UPDATE articles SET is_read = 1 WHERE id = ?1",
                    rusqlite::params![&mark_read_article_id.0],
                )
                .unwrap();
            SqlitePendingMutationRepository::new(db_guard.writer())
                .save(&PendingMutation {
                    id: None,
                    account_id: mark_read_account_id.clone(),
                    mutation_type: PendingMutationType::MarkRead,
                    remote_entry_id: mark_read_remote_entry_id.clone(),
                    created_at: chrono::Utc::now().to_rfc3339(),
                })
                .unwrap();
            format!(r#"{{"items":[{{"id":"{remote_entry_id}","title":"Article","alternate":[{{"href":"https://example.com/1"}}],"categories":[]}}]}}"#).into_bytes()
        })
        .expect(2)
        .create_async()
        .await;
    let provider = authenticated_provider(&server.url()).await;

    reconcile_greader_unread_counts(
        &db,
        &provider,
        &account,
        std::slice::from_ref(&feed),
        &HashMap::from([(FEED_REMOTE_ID.to_string(), 1)]),
        &[],
    )
    .await
    .unwrap();

    unread_stream_mock.assert_async().await;
    let db_guard = db.lock().unwrap();
    let article = SqliteArticleRepository::new(db_guard.reader())
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap()
        .into_iter()
        .find(|article| article.id == article_id)
        .unwrap();
    assert!(
        article.is_read,
        "pending read must survive the equal-count drift reconcile"
    );
}

#[tokio::test]
async fn reconcile_greader_unread_counts_limits_equal_count_rotation_to_three_feeds() {
    let mut server = mockito::Server::new_async().await;
    let remote_ids = [
        "feed/https://example.com/rss-1",
        "feed/https://example.com/rss-2",
        "feed/https://example.com/rss-3",
        "feed/https://example.com/rss-4",
    ];
    let unread_stream_mocks = [
        empty_unread_stream_mock(&mut server, remote_ids[0], 2).await,
        empty_unread_stream_mock(&mut server, remote_ids[1], 2).await,
        empty_unread_stream_mock(&mut server, remote_ids[2], 2).await,
    ];
    auth_mock(&mut server).await;
    let db = test_db();
    let feed_specs = remote_ids.map(|remote_id| {
        (
            remote_id,
            "Example Feed",
            "https://example.com/rss",
            "https://example.com",
        )
    });
    let (account, feeds) = insert_account_and_feeds(&db, &server.url(), &feed_specs);
    let provider = authenticated_provider(&server.url()).await;
    let server_unread_counts = remote_ids
        .iter()
        .map(|remote_id| (remote_id.to_string(), 0))
        .collect::<HashMap<_, _>>();

    reconcile_greader_unread_counts(&db, &provider, &account, &feeds, &server_unread_counts, &[])
        .await
        .unwrap();

    for unread_stream_mock in unread_stream_mocks {
        unread_stream_mock.assert_async().await;
    }
}

#[tokio::test]
async fn reconcile_greader_unread_counts_skips_equal_count_feed_during_cooldown() {
    let mut server = mockito::Server::new_async().await;
    let unread_stream_mock = empty_unread_stream_mock(&mut server, FEED_REMOTE_ID, 2).await;
    auth_mock(&mut server).await;
    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    let provider = authenticated_provider(&server.url()).await;
    let server_unread_counts = HashMap::from([(FEED_REMOTE_ID.to_string(), 0)]);

    for _ in 0..2 {
        reconcile_greader_unread_counts(
            &db,
            &provider,
            &account,
            std::slice::from_ref(&feed),
            &server_unread_counts,
            &[],
        )
        .await
        .unwrap();
    }

    unread_stream_mock.assert_async().await;
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
        &[],
    )
    .await
    .unwrap();

    unread_stream_mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    let reconciled_feed = feed_repo.find_by_id(&feed.id).unwrap().unwrap();

    assert_eq!(backfilled, 0);
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
        .expect(2)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    let sibling_feed = Feed {
        id: FeedId::new(),
        account_id: account.id.clone(),
        folder_id: None,
        remote_id: Some("feed/https://example.com/sibling-rss".to_string()),
        title: "Sibling Feed".to_string(),
        url: "https://example.com/sibling-rss".to_string(),
        site_url: "https://example.com".to_string(),
        icon: None,
        icon_url: None,
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    };
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
        Article {
            id: generate_entry_id(
                account.id.as_ref(),
                Some("tag:google.com,2005:reader/item/sibling-muted"),
                &sibling_feed.url,
                Some("https://example.com/sibling-muted"),
                Some("Kindle Unlimited sibling"),
            ),
            feed_id: sibling_feed.id.clone(),
            remote_id: Some("tag:google.com,2005:reader/item/sibling-muted".to_string()),
            title: "Kindle Unlimited sibling".to_string(),
            content_raw: "body".to_string(),
            content_sanitized: "body".to_string(),
            sanitizer_version: sanitizer::SANITIZER_VERSION,
            summary: None,
            url: Some("https://example.com/sibling-muted".to_string()),
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
        feed_repo.save(&sibling_feed).unwrap();
        article_repo.upsert(&local_articles).unwrap();
        feed_repo.update_unread_count(&feed.id, 2).unwrap();
        feed_repo.update_unread_count(&sibling_feed.id, 77).unwrap();
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
    }

    let provider = authenticated_provider(&server.url()).await;
    let server_unread_counts = HashMap::from([(FEED_REMOTE_ID.to_string(), 1)]);

    let backfilled = reconcile_greader_unread_counts(
        &db,
        &provider,
        &account,
        std::slice::from_ref(&feed),
        &server_unread_counts,
        &[],
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
    let sibling_feed_after = feed_repo.find_by_id(&sibling_feed.id).unwrap().unwrap();
    let sibling_article_is_read: bool = db_guard
        .reader()
        .query_row(
            "SELECT is_read FROM articles WHERE feed_id = ?1",
            rusqlite::params![sibling_feed.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
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
    assert!(!sibling_article_is_read);
    assert_eq!(sibling_feed_after.unread_count, 77);
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
        .expect(2)
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
        &[],
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
