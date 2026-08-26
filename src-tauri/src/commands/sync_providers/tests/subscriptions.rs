//! GReader subscription/folder reconciliation and feed-routing tests.

use super::*;

#[test]
fn delete_missing_greader_subscriptions_removes_only_remote_managed_feeds() {
    let db = test_db();
    let (account, feeds) = insert_account_and_feeds(
        &db,
        "https://rss.example.com",
        &[
            (
                "feed/https://example.com/present.xml",
                "Present",
                "https://example.com/present.xml",
                "https://example.com",
            ),
            (
                "feed/https://example.com/stale.xml",
                "Stale",
                "https://example.com/stale.xml",
                "https://example.com",
            ),
        ],
    );
    let local_feed = Feed {
        id: FeedId("feed-local".to_string()),
        account_id: account.id.clone(),
        folder_id: None,
        remote_id: None,
        title: "Local".to_string(),
        url: "https://example.com/local.xml".to_string(),
        site_url: "https://example.com".to_string(),
        icon: None,
        icon_url: None,
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    };
    {
        let db_guard = db.lock().unwrap();
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        feed_repo.save(&local_feed).unwrap();
    }
    let remote_ids = HashSet::from(["feed/https://example.com/present.xml".to_string()]);

    let deleted_count = delete_missing_greader_subscriptions(&db, &account, &remote_ids).unwrap();

    assert_eq!(deleted_count, 1);
    let db_guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    assert!(feed_repo.find_by_id(&feeds[0].id).unwrap().is_some());
    assert!(feed_repo.find_by_id(&feeds[1].id).unwrap().is_none());
    assert!(feed_repo.find_by_id(&local_feed.id).unwrap().is_some());
}

#[test]
fn delete_missing_greader_folders_removes_stale_remote_folder_and_detaches_feeds() {
    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, "https://rss.example.com");
    let stale_folder = Folder {
        id: FolderId::new(),
        account_id: account.id.clone(),
        remote_id: Some("user/-/label/Stale".to_string()),
        name: "Stale".to_string(),
        sort_order: 0,
    };
    let local_only_folder = Folder {
        id: FolderId::new(),
        account_id: account.id.clone(),
        remote_id: None,
        name: "Local Only".to_string(),
        sort_order: 1,
    };
    {
        let db_guard = db.lock().unwrap();
        let folder_repo = SqliteFolderRepository::new(db_guard.writer());
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        folder_repo.save(&stale_folder).unwrap();
        folder_repo.save(&local_only_folder).unwrap();
        feed_repo
            .update_folder(&feed.id, Some(&stale_folder.id))
            .unwrap();
    }

    let deleted_count = delete_missing_greader_folders(&db, &account, &HashSet::new()).unwrap();

    assert_eq!(deleted_count, 1);
    let db_guard = db.lock().unwrap();
    let folder_repo = SqliteFolderRepository::new(db_guard.reader());
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    assert!(folder_repo
        .find_by_remote_id(&account.id, "user/-/label/Stale")
        .unwrap()
        .is_none());
    assert!(folder_repo
        .find_by_account(&account.id)
        .unwrap()
        .iter()
        .any(|folder| folder.id == local_only_folder.id));
    assert_eq!(
        feed_repo.find_by_id(&feed.id).unwrap().unwrap().folder_id,
        None
    );
}

#[test]
fn greader_folder_lifecycle_keeps_same_name_local_folder_when_remote_folder_appears_and_disappears()
{
    let db = test_db();
    let (account, _) = insert_account_and_feed(&db, "https://rss.example.com");
    let local_folder = Folder {
        id: FolderId::new(),
        account_id: account.id.clone(),
        remote_id: None,
        name: "Tech".to_string(),
        sort_order: 0,
    };
    {
        let db_guard = db.lock().unwrap();
        SqliteFolderRepository::new(db_guard.writer())
            .save(&local_folder)
            .unwrap();
    }

    let remote_folder = RemoteFolder {
        remote_id: "user/-/label/Tech".to_string(),
        name: "Tech".to_string(),
        sort_order: None,
    };
    let remote_folder_ids =
        save_greader_folders_snapshot(&db, &account, std::slice::from_ref(&remote_folder)).unwrap();

    {
        let db_guard = db.lock().unwrap();
        let folders = SqliteFolderRepository::new(db_guard.reader())
            .find_by_account(&account.id)
            .unwrap();
        assert_eq!(folders.len(), 2);
        assert!(folders
            .iter()
            .any(|folder| folder.id == local_folder.id && folder.remote_id.is_none()));
        assert!(folders.iter().any(|folder| {
            folder.remote_id.as_deref() == Some(remote_folder.remote_id.as_str())
        }));
    }

    assert_eq!(
        delete_missing_greader_folders(&db, &account, &HashSet::new()).unwrap(),
        1
    );
    let db_guard = db.lock().unwrap();
    let folders = SqliteFolderRepository::new(db_guard.reader())
        .find_by_account(&account.id)
        .unwrap();
    assert_eq!(folders.len(), 1);
    assert_eq!(folders[0].id, local_folder.id);
    assert!(folders[0].remote_id.is_none());
    assert!(remote_folder_ids.contains(&remote_folder.remote_id));
}

#[test]
fn delete_missing_greader_folders_rolls_back_all_detaches_when_batch_transaction_fails() {
    let db = test_db();
    let (account, feed_a) = insert_account_and_feed(&db, "https://rss.example.com");
    let feed_b = make_test_feed(
        &account.id,
        "feed/https://example.com/second.xml",
        "Second Feed",
        "https://example.com/second.xml",
        "https://example.com",
    );
    let stale_folder_a = Folder {
        id: FolderId("stale-folder-a".to_string()),
        account_id: account.id.clone(),
        remote_id: Some("user/-/label/Stale A".to_string()),
        name: "Stale A".to_string(),
        sort_order: 0,
    };
    let stale_folder_b = Folder {
        id: FolderId("stale-folder-b".to_string()),
        account_id: account.id.clone(),
        remote_id: Some("user/-/label/Stale B".to_string()),
        name: "Stale B".to_string(),
        sort_order: 1,
    };
    let keep_folder = Folder {
        id: FolderId("keep-folder".to_string()),
        account_id: account.id.clone(),
        remote_id: Some("user/-/label/Keep".to_string()),
        name: "Keep".to_string(),
        sort_order: 2,
    };
    {
        let db_guard = db.lock().unwrap();
        let folder_repo = SqliteFolderRepository::new(db_guard.writer());
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        feed_repo.save(&feed_b).unwrap();
        folder_repo.save(&stale_folder_a).unwrap();
        folder_repo.save(&stale_folder_b).unwrap();
        folder_repo.save(&keep_folder).unwrap();
        feed_repo
            .update_folder(&feed_a.id, Some(&stale_folder_a.id))
            .unwrap();
        feed_repo
            .update_folder(&feed_b.id, Some(&stale_folder_b.id))
            .unwrap();
        db_guard
            .writer()
            .execute_batch(
                "CREATE TRIGGER fail_folder_keep_renumber
                     BEFORE UPDATE OF sort_order ON folders
                     WHEN OLD.id = 'keep-folder'
                     BEGIN
                       SELECT RAISE(ABORT, 'renumber failed');
                     END;",
            )
            .unwrap();
    }

    let error = delete_missing_greader_folders(
        &db,
        &account,
        &HashSet::from([keep_folder.remote_id.clone().unwrap()]),
    )
    .expect_err("batch folder cleanup should roll back on renumber failure");

    assert!(error.to_string().contains("renumber failed"));
    let db_guard = db.lock().unwrap();
    let folder_repo = SqliteFolderRepository::new(db_guard.reader());
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    for (folder, feed) in [(&stale_folder_a, &feed_a), (&stale_folder_b, &feed_b)] {
        assert!(folder_repo
            .find_by_remote_id(&account.id, folder.remote_id.as_deref().unwrap())
            .unwrap()
            .is_some());
        assert_eq!(
            feed_repo.find_by_id(&feed.id).unwrap().unwrap().folder_id,
            Some(folder.id.clone())
        );
    }
}

#[test]
fn delete_missing_greader_folders_isolated_by_account_and_provider_kind() {
    let db = test_db();
    let (account, _) = insert_account_and_feed(&db, "https://rss.example.com");
    let other_account = test_account("https://other.example.com");
    let local_account = test_local_account();
    let stale_remote_id = "user/-/label/Stale";
    {
        let db_guard = db.lock().unwrap();
        let account_repo = SqliteAccountRepository::new(db_guard.writer());
        let folder_repo = SqliteFolderRepository::new(db_guard.writer());
        account_repo.save(&other_account).unwrap();
        account_repo.save(&local_account).unwrap();
        for account_id in [&account.id, &other_account.id, &local_account.id] {
            folder_repo
                .save(&Folder {
                    id: FolderId::new(),
                    account_id: account_id.clone(),
                    remote_id: Some(stale_remote_id.to_string()),
                    name: "Stale".to_string(),
                    sort_order: 0,
                })
                .unwrap();
        }
    }

    let deleted_count = delete_missing_greader_folders(&db, &account, &HashSet::new()).unwrap();

    assert_eq!(deleted_count, 1);
    let db_guard = db.lock().unwrap();
    let folder_repo = SqliteFolderRepository::new(db_guard.reader());
    assert!(folder_repo
        .find_by_remote_id(&account.id, stale_remote_id)
        .unwrap()
        .is_none());
    assert!(folder_repo
        .find_by_remote_id(&other_account.id, stale_remote_id)
        .unwrap()
        .is_some());
    assert!(folder_repo
        .find_by_remote_id(&local_account.id, stale_remote_id)
        .unwrap()
        .is_some());
}

#[test]
fn deleted_greader_folders_warning_reports_cleanup_count_and_recovery_message() {
    let warning = deleted_greader_folders_warning(2);

    assert_eq!(warning.kind, AccountSyncWarningKind::Generic);
    assert_eq!(
            warning.message,
            "FreshRSS removed 2 folder(s) that no longer exist remotely; their feeds were moved to Uncategorized."
        );
    assert_eq!(
        warning.detail,
        AccountSyncWarningDetail::DeletedGreaderFolders { count: 2 }
    );
}

#[tokio::test]
async fn sync_greader_account_keeps_stale_folder_when_folder_snapshot_fails() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_provider_response(ProviderHttpResponseFixture::auth_token())
        .create_async()
        .await;
    let folder_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/tag/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::status(500))
        .create_async()
        .await;

    let db = test_db();
    let account = test_account(&server.url());
    let stale_folder = Folder {
        id: FolderId::new(),
        account_id: account.id.clone(),
        remote_id: Some("user/-/label/Stale".to_string()),
        name: "Stale".to_string(),
        sort_order: 0,
    };
    {
        let db_guard = db.lock().unwrap();
        SqliteAccountRepository::new(db_guard.writer())
            .save(&account)
            .unwrap();
        SqliteFolderRepository::new(db_guard.writer())
            .save(&stale_folder)
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account.id).await;

    let session = authenticated_session(&server.url()).await;
    let error = sync_greader_account(&db, &account, &session)
        .await
        .expect_err("folder snapshot failure should fail sync before cleanup");

    folder_mock.assert_async().await;
    assert!(error.to_string().contains("500"));
    let db_guard = db.lock().unwrap();
    assert!(SqliteFolderRepository::new(db_guard.reader())
        .find_by_remote_id(&account.id, "user/-/label/Stale")
        .unwrap()
        .is_some());
}

#[tokio::test]
async fn sync_greader_account_keeps_stale_folder_when_folder_snapshot_is_malformed() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_provider_response(ProviderHttpResponseFixture::auth_token())
        .create_async()
        .await;
    let folder_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/tag/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::json(
            r#"{ "tags": [{ "id": "user/-/label/Bad%ZZ" }] }"#,
        ))
        .create_async()
        .await;

    let db = test_db();
    let account = test_account(&server.url());
    let stale_folder = Folder {
        id: FolderId::new(),
        account_id: account.id.clone(),
        remote_id: Some("user/-/label/Stale".to_string()),
        name: "Stale".to_string(),
        sort_order: 0,
    };
    {
        let db_guard = db.lock().unwrap();
        SqliteAccountRepository::new(db_guard.writer())
            .save(&account)
            .unwrap();
        SqliteFolderRepository::new(db_guard.writer())
            .save(&stale_folder)
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account.id).await;

    let session = authenticated_session(&server.url()).await;
    let error = sync_greader_account(&db, &account, &session)
        .await
        .expect_err("malformed folder snapshot should fail before cleanup");

    folder_mock.assert_async().await;
    assert!(error.to_string().contains("invalid label"));
    let db_guard = db.lock().unwrap();
    assert!(SqliteFolderRepository::new(db_guard.reader())
        .find_by_remote_id(&account.id, "user/-/label/Stale")
        .unwrap()
        .is_some());
}

#[tokio::test]
async fn sync_greader_account_keeps_stale_folder_when_later_subscription_sync_fails() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_provider_response(ProviderHttpResponseFixture::auth_token())
        .create_async()
        .await;
    let folder_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/tag/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::json(r#"{ "tags": [] }"#))
        .create_async()
        .await;
    let subscription_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::status(500))
        .create_async()
        .await;

    let db = test_db();
    let account = test_account(&server.url());
    let stale_folder = Folder {
        id: FolderId::new(),
        account_id: account.id.clone(),
        remote_id: Some("user/-/label/Stale".to_string()),
        name: "Stale".to_string(),
        sort_order: 0,
    };
    {
        let db_guard = db.lock().unwrap();
        SqliteAccountRepository::new(db_guard.writer())
            .save(&account)
            .unwrap();
        SqliteFolderRepository::new(db_guard.writer())
            .save(&stale_folder)
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account.id).await;

    let session = authenticated_session(&server.url()).await;
    let error = sync_greader_account(&db, &account, &session)
        .await
        .expect_err("later subscription failure should leave stale folder untouched");

    folder_mock.assert_async().await;
    subscription_mock.assert_async().await;
    assert!(error.to_string().contains("500"));
    let db_guard = db.lock().unwrap();
    assert!(SqliteFolderRepository::new(db_guard.reader())
        .find_by_remote_id(&account.id, "user/-/label/Stale")
        .unwrap()
        .is_some());
}

#[test]
fn save_greader_subscriptions_does_not_recreate_feed_deleted_after_sync_started() {
    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, "https://rss.example.com");
    let sync_started_remote_feed_ids =
        HashSet::from([feed.remote_id.clone().expect("test feed has remote id")]);
    {
        let db_guard = db.lock().unwrap();
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        feed_repo
            .delete(&feed.id)
            .expect("test feed delete should succeed");
    }

    save_greader_subscriptions(
        &db,
        &account,
        &HashMap::new(),
        &[RemoteSubscription {
            remote_id: FEED_REMOTE_ID.to_string(),
            title: "Example Feed".to_string(),
            url: "https://example.com/rss".to_string(),
            site_url: "https://example.com".to_string(),
            folder_remote_id: None,
            icon_url: None,
        }],
        &sync_started_remote_feed_ids,
    )
    .expect("stale subscription persist should skip deleted feed without failing");

    let db_guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    assert!(
        feed_repo.find_by_id(&feed.id).unwrap().is_none(),
        "in-flight subscription sync must not recreate a feed deleted after sync started"
    );
    assert!(
        feed_repo
            .find_by_remote_id(&account.id, FEED_REMOTE_ID)
            .unwrap()
            .is_none(),
        "deleted remote feed must stay absent after stale subscription persist"
    );
}

#[test]
fn save_greader_subscriptions_persists_new_remote_subscription_not_seen_at_sync_start() {
    let db = test_db();
    let account = test_account("https://rss.example.com");
    {
        let db_guard = db.lock().unwrap();
        let account_repo = SqliteAccountRepository::new(db_guard.writer());
        account_repo.save(&account).unwrap();
    }

    save_greader_subscriptions(
        &db,
        &account,
        &HashMap::new(),
        &[RemoteSubscription {
            remote_id: FEED_REMOTE_ID.to_string(),
            title: "Example Feed".to_string(),
            url: "https://example.com/rss".to_string(),
            site_url: "https://example.com".to_string(),
            folder_remote_id: None,
            icon_url: None,
        }],
        &HashSet::new(),
    )
    .expect("new subscription persist should succeed");

    let db_guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    assert!(
        feed_repo
            .find_by_remote_id(&account.id, FEED_REMOTE_ID)
            .unwrap()
            .is_some(),
        "remote subscriptions not present at sync start are regular additions"
    );
}

#[test]
fn save_greader_subscriptions_preserves_existing_icon_when_remote_icon_is_missing() {
    let db = test_db();
    let (account, mut feed) = insert_account_and_feed(&db, "https://rss.example.com");
    feed.icon_url = Some("https://example.com/old-icon.png".to_string());
    feed.reader_mode = "on".to_string();
    feed.web_preview_mode = "off".to_string();
    {
        let db_guard = db.lock().unwrap();
        SqliteFeedRepository::new(db_guard.writer())
            .save(&feed)
            .expect("existing feed with icon should be saved");
    }

    save_greader_subscriptions(
        &db,
        &account,
        &HashMap::new(),
        &[RemoteSubscription {
            remote_id: FEED_REMOTE_ID.to_string(),
            title: "Example Feed".to_string(),
            url: "https://example.com/rss".to_string(),
            site_url: "https://example.com".to_string(),
            folder_remote_id: None,
            icon_url: Some("https://example.com/new-icon.png".to_string()),
        }],
        &HashSet::new(),
    )
    .expect("provider icon should be persisted");

    save_greader_subscriptions(
        &db,
        &account,
        &HashMap::new(),
        &[RemoteSubscription {
            remote_id: FEED_REMOTE_ID.to_string(),
            title: "Example Feed".to_string(),
            url: "https://example.com/rss".to_string(),
            site_url: "https://example.com".to_string(),
            folder_remote_id: None,
            icon_url: None,
        }],
        &HashSet::new(),
    )
    .expect("missing provider icon should not fail subscription sync");

    let db_guard = db.lock().unwrap();
    let saved = SqliteFeedRepository::new(db_guard.reader())
        .find_by_remote_id(&account.id, FEED_REMOTE_ID)
        .expect("saved feed lookup should succeed")
        .expect("existing feed should remain present");
    assert_eq!(
        saved.icon_url.as_deref(),
        Some("https://example.com/new-icon.png")
    );
    assert_eq!(saved.reader_mode, "on");
    assert_eq!(saved.web_preview_mode, "off");
}

#[test]
fn save_greader_subscriptions_preserves_local_feed_icon_when_url_conflicts() {
    let db = test_db();
    let account = test_account("https://rss.example.com");
    let mut feed = test_local_feed(&account.id, "https://example.com/rss");
    feed.icon = Some(vec![1, 2, 3]);
    feed.icon_url = Some("https://example.com/old-icon.png".to_string());
    feed.reader_mode = "on".to_string();
    feed.web_preview_mode = "off".to_string();
    {
        let db_guard = db.lock().unwrap();
        SqliteAccountRepository::new(db_guard.writer())
            .save(&account)
            .expect("test account should be saved");
        SqliteFeedRepository::new(db_guard.writer())
            .save(&feed)
            .expect("existing local feed should be saved");
    }

    save_greader_subscriptions(
        &db,
        &account,
        &HashMap::new(),
        &[RemoteSubscription {
            remote_id: FEED_REMOTE_ID.to_string(),
            title: "Example Feed".to_string(),
            url: feed.url.clone(),
            site_url: "https://example.com".to_string(),
            folder_remote_id: None,
            icon_url: None,
        }],
        &HashSet::new(),
    )
    .expect("URL-conflicting subscription should be saved");

    let db_guard = db.lock().unwrap();
    let saved = SqliteFeedRepository::new(db_guard.reader())
        .find_by_remote_id(&account.id, FEED_REMOTE_ID)
        .expect("saved feed lookup should succeed")
        .expect("URL-conflicting feed should remain present");
    assert_eq!(saved.id, feed.id);
    assert_eq!(saved.icon.as_deref(), Some(&[1, 2, 3][..]));
    assert_eq!(
        saved.icon_url.as_deref(),
        Some("https://example.com/old-icon.png")
    );
    assert_eq!(saved.reader_mode, "on");
    assert_eq!(saved.web_preview_mode, "off");
}

#[test]
fn save_greader_subscriptions_batch_reconciles_multiple_feeds_in_one_call() {
    // Regression test for the subscriptions.rs N+1 fix: a single
    // save_greader_subscriptions call carrying several remote
    // subscriptions must correctly update an existing feed matched by
    // remote_id, reconcile a local feed matched only by url (remote_id
    // conflict), and insert a brand-new feed, all in one batch.
    let db = test_db();
    let (account, existing_by_remote_id) = insert_account_and_feed(&db, "https://rss.example.com");
    let url_conflict_feed = test_local_feed(&account.id, "https://example.com/url-conflict");
    {
        let db_guard = db.lock().unwrap();
        SqliteFeedRepository::new(db_guard.writer())
            .save(&url_conflict_feed)
            .expect("local url-conflict feed should be saved");
    }

    const NEW_REMOTE_ID: &str = "feed/https://example.com/new";
    const URL_CONFLICT_REMOTE_ID: &str = "feed/https://example.com/url-conflict";

    save_greader_subscriptions(
        &db,
        &account,
        &HashMap::new(),
        &[
            RemoteSubscription {
                remote_id: FEED_REMOTE_ID.to_string(),
                title: "Updated Title".to_string(),
                url: "https://example.com/rss".to_string(),
                site_url: "https://example.com".to_string(),
                folder_remote_id: None,
                icon_url: None,
            },
            RemoteSubscription {
                remote_id: URL_CONFLICT_REMOTE_ID.to_string(),
                title: "URL Conflict Feed".to_string(),
                url: url_conflict_feed.url.clone(),
                site_url: "https://example.com".to_string(),
                folder_remote_id: None,
                icon_url: None,
            },
            RemoteSubscription {
                remote_id: NEW_REMOTE_ID.to_string(),
                title: "Brand New Feed".to_string(),
                url: "https://example.com/new".to_string(),
                site_url: "https://example.com".to_string(),
                folder_remote_id: None,
                icon_url: None,
            },
        ],
        &HashSet::new(),
    )
    .expect("batch of remote subscriptions should persist in one call");

    let db_guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());

    let updated = feed_repo
        .find_by_remote_id(&account.id, FEED_REMOTE_ID)
        .expect("lookup should succeed")
        .expect("feed matched by remote_id should still exist");
    assert_eq!(updated.id, existing_by_remote_id.id);
    assert_eq!(updated.title, "Updated Title");

    let url_conflict_saved = feed_repo
        .find_by_remote_id(&account.id, URL_CONFLICT_REMOTE_ID)
        .expect("lookup should succeed")
        .expect("feed matched by url should adopt the remote_id");
    assert_eq!(url_conflict_saved.id, url_conflict_feed.id);
    assert_eq!(url_conflict_saved.title, "URL Conflict Feed");

    let new_feed = feed_repo
        .find_by_remote_id(&account.id, NEW_REMOTE_ID)
        .expect("lookup should succeed")
        .expect("brand-new remote subscription should be inserted");
    assert_eq!(new_feed.title, "Brand New Feed");

    assert_eq!(
        feed_repo
            .find_by_account(&account.id)
            .expect("find_by_account should succeed")
            .len(),
        3,
        "batch should result in exactly the three reconciled feeds"
    );
}

#[test]
fn resolve_greader_subscription_folder_id_preserves_existing_folder_when_remote_folder_is_missing()
{
    let account_id = AccountId::new();
    let existing_folder_id = FolderId::new();
    let existing_feed = Feed {
        id: FeedId::new(),
        account_id,
        folder_id: Some(existing_folder_id.clone()),
        remote_id: Some("feed/https://example.com/rss".to_string()),
        title: "Feed".to_string(),
        url: "https://example.com/rss".to_string(),
        site_url: "https://example.com".to_string(),
        icon: None,
        icon_url: None,
        unread_count: 0,
        reader_mode: "on".to_string(),
        web_preview_mode: "off".to_string(),
    };
    let folder_remote_id_map = HashMap::new();

    let resolved = resolve_greader_subscription_folder_id(
        Some("user/-/label/Deleted Remote Folder"),
        &folder_remote_id_map,
        Some(&existing_feed),
    );

    assert_eq!(resolved, Some(existing_folder_id));
}

#[test]
fn resolve_greader_subscription_folder_id_uses_remote_folder_when_present() {
    let remote_folder_id = FolderId::new();
    let folder_remote_id_map = HashMap::from([(
        "user/-/label/Remote Folder".to_string(),
        remote_folder_id.clone(),
    )]);

    let resolved = resolve_greader_subscription_folder_id(
        Some("user/-/label/Remote Folder"),
        &folder_remote_id_map,
        None,
    );

    assert_eq!(resolved, Some(remote_folder_id));
}

#[test]
fn resolve_greader_folder_sort_order_preserves_existing_order_when_remote_order_is_missing() {
    let account_id = AccountId::new();
    let folder = Folder {
        id: FolderId::new(),
        account_id,
        remote_id: Some("user/-/label/Tech".to_string()),
        name: "Tech".to_string(),
        sort_order: 7,
    };
    let mut next_sort_order = 12;

    let sort_order = resolve_greader_folder_sort_order(None, Some(&folder), &mut next_sort_order);

    assert_eq!(sort_order, 7);
    assert_eq!(next_sort_order, 12);
}

#[test]
fn resolve_greader_folder_sort_order_assigns_new_missing_remote_order_to_tail() {
    let mut next_sort_order = 12;

    let sort_order = resolve_greader_folder_sort_order(None, None, &mut next_sort_order);

    assert_eq!(sort_order, 12);
    assert_eq!(next_sort_order, 13);
}

#[test]
fn resolve_greader_folder_sort_order_prefers_remote_order_when_present() {
    let account_id = AccountId::new();
    let folder = Folder {
        id: FolderId::new(),
        account_id,
        remote_id: Some("user/-/label/Tech".to_string()),
        name: "Tech".to_string(),
        sort_order: 7,
    };
    let mut next_sort_order = 12;

    let sort_order =
        resolve_greader_folder_sort_order(Some(3), Some(&folder), &mut next_sort_order);

    assert_eq!(sort_order, 3);
    assert_eq!(next_sort_order, 12);
}

#[test]
fn greader_feed_routing_distinguishes_provider_managed_and_local_like_ids() {
    assert!(is_provider_managed_greader_feed(Some("feed/1")));
    assert!(is_provider_managed_greader_feed(Some(
        "feed/http://example.com/rss"
    )));

    assert!(!is_provider_managed_greader_feed(Some(
        "https://example.com/feed.xml"
    )));
    assert!(!is_provider_managed_greader_feed(Some(
        "tag:google.com,2005:reader/item/123"
    )));
    assert!(!is_provider_managed_greader_feed(None));
}
