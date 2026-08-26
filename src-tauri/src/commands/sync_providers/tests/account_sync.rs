//! GReader account-level sync orchestration and unread-count reconciliation tests.

use super::*;

#[tokio::test]
async fn greader_password_lookup_times_out_when_keychain_blocks() {
    let started_at = Instant::now();
    let error = get_greader_password_with_timeout("acc-timeout", Duration::from_millis(10), |_| {
        std::thread::sleep(Duration::from_millis(250));
        Ok("password".to_string())
    })
    .await
    .expect_err("blocking keychain lookup should time out");

    assert!(started_at.elapsed() < Duration::from_millis(200));
    match error {
        AppError::UserVisible { message } => {
            assert!(message.contains("Timed out reading password from macOS Keychain"));
        }
        other => panic!("expected user-visible keychain timeout, got {other:?}"),
    }
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
    let stale_folder = Folder {
        id: FolderId::new(),
        account_id: account.id.clone(),
        remote_id: Some("user/-/label/Stale".to_string()),
        name: "Stale".to_string(),
        sort_order: 0,
    };
    {
        let db_guard = db.lock().unwrap();
        SqliteFolderRepository::new(db_guard.writer())
            .save(&stale_folder)
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account.id).await;

    let session = authenticated_session(&server.url()).await;
    let outcome = sync_greader_account(&db, &account, &session).await.unwrap();

    account_stream_mock.assert_async().await;
    per_feed_one_mock.assert_async().await;
    per_feed_two_mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    let folder_repo = SqliteFolderRepository::new(db_guard.reader());
    let feed_one_articles = article_repo
        .find_by_feed(&feeds[0].id, &Pagination::default())
        .unwrap();
    let feed_two_articles = article_repo
        .find_by_feed(&feeds[1].id, &Pagination::default())
        .unwrap();
    let feed_one = feed_repo.find_by_id(&feeds[0].id).unwrap().unwrap();
    let feed_two = feed_repo.find_by_id(&feeds[1].id).unwrap().unwrap();

    assert_eq!(outcome.warnings.len(), 1);
    assert_eq!(
            outcome.warnings[0].message,
            "FreshRSS removed 1 folder(s) that no longer exist remotely; their feeds were moved to Uncategorized."
        );
    assert!(folder_repo
        .find_by_remote_id(&account.id, "user/-/label/Stale")
        .unwrap()
        .is_none());
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

    let session = authenticated_session(&server.url()).await;
    sync_greader_account(&db, &account, &session).await.unwrap();

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

    let session = authenticated_session(&server.url()).await;
    let outcome = sync_greader_account(&db, &account, &session).await.unwrap();

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
    assert!(outcome.warnings.iter().any(|warning| matches!(
        &warning.detail,
        AccountSyncWarningDetail::AccountSkippedEntries { account_name, count }
            if account_name == "FreshRSS" && *count == 1
    )));
    assert!(outcome.warnings.iter().any(|warning| matches!(
        &warning.detail,
        AccountSyncWarningDetail::LocalFeedSyncFailed { feed_title, .. }
            if feed_title == "Broken Local"
    )));
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

    let session = authenticated_session(&server.url()).await;
    sync_greader_account(&db, &account, &session).await.unwrap();

    pull_state_read_mock.assert_async().await;
    pull_state_starred_mock.assert_async().await;
}

#[tokio::test]
async fn sync_greader_account_guards_pushed_and_retrying_pending_state() {
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
                            "categories": []
                        }
                    ]
                }"#,
        ))
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
            .with_provider_response(ProviderHttpResponseFixture::json(r#"{ "items": [] }"#))
            .create_async()
            .await;

    let pushed_mutation_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/edit-tag")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .match_body("i=entry-pushed&a=user%2F-%2Fstate%2Fcom.google%2Fread")
        .with_status(200)
        .with_body("OK")
        .create_async()
        .await;
    let retry_mutation_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/edit-tag")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .match_body("i=entry-retry&a=user%2F-%2Fstate%2Fcom.google%2Fread")
        .with_status(500)
        .with_body("failed")
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
            r#"{ "unreadcounts": [{ "id": "feed/https://example.com/feed-1.xml", "count": 0 }] }"#,
        ))
        .create_async()
        .await;

    let db = test_db();
    let (account, feeds) = insert_account_and_feeds(
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
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let pending_repo = SqlitePendingMutationRepository::new(db_guard.writer());
        let now = chrono::Utc::now();
        article_repo
            .upsert(&[
                Article {
                    id: ArticleId("article-pushed".to_string()),
                    feed_id: feeds[0].id.clone(),
                    remote_id: Some("entry-pushed".to_string()),
                    title: "Pushed".to_string(),
                    content_raw: "<p>Pushed</p>".to_string(),
                    content_sanitized: "<p>Pushed</p>".to_string(),
                    sanitizer_version: sanitizer::SANITIZER_VERSION,
                    summary: None,
                    url: Some("https://example.com/pushed".to_string()),
                    author: None,
                    published_at: now,
                    thumbnail: None,
                    is_read: true,
                    is_starred: false,
                    fetched_at: now,
                },
                Article {
                    id: ArticleId("article-retry".to_string()),
                    feed_id: feeds[0].id.clone(),
                    remote_id: Some("entry-retry".to_string()),
                    title: "Retry".to_string(),
                    content_raw: "<p>Retry</p>".to_string(),
                    content_sanitized: "<p>Retry</p>".to_string(),
                    sanitizer_version: sanitizer::SANITIZER_VERSION,
                    summary: None,
                    url: Some("https://example.com/retry".to_string()),
                    author: None,
                    published_at: now,
                    thumbnail: None,
                    is_read: true,
                    is_starred: false,
                    fetched_at: now,
                },
            ])
            .unwrap();
        pending_repo
            .save(&PendingMutation {
                id: None,
                account_id: account.id.clone(),
                mutation_type: PendingMutationType::MarkRead,
                remote_entry_id: "entry-pushed".to_string(),
                created_at: "2026-05-23T00:00:00Z".to_string(),
            })
            .unwrap();
        pending_repo
            .save(&PendingMutation {
                id: None,
                account_id: account.id.clone(),
                mutation_type: PendingMutationType::MarkRead,
                remote_entry_id: "entry-retry".to_string(),
                created_at: "2026-05-23T00:00:01Z".to_string(),
            })
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account.id).await;

    let session = authenticated_session(&server.url()).await;
    let outcome = sync_greader_account(&db, &account, &session).await.unwrap();

    pushed_mutation_mock.assert_async().await;
    retry_mutation_mock.assert_async().await;
    assert_eq!(outcome.warnings.len(), 1);
    assert_eq!(
        outcome.warnings[0].kind,
        AccountSyncWarningKind::RetryPending
    );

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let pending_repo = SqlitePendingMutationRepository::new(db_guard.reader());
    let saved_articles = article_repo
        .find_by_feed(
            &feeds[0].id,
            &Pagination {
                offset: 0,
                limit: 10,
            },
        )
        .unwrap();
    let read_by_remote_id = saved_articles
        .iter()
        .filter_map(|article| {
            article
                .remote_id
                .as_ref()
                .map(|remote_id| (remote_id.as_str(), article.is_read))
        })
        .collect::<HashMap<_, _>>();
    assert_eq!(read_by_remote_id.get("entry-pushed"), Some(&true));
    assert_eq!(read_by_remote_id.get("entry-retry"), Some(&true));

    let pending = pending_repo.find_by_account(&account.id).unwrap();
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].remote_entry_id, "entry-retry");
}
