use super::fixtures::*;
use super::*;

#[test]
fn add_freshrss_feed_preflight_rejects_duplicate_before_remote_create() {
    let db = test_db();
    let account_id = insert_test_account_with_kind(&db, "FreshRSS", "FreshRss");
    insert_test_feed(&db, &account_id);

    let error =
        validate_add_freshrss_feed_preflight_in_db(&db, &account_id, "http://example.com/rss")
            .expect_err("duplicate FreshRSS feed should be rejected before remote create");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed URL is already subscribed"
    ));
}

#[test]
fn add_freshrss_feed_rejects_returned_remote_id_duplicate_before_local_save() {
    let db = test_db();
    let account_id = insert_test_account_with_kind(&db, "FreshRSS", "FreshRss");
    insert_remote_test_feed(&db, &account_id, "feed/remote-existing");

    let error = validate_add_freshrss_subscription_unique_in_db(
        &db,
        &account_id,
        "http://example.com/new-rss",
        "feed/remote-existing",
    )
    .expect_err("duplicate returned FreshRSS remote id should be rejected before local save");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed URL is already subscribed"
    ));

    let feed_count: i64 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM feeds", [], |row| row.get(0))
        .unwrap();
    assert_eq!(feed_count, 1);
}

#[tokio::test]
async fn add_freshrss_feed_keeps_local_feed_when_initial_sync_fails() {
    let mut server = mockito::Server::new_async().await;
    let auth_mock = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .expect(1)
        .create_async()
        .await;
    server
        .mock(
            "POST",
            "/api/greader.php/reader/api/0/subscription/quickadd",
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                 "streamId": "feed/https://example.com/rss",
                 "query": "Example Feed"
             }"#,
        )
        .create_async()
        .await;
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/subscription/list?output=json",
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                 "subscriptions": [
                     {
                         "id": "feed/https://example.com/rss",
                         "title": "Example Feed",
                         "url": "https://example.com/rss",
                         "htmlUrl": "https://example.com",
                         "iconUrl": "https://example.com/icon.png"
                     }
                 ]
             }"#,
        )
        .create_async()
        .await;
    server
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
        .with_status(500)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_freshrss_account(&guard, &server.url())
    };
    let _credentials = configure_dev_credentials(&account_id).await;

    let added_feed = add_local_feed_with_db(
        &db,
        account_id.0.clone(),
        "https://example.com/rss".to_string(),
    )
    .await
    .expect("initial article sync failure should not roll back a remote-created subscription");

    assert_eq!(
        added_feed.remote_id.as_deref(),
        Some("feed/https://example.com/rss")
    );
    assert_eq!(
        added_feed.icon_url.as_deref(),
        Some("https://example.com/icon.png")
    );
    auth_mock.assert_async().await;
    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    let persisted_feed = feed_repo
        .find_by_remote_id(&account_id, "feed/https://example.com/rss")
        .unwrap();
    assert!(persisted_feed.is_some());
}

#[test]
fn add_local_feed_preflight_accepts_local_accounts() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");

    validate_add_local_feed_account_in_db(&db, &account_id).unwrap();
}

#[test]
fn add_local_feed_preflight_rejects_missing_accounts() {
    let db = test_db();
    let error = validate_add_local_feed_account_in_db(&db, &AccountId("missing".to_string()))
        .expect_err("missing account should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Account not found"
    ));
}

#[test]
fn add_local_feed_preflight_accepts_freshrss_accounts() {
    let db = test_db();
    let account_id = insert_test_account_with_kind(&db, "FreshRSS", "FreshRss");

    validate_add_local_feed_account_in_db(&db, &account_id).unwrap();
}

#[test]
fn add_local_feed_preflight_rejects_quarantined_accounts() {
    let db = test_db();
    let account_id = insert_test_account_with_kind(&db, "Quarantined", "Quarantined");
    let error = validate_add_local_feed_account_in_db(&db, &account_id)
        .expect_err("quarantined account should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed can only be added to a Local or FreshRSS account"
    ));
}

#[test]
fn add_local_feed_duplicate_url_preflight_rejects_existing_subscription() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    insert_test_feed(&db, &account_id);

    let error =
        validate_add_local_feed_duplicate_url_in_db(&db, &account_id, "http://example.com/rss")
            .expect_err("duplicate URL should be rejected before save");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed URL is already subscribed"
    ));
}

#[tokio::test]
async fn add_local_feed_rejects_missing_account_before_network_request() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let url = format!("http://{}/feed.xml", listener.local_addr().unwrap());
    let (connection_tx, connection_rx) = mpsc::channel();
    let listener_thread = thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_millis(250);
        while Instant::now() < deadline {
            match listener.accept() {
                Ok(_) => {
                    let _ = connection_tx.send(());
                    return;
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(10));
                }
                Err(_) => return,
            }
        }
    });

    let db = Mutex::new(test_db());
    let error = add_local_feed_with_db(&db, "missing".to_string(), url)
        .await
        .expect_err("missing account should be rejected before fetching");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Account not found"
    ));
    listener_thread.join().unwrap();
    assert!(
        connection_rx.try_recv().is_err(),
        "missing account must not trigger an HTTP request"
    );
}

#[tokio::test]
async fn add_local_feed_rejects_account_kind_drift_after_fetch() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}/feed.xml", listener.local_addr().unwrap());
    let (accepted_tx, accepted_rx) = mpsc::channel();
    let (respond_tx, respond_rx) = mpsc::channel();
    let listener_thread = thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        accepted_tx.send(()).unwrap();
        respond_rx.recv().unwrap();
        let response = format!(
             "HTTP/1.1 200 OK\r\nContent-Type: application/rss+xml\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
             SAMPLE_RSS.len(),
             SAMPLE_RSS
         );
        std::io::Write::write_all(&mut stream, response.as_bytes()).unwrap();
    });

    let db = Arc::new(Mutex::new(test_db()));
    let account_id = {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, "Primary")
    };

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let add_db = Arc::clone(&db);
    let add_account_id = account_id.0.clone();
    let add_task = tokio::spawn(async move {
        add_local_feed_with_provider(&add_db, add_account_id, url, &provider).await
    });

    tokio::task::spawn_blocking(move || accepted_rx.recv().unwrap())
        .await
        .unwrap();
    {
        let db_guard = db.lock().unwrap();
        db_guard
            .writer()
            .execute(
                "UPDATE accounts SET kind = 'FreshRss' WHERE id = ?1",
                params![account_id.0.clone()],
            )
            .unwrap();
    }
    respond_tx.send(()).unwrap();

    let error = add_task
        .await
        .unwrap()
        .expect_err("account kind drift should reject add feed");
    listener_thread.join().unwrap();

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed can only be added to a Local account"
    ));

    let saved_feed_count: i64 = {
        let db_guard = db.lock().unwrap();
        db_guard
            .reader()
            .query_row("SELECT COUNT(*) FROM feeds", [], |row| row.get(0))
            .unwrap()
    };
    assert_eq!(saved_feed_count, 0);
}

#[tokio::test]
async fn add_local_feed_returns_unread_count_recalculation_errors() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_body(SAMPLE_RSS)
        .expect(2)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, "Primary")
    };
    {
        let db_guard = db.lock().unwrap();
        db_guard
            .writer()
            .execute("CREATE TABLE recalc_attempts (n INTEGER NOT NULL)", [])
            .unwrap();
        db_guard
            .writer()
            .execute("INSERT INTO recalc_attempts (n) VALUES (0)", [])
            .unwrap();
        db_guard
            .writer()
            .execute(
                "CREATE TRIGGER fail_second_unread_recalc
                  BEFORE UPDATE OF unread_count ON feeds
                  BEGIN
                    UPDATE recalc_attempts SET n = n + 1;
                    SELECT CASE
                      WHEN (SELECT n FROM recalc_attempts) > 1
                      THEN RAISE(FAIL, 'unread recalc failed')
                    END;
                  END",
                [],
            )
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let error = add_local_feed_with_provider(&db, account_id.0, feed_url, &provider)
        .await
        .expect_err("final unread count recalculation failure should be returned");

    mock.assert_async().await;
    assert!(
        matches!(error, AppError::UserVisible { message } if message.contains("unread recalc failed"))
    );
}

#[tokio::test]
async fn add_local_feed_rolls_back_persisted_feed_when_initial_sync_fails() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_body(SAMPLE_RSS)
        .expect(2)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, "Primary")
    };
    {
        let db_guard = db.lock().unwrap();
        db_guard
            .writer()
            .execute(
                "CREATE TRIGGER fail_initial_article_sync
                  BEFORE INSERT ON articles
                  BEGIN
                    SELECT RAISE(FAIL, 'initial sync failed');
                  END",
                [],
            )
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let error =
        add_local_feed_with_provider(&db, account_id.0.clone(), feed_url.clone(), &provider)
            .await
            .expect_err("initial sync failure should reject add feed");

    mock.assert_async().await;
    assert!(matches!(
        error,
        AppError::UserVisible { message } if message.contains("initial sync failed")
    ));

    let saved_feed_count: i64 = {
        let db_guard = db.lock().unwrap();
        db_guard
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM feeds WHERE account_id = ?1 AND url = ?2",
                params![account_id.0, feed_url],
                |row| row.get(0),
            )
            .unwrap()
    };
    assert_eq!(saved_feed_count, 0);
}

#[tokio::test]
async fn add_local_feed_uses_create_fetch_for_metadata_and_pull_fetch_for_articles() {
    let create_feed = r#"<?xml version="1.0" encoding="UTF-8"?>
 <feed xmlns="http://www.w3.org/2005/Atom">
   <title>Create Fetch Title</title>
   <id>https://example.com/create</id>
   <updated>2026-03-27T12:00:00Z</updated>
   <link rel="alternate" href="https://example.com/create" />
   <icon>https://example.com/icon.png</icon>
 </feed>"#;
    let pull_feed = r#"<?xml version="1.0" encoding="UTF-8"?>
 <rss version="2.0">
   <channel>
 <title>Pull Fetch Title</title>
 <link>https://example.com/pull</link>
 <item>
   <title>Pull Fetch Article</title>
   <link>https://example.com/articles/pull</link>
   <guid>pull-guid</guid>
 </item>
   </channel>
 </rss>"#;
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let create_mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", "\"create-etag\"")
        .with_body(create_feed)
        .expect(1)
        .create_async()
        .await;
    let pull_mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", "\"pull-etag\"")
        .with_body(pull_feed)
        .expect(1)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, "Primary")
    };

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let feed = add_local_feed_with_provider(&db, account_id.0.clone(), feed_url.clone(), &provider)
        .await
        .unwrap();

    create_mock.assert_async().await;
    pull_mock.assert_async().await;
    assert_eq!(feed.title, "Create Fetch Title");
    assert_eq!(feed.site_url, "https://example.com/create");
    assert_eq!(
        feed.icon_url.as_deref(),
        Some("https://example.com/icon.png")
    );
    assert_eq!(feed.unread_count, 1);

    let (article_title, article_url, saved_etag): (String, String, String) = {
        let db_guard = db.lock().unwrap();
        let article = db_guard
            .reader()
            .query_row(
                "SELECT a.title, a.url
                  FROM articles a
                  JOIN feeds f ON f.id = a.feed_id
                  WHERE f.account_id = ?1 AND f.url = ?2",
                params![account_id.0.clone(), feed_url.clone()],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .unwrap();
        let etag = db_guard
            .reader()
            .query_row(
                "SELECT etag FROM sync_state WHERE account_id = ?1 AND scope_key = ?2",
                params![account_id.0, format!("local_feed:{feed_url}")],
                |row| row.get::<_, String>(0),
            )
            .unwrap();
        (article.0, article.1, etag)
    };

    assert_eq!(article_title, "Pull Fetch Article");
    assert_eq!(article_url, "https://example.com/articles/pull");
    assert_eq!(saved_etag, "\"pull-etag\"");
}

#[tokio::test]
async fn add_local_feed_rejects_duplicate_url_without_deleting_existing_feed() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_body(SAMPLE_RSS)
        .expect(1)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let db_guard = db.lock().unwrap();
        let account_id = insert_test_account(&db_guard, "Primary");
        db_guard
            .writer()
            .execute(
                "INSERT INTO feeds (id, account_id, title, url) VALUES (?1, ?2, ?3, ?4)",
                params!["existing-feed", account_id.0, "Existing", feed_url],
            )
            .unwrap();
        account_id
    };

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let error =
        add_local_feed_with_provider(&db, account_id.0.clone(), feed_url.clone(), &provider)
            .await
            .expect_err("duplicate URL should reject add feed");

    mock.assert_async().await;
    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed URL is already subscribed"
    ));

    let saved_feed_count: i64 = {
        let db_guard = db.lock().unwrap();
        db_guard
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM feeds WHERE account_id = ?1 AND url = ?2",
                params![account_id.0, feed_url],
                |row| row.get(0),
            )
            .unwrap()
    };
    assert_eq!(saved_feed_count, 1);
}

#[tokio::test]
async fn add_local_feed_duplicate_race_does_not_roll_back_existing_feed() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_body(SAMPLE_RSS)
        .expect(1)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let db_guard = db.lock().unwrap();
        let account_id = insert_test_account(&db_guard, "Primary");
        db_guard
            .writer()
            .execute(
                "CREATE TRIGGER simulate_duplicate_feed_race
                  BEFORE INSERT ON feeds
                  WHEN NEW.url LIKE 'http://127.0.0.1:%/feed.xml'
                  BEGIN
                    INSERT OR IGNORE INTO feeds (id, account_id, title, url)
                    VALUES ('race-existing-feed', NEW.account_id, 'Existing', NEW.url);
                  END",
                [],
            )
            .unwrap();
        db_guard
            .writer()
            .execute(
                "CREATE TRIGGER fail_if_duplicate_race_reaches_initial_sync
                  BEFORE INSERT ON articles
                  BEGIN
                    SELECT RAISE(FAIL, 'duplicate race reached initial sync');
                  END",
                [],
            )
            .unwrap();
        account_id
    };

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let error =
        add_local_feed_with_provider(&db, account_id.0.clone(), feed_url.clone(), &provider)
            .await
            .expect_err("duplicate URL race should reject add feed");

    mock.assert_async().await;
    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed URL is already subscribed"
    ));

    let saved_feed_id: String = {
        let db_guard = db.lock().unwrap();
        db_guard
            .reader()
            .query_row(
                "SELECT id FROM feeds WHERE account_id = ?1 AND url = ?2",
                params![account_id.0, feed_url],
                |row| row.get(0),
            )
            .unwrap()
    };
    assert_eq!(saved_feed_id, "race-existing-feed");
}

#[test]
fn recalculate_feed_unread_count_command_returns_recalculation_errors() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let feed_id = insert_test_feed(&db, &account_id);

    db.writer().execute("DROP TABLE articles", []).unwrap();

    let error = recalculate_feed_unread_count_in_db(&db, &feed_id)
        .expect_err("unread count recalculation failure should be returned");

    assert!(matches!(error, AppError::UserVisible { message } if message.contains("articles")));
}
