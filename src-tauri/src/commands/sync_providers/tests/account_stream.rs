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
async fn sync_greader_account_entries_stops_on_continuation_cycle_after_persisting_entries() {
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
        .match_query(Matcher::Any)
        .match_header("Authorization", "GoogleLogin auth=tok")
        .expect(3)
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body_from_request(|request| {
            let (page, continuation) = if request.path_and_query().contains("&c=A") {
                (2_i64, "B")
            } else if request.path_and_query().contains("&c=B") {
                (3_i64, "A")
            } else {
                (1_i64, "A")
            };
            let timestamp_usec = 1_700_000_000_000_000_i64 + page * 1_000_000;
            let published = 1_700_000_000_i64 + page;
            format!(
                r#"{{"items":[{{"id":"entry-{page}","title":"Page {page}","alternate":[{{"href":"https://example.com/{page}"}}],"summary":{{"content":"Summary {page}"}},"timestampUsec":"{timestamp_usec}","published":{published},"origin":{{"streamId":"{FEED_REMOTE_ID}","title":"Example"}},"categories":[]}}],"continuation":"{continuation}"}}"#
            )
            .into_bytes()
        })
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    let provider = authenticated_provider(&server.url()).await;
    let feeds_by_remote_id = HashMap::from([(FEED_REMOTE_ID.to_string(), feed.clone())]);

    sync_greader_account_entries(&db, &provider, &account, &feeds_by_remote_id)
        .await
        .expect("a continuation cycle should return a partial outcome with failure state");

    stream_mock.assert_async().await;

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

    assert_eq!(articles.len(), 3);
    assert_eq!(state.timestamp_usec, None);
    assert_eq!(state.continuation, None);
    assert!(state.last_error.as_deref().is_some_and(
        |message| message == "GReader entry pagination incomplete (reason=continuation_cycle)"
    ));
    assert_eq!(state.error_count, 1);
    assert_eq!(state.last_success_at, None);
}

#[tokio::test]
async fn sync_greader_account_entries_preserves_saved_timestamp_when_later_page_fails() {
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
