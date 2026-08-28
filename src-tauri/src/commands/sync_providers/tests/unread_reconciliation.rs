use super::*;

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
