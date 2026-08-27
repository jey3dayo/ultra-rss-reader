//! GReader per-feed sync, remote-state repair, and local (non-GReader) feed sync tests.

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

    let session = authenticated_session(&server.url()).await;
    repair_greader_remote_state(&db, &account, &session)
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
async fn repair_greader_remote_state_keeps_article_marked_read_during_pull_state() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let db = std::sync::Arc::new(test_db());
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    let remote_entry_id = "tag:google.com,2005:reader/item/0000000000000002".to_string();
    let article_id = generate_entry_id(
        account.id.as_ref(),
        Some(&remote_entry_id),
        &feed.url,
        Some("https://example.com/2"),
        Some("Read During Pull"),
    );
    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let article = Article {
            id: article_id.clone(),
            feed_id: feed.id.clone(),
            remote_id: Some(remote_entry_id.clone()),
            title: "Read During Pull".to_string(),
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
        };
        article_repo.upsert(&[article]).unwrap();
    }

    // Remote still reports the article as unread. While the read-ids
    // stream response is being produced (mid pull_state), the user marks
    // the article read locally, queueing a pending mutation.
    let mark_read_db = std::sync::Arc::clone(&db);
    let mark_read_account_id = account.id.clone();
    let mark_read_article_id = article_id.clone();
    let mark_read_remote_entry_id = remote_entry_id.clone();
    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/read".into()),
        ]))
        .with_status(200)
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
            br#"{ "itemRefs": [] }"#.to_vec()
        })
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/starred".into()),
        ]))
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
        .with_status(200)
        .with_body(format!(
            r#"{{ "unreadcounts": [{{ "id": "{FEED_REMOTE_ID}", "count": 0 }}] }}"#
        ))
        .create_async()
        .await;

    let _credentials = configure_dev_credentials(&account.id).await;

    let session = authenticated_session(&server.url()).await;
    repair_greader_remote_state(&db, &account, &session)
        .await
        .unwrap();

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap();
    assert_eq!(articles.len(), 1);
    assert!(
        articles[0].is_read,
        "a read marked during pull_state should stay read after apply_remote_state"
    );
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
    let sibling_feed = test_local_feed(&account.id, &format!("{}/sibling.xml", server.url()));
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
    let mut sibling_article = Article {
        id: ArticleId("local-muted-sibling-article".to_string()),
        feed_id: sibling_feed.id.clone(),
        remote_id: Some("local-guid-muted-sibling".to_string()),
        title: "Kindle Unlimited sibling local".to_string(),
        content_raw: "old".to_string(),
        content_sanitized: "old".to_string(),
        sanitizer_version: sanitizer::SANITIZER_VERSION,
        summary: None,
        url: Some("https://example.com/sibling-muted".to_string()),
        author: None,
        published_at: chrono::Utc::now(),
        thumbnail: None,
        is_read: false,
        is_starred: false,
        fetched_at: chrono::Utc::now(),
    };
    sibling_article.id = generate_entry_id(
        account.id.as_ref(),
        sibling_article.remote_id.as_deref(),
        &sibling_feed.url,
        sibling_article.url.as_deref(),
        Some(&sibling_article.title),
    );
    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        feed_repo.save(&sibling_feed).unwrap();
        article_repo
            .upsert(&[existing_article.clone(), sibling_article.clone()])
            .unwrap();
        feed_repo.update_unread_count(&feed.id, 99).unwrap();
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
    let sibling_article_is_read: bool = db_guard
        .reader()
        .query_row(
            "SELECT is_read FROM articles WHERE id = ?1",
            rusqlite::params![sibling_article.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    let sibling_unread_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT unread_count FROM feeds WHERE id = ?1",
            rusqlite::params![sibling_feed.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();

    assert!(article_is_read);
    assert_eq!(unread_count, 0);
    assert!(!sibling_article_is_read);
    assert_eq!(sibling_unread_count, 77);
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
