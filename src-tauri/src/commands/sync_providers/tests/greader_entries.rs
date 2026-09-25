use super::*;

const TEST_G_READER_MAX_ENTRY_PAGES: usize = 3;

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
async fn sync_greader_feed_entries_stops_at_page_cap_after_persisting_entries() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let page_calls = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let response_calls = std::sync::Arc::clone(&page_calls);
    let stream_mock = server
        .mock(
            "GET",
            Matcher::Regex(r"/api/greader.php/reader/api/0/stream/contents/.*".to_string()),
        )
        .match_query(Matcher::Any)
        .match_header("Authorization", "GoogleLogin auth=tok")
        .expect(TEST_G_READER_MAX_ENTRY_PAGES)
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body_from_request(move |_| {
            let page = response_calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst) as i64;
            let timestamp_usec = 1_700_000_000_000_000_i64 + page * 1_000_000;
            let published = 1_700_000_000_i64 + page;
            format!(
                r#"{{"items":[{{"id":"entry-{page}","title":"Page {page}","alternate":[{{"href":"https://example.com/{page}"}}],"timestampUsec":"{timestamp_usec}","published":{published},"origin":{{"streamId":"{FEED_REMOTE_ID}","title":"Example"}},"categories":[]}}],"continuation":"page-{}"}}"#,
                page + 1
            )
            .into_bytes()
        })
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    let saved_state = SyncState {
        account_id: account.id.clone(),
        scope_key: feed_scope_key(FEED_REMOTE_ID).as_string(),
        timestamp_usec: Some(1_600_000_000_000_000),
        continuation: None,
        etag: None,
        last_modified: None,
        last_success_at: Some("2026-08-26T00:00:00Z".to_string()),
        last_error: None,
        error_count: 2,
        next_retry_at: Some("2026-08-26T00:10:00Z".to_string()),
    };
    {
        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        sync_state_repo.save(&saved_state).unwrap();
    }
    let provider = authenticated_provider(&server.url()).await;

    sync_greader_feed_entries_with_max_pages(
        &db,
        &provider,
        &account,
        &feed,
        TEST_G_READER_MAX_ENTRY_PAGES,
    )
    .await
    .expect("reaching the page cap should return a partial outcome with failure state");

    stream_mock.assert_async().await;
    assert_eq!(
        page_calls.load(std::sync::atomic::Ordering::SeqCst),
        TEST_G_READER_MAX_ENTRY_PAGES
    );

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(
            &feed.id,
            &Pagination {
                offset: 0,
                limit: TEST_G_READER_MAX_ENTRY_PAGES,
            },
        )
        .unwrap();
    let state = sync_state_repo
        .get(&account.id, &feed_scope_key(FEED_REMOTE_ID))
        .unwrap()
        .unwrap();

    assert_eq!(articles.len(), TEST_G_READER_MAX_ENTRY_PAGES);
    assert_eq!(state.timestamp_usec, saved_state.timestamp_usec);
    assert_eq!(state.continuation, None);
    assert!(state
        .last_error
        .as_deref()
        .is_some_and(|message| message == "GReader entry pagination incomplete (reason=page_cap)"));
    assert_eq!(state.error_count, saved_state.error_count + 1);
    assert_eq!(state.last_success_at, saved_state.last_success_at);
    assert_eq!(state.next_retry_at, None);
}

#[tokio::test]
async fn sync_greader_feed_entries_preserves_saved_timestamp_when_later_page_fails() {
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

/// The pull response deletes the feed's only saved article mid-flight (via
/// `with_body_from_request`), simulating a concurrent deletion race between
/// the "before" and "after" article counts in `sync_greader_feed`. This is
/// the FeedArticlesVanished anomaly detector's real trigger condition.
#[tokio::test]
async fn sync_greader_feed_reports_feed_articles_vanished_when_articles_disappear_mid_sync() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let db = std::sync::Arc::new(test_db());
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let article = Article {
            id: generate_entry_id(
                account.id.as_ref(),
                Some("remote-1"),
                &feed.url,
                Some("https://example.com/1"),
                Some("Vanishing Article"),
            ),
            feed_id: feed.id.clone(),
            remote_id: Some("remote-1".to_string()),
            title: "Vanishing Article".to_string(),
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
    }

    let feed_id_for_deletion = feed.id.clone();
    let db_for_pull = std::sync::Arc::clone(&db);
    server
        .mock(
            "GET",
            Matcher::Regex(r"/api/greader.php/reader/api/0/stream/contents/.*".to_string()),
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body_from_request(move |_| {
            let db_guard = db_for_pull.lock().unwrap();
            db_guard
                .writer()
                .execute(
                    "DELETE FROM articles WHERE feed_id = ?1",
                    rusqlite::params![feed_id_for_deletion.0],
                )
                .unwrap();
            br#"{ "items": [] }"#.to_vec()
        })
        .create_async()
        .await;

    let _credentials = configure_dev_credentials(&account.id).await;
    let session = authenticated_session(&server.url()).await;
    let outcome = sync_greader_feed(&db, &account, &feed, &session)
        .await
        .unwrap();

    assert_eq!(outcome.warnings.len(), 1);
    assert_eq!(
        outcome.warnings[0].detail,
        AccountSyncWarningDetail::FeedArticlesVanished {
            feed_title: feed.title.clone(),
            count_before: 1,
        }
    );
}
