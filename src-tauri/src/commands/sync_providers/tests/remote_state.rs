//! Pending-mutation protection, remote-state application, and cursor/timestamp policy tests.

use super::*;

#[test]
fn pending_mutation_retry_warning_keeps_remote_entry_id_out_of_public_copy() {
    let warning = pending_mutation_retry_warning(PendingMutationType::MarkRead);

    assert_eq!(warning.kind, AccountSyncWarningKind::RetryPending);
    assert_eq!(
        warning.message,
        "Local change 'mark_read' will retry next sync."
    );
    assert!(!warning.message.contains("remote_entry_id"));
    assert!(!warning.message.contains("https://"));
    assert_eq!(
        warning.detail,
        AccountSyncWarningDetail::PendingMutationRetry {
            mutation: "mark_read".to_string()
        }
    );
}

#[test]
fn dropped_pending_mutation_warning_is_user_visible_without_remote_entry_id() {
    let warning = dropped_pending_mutation_warning(PendingMutationType::Star);

    assert_eq!(warning.kind, AccountSyncWarningKind::Generic);
    assert_eq!(
            warning.message,
            "Local change 'star' could not be sent because the feed is no longer managed by FreshRSS. Sync again after refreshing the feed."
        );
    assert!(!warning.message.contains("remote_entry_id"));
    assert!(!warning.message.contains("https://"));
    assert_eq!(
        warning.detail,
        AccountSyncWarningDetail::DroppedPendingMutation {
            mutation: "star".to_string()
        }
    );
}

#[test]
fn sync_log_context_exposes_only_ids_and_redacted_host_class() {
    let account = test_account("https://account-secret.example.test");
    let feed = make_test_feed(
        &account.id,
        "feed/https://remote-secret.example.test/rss",
        "Private Feed Name",
        "https://feed-secret.example.test/private/rss",
        "https://site-secret.example.test",
    );
    let remote_entry_id = "tag:remote-secret.example.test,2005:reader/item/private";
    let log = format!(
        "account_id={} feed_id={} host_class={}",
        account.id.as_ref(),
        feed.id.as_ref(),
        redacted_feed_host_class(&feed.url)
    );

    assert!(log.contains(account.id.as_ref()));
    assert!(log.contains(feed.id.as_ref()));
    assert_eq!(redacted_feed_host_class(&feed.url), "public");
    assert_eq!(
        redacted_feed_host_class("feed/https://remote-secret.example.test/rss"),
        "public"
    );
    assert_eq!(
        redacted_feed_host_class("http://127.0.0.1/rss.xml"),
        "private"
    );
    assert_eq!(redacted_feed_host_class("not-a-url"), "invalid");
    assert!(!log.contains(&account.name));
    assert!(!log.contains(&feed.url));
    assert!(!log.contains(remote_entry_id));
    assert!(!log.contains("https://"));
}

#[test]
fn should_pull_remote_state_ignores_future_success_timestamp() {
    let db = test_db();
    let account = test_account("https://rss.example.com");
    let now = chrono::DateTime::parse_from_rfc3339("2026-05-10T00:00:00Z")
        .unwrap()
        .with_timezone(&chrono::Utc);
    {
        let db_guard = db.lock().unwrap();
        let account_repo = SqliteAccountRepository::new(db_guard.writer());
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        account_repo.save(&account).unwrap();
        sync_state_repo
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: SyncStateScopeKey::greader_remote_state_full().as_string(),
                timestamp_usec: Some((now + chrono::Duration::hours(1)).timestamp_micros()),
                continuation: None,
                etag: None,
                last_modified: None,
                last_success_at: Some((now + chrono::Duration::hours(1)).to_rfc3339()),
                last_error: None,
                error_count: 0,
                next_retry_at: None,
            })
            .unwrap();
    }

    assert!(should_pull_remote_state(&db, &account.id, now).unwrap());
}

#[test]
fn greader_cursor_timestamp_policy_ignores_invalid_saved_and_entry_values() {
    let future = chrono::Utc::now() + chrono::Duration::hours(1);
    let saved_state = SyncState {
        account_id: AccountId("account".to_string()),
        scope_key: feed_scope_key("feed/remote").as_string(),
        timestamp_usec: Some(future.timestamp_micros()),
        continuation: Some("stale-page".to_string()),
        etag: Some("etag".to_string()),
        last_modified: Some("Wed, 01 Jan 2025 00:00:00 GMT".to_string()),
        last_success_at: None,
        last_error: None,
        error_count: 0,
        next_retry_at: None,
    };
    let cursor = cursor_from_state(Some(&saved_state))
        .expect("existing sync state should still build a cursor");

    assert_eq!(cursor.continuation, None);
    assert_eq!(cursor.since, None);
    assert_eq!(sync_state_timestamp_usec(Some(&saved_state)), None);

    let mut latest_timestamp_usec = Some(1_700_000_000_000_000);
    update_latest_timestamp_usec(
        &mut latest_timestamp_usec,
        Some(&SyncCursor {
            continuation: None,
            since: Some(future),
            etag: None,
            last_modified: None,
        }),
    );
    assert_eq!(latest_timestamp_usec, Some(1_700_000_000_000_000));
}

#[test]
fn pending_mutation_target_lookup_returns_db_error_without_deleting_pending_mutation() {
    let db = test_db();
    let account = test_account("https://rss.example.com");
    let pending_mutation_id = {
        let db_guard = db.lock().unwrap();
        let account_repo = SqliteAccountRepository::new(db_guard.writer());
        account_repo.save(&account).unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![
                        account.id.as_ref(),
                        PendingMutationType::MarkRead.as_str(),
                        "entry-1",
                        "2024-01-01T00:00:00Z"
                    ],
                )
                .unwrap();
        let pending_mutation_id = db_guard.writer().last_insert_rowid();
        db_guard
            .writer()
            .execute("DROP TABLE articles", [])
            .unwrap();
        pending_mutation_id
    };

    let _ = pending_mutation_id;
    let result = pending_mutation_ids_targeting_provider_managed_greader_feeds(&db, &account.id);

    assert!(result.is_err());
    let pending_count: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row("SELECT COUNT(*) FROM pending_mutations", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(pending_count, 1);
}

#[test]
fn pending_mutation_target_lookup_treats_missing_target_as_non_greader() {
    let db = test_db();
    let account = test_account("https://rss.example.com");
    let pending_mutation_id = {
        let db_guard = db.lock().unwrap();
        let account_repo = SqliteAccountRepository::new(db_guard.writer());
        account_repo.save(&account).unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![
                        account.id.as_ref(),
                        PendingMutationType::MarkRead.as_str(),
                        "missing-entry",
                        "2024-01-01T00:00:00Z"
                    ],
                )
                .unwrap();
        db_guard.writer().last_insert_rowid()
    };

    let provider_managed_ids =
        pending_mutation_ids_targeting_provider_managed_greader_feeds(&db, &account.id).unwrap();

    assert!(!provider_managed_ids.contains(&pending_mutation_id));
}

#[test]
fn pending_mutation_target_lookup_rejects_remote_entry_id_collision_across_feeds() {
    let db = test_db();
    let (account, feeds) = insert_account_and_feeds(
        &db,
        "https://rss.example.com",
        &[
            (
                "",
                "Local Collision",
                "https://example.com/local.xml",
                "https://example.com/local",
            ),
            (
                "feed/https://example.com/remote.xml",
                "Remote Collision",
                "https://example.com/remote.xml",
                "https://example.com/remote",
            ),
        ],
    );
    let remote_entry_id = "duplicate-entry";
    let pending_mutation_id = {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        article_repo
            .upsert(&[
                Article {
                    id: ArticleId("local-duplicate-entry".to_string()),
                    feed_id: feeds[0].id.clone(),
                    remote_id: Some(remote_entry_id.to_string()),
                    title: "Local Collision".to_string(),
                    content_raw: "body".to_string(),
                    content_sanitized: "body".to_string(),
                    sanitizer_version: sanitizer::SANITIZER_VERSION,
                    summary: None,
                    url: Some("https://example.com/local-entry".to_string()),
                    author: None,
                    published_at: chrono::Utc::now(),
                    thumbnail: None,
                    is_read: false,
                    is_starred: false,
                    fetched_at: chrono::Utc::now(),
                },
                Article {
                    id: ArticleId("remote-duplicate-entry".to_string()),
                    feed_id: feeds[1].id.clone(),
                    remote_id: Some(remote_entry_id.to_string()),
                    title: "Remote Collision".to_string(),
                    content_raw: "body".to_string(),
                    content_sanitized: "body".to_string(),
                    sanitizer_version: sanitizer::SANITIZER_VERSION,
                    summary: None,
                    url: Some("https://example.com/remote-entry".to_string()),
                    author: None,
                    published_at: chrono::Utc::now(),
                    thumbnail: None,
                    is_read: false,
                    is_starred: false,
                    fetched_at: chrono::Utc::now(),
                },
            ])
            .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![
                        account.id.as_ref(),
                        PendingMutationType::MarkRead.as_str(),
                        remote_entry_id,
                        "2024-01-01T00:00:00Z"
                    ],
                )
                .unwrap();
        db_guard.writer().last_insert_rowid()
    };

    let provider_managed_ids =
        pending_mutation_ids_targeting_provider_managed_greader_feeds(&db, &account.id).unwrap();

    assert!(!provider_managed_ids.contains(&pending_mutation_id));
}

#[test]
fn pending_mutation_ids_targeting_provider_managed_greader_feeds_returns_exact_subset() {
    let db = test_db();
    let (account, feeds) = insert_account_and_feeds(
        &db,
        "https://rss.example.com",
        &[
            (
                "feed/https://example.com/provider-a.xml",
                "Provider Feed A",
                "https://example.com/provider-a.xml",
                "https://example.com/provider-a",
            ),
            (
                "feed/https://example.com/provider-b.xml",
                "Provider Feed B",
                "https://example.com/provider-b.xml",
                "https://example.com/provider-b",
            ),
            (
                "",
                "Local Collision",
                "https://example.com/local.xml",
                "https://example.com/local",
            ),
            (
                "feed/https://example.com/remote-collision.xml",
                "Remote Collision",
                "https://example.com/remote-collision.xml",
                "https://example.com/remote-collision",
            ),
        ],
    );

    fn make_article(id: &str, feed_id: &FeedId, remote_id: &str) -> Article {
        Article {
            id: ArticleId(id.to_string()),
            feed_id: feed_id.clone(),
            remote_id: Some(remote_id.to_string()),
            title: id.to_string(),
            content_raw: "body".to_string(),
            content_sanitized: "body".to_string(),
            sanitizer_version: sanitizer::SANITIZER_VERSION,
            summary: None,
            url: Some(format!("https://example.com/{id}")),
            author: None,
            published_at: chrono::Utc::now(),
            thumbnail: None,
            is_read: false,
            is_starred: false,
            fetched_at: chrono::Utc::now(),
        }
    }

    let (
        provider_mutation_id_a,
        provider_mutation_id_b,
        collision_mutation_id,
        no_match_mutation_id,
    ) = {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        article_repo
            .upsert(&[
                make_article("provider-entry-a", &feeds[0].id, "provider-entry-a"),
                make_article("provider-entry-b", &feeds[1].id, "provider-entry-b"),
                make_article("local-collision-entry", &feeds[2].id, "collision-entry"),
                make_article("remote-collision-entry", &feeds[3].id, "collision-entry"),
            ])
            .unwrap();

        let insert_pending = |remote_entry_id: &str| -> i64 {
            db_guard
                    .writer()
                    .execute(
                        "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
                         VALUES (?1, ?2, ?3, ?4)",
                        rusqlite::params![
                            account.id.as_ref(),
                            PendingMutationType::MarkRead.as_str(),
                            remote_entry_id,
                            "2024-01-01T00:00:00Z"
                        ],
                    )
                    .unwrap();
            db_guard.writer().last_insert_rowid()
        };

        (
            insert_pending("provider-entry-a"),
            insert_pending("provider-entry-b"),
            insert_pending("collision-entry"),
            insert_pending("missing-entry"),
        )
    };

    let provider_managed_ids =
        pending_mutation_ids_targeting_provider_managed_greader_feeds(&db, &account.id).unwrap();

    assert!(provider_managed_ids.contains(&provider_mutation_id_a));
    assert!(provider_managed_ids.contains(&provider_mutation_id_b));
    assert!(!provider_managed_ids.contains(&collision_mutation_id));
    assert!(!provider_managed_ids.contains(&no_match_mutation_id));
    assert_eq!(provider_managed_ids.len(), 2);
}

#[test]
fn apply_remote_state_with_protection_reads_pending_mutations_saved_before_the_call() {
    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, "http://localhost");
    let remote_id = "protected-entry".to_string();
    let article_id = ArticleId("protected-article".to_string());

    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        article_repo
            .upsert(&[Article {
                id: article_id.clone(),
                feed_id: feed.id.clone(),
                remote_id: Some(remote_id.clone()),
                title: "Protected".to_string(),
                content_raw: "body".to_string(),
                content_sanitized: "body".to_string(),
                sanitizer_version: sanitizer::SANITIZER_VERSION,
                summary: None,
                url: None,
                author: None,
                published_at: chrono::Utc::now(),
                thumbnail: None,
                is_read: true,
                is_starred: false,
                fetched_at: chrono::Utc::now(),
            }])
            .unwrap();

        // A pending MarkRead mutation, saved directly to the DB (not passed via
        // `extra_protected_read_ids`), must still be picked up: the helper is
        // responsible for re-reading pending mutations from the DB inside its
        // own lock, not relying on a caller-supplied snapshot.
        let pending_repo = SqlitePendingMutationRepository::new(db_guard.writer());
        pending_repo
            .save(&PendingMutation {
                id: None,
                account_id: account.id.clone(),
                mutation_type: PendingMutationType::MarkRead,
                remote_entry_id: remote_id.clone(),
                created_at: chrono::Utc::now().to_rfc3339(),
            })
            .unwrap();
    }

    // Remote reports the entry as unread; without protection this would
    // revert the article to unread.
    apply_remote_state_with_protection(&db, &account.id, &[], &[], &[], &[]).unwrap();

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let article = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap()
        .into_iter()
        .find(|article| article.id == article_id)
        .unwrap();
    assert!(
        article.is_read,
        "pending MarkRead mutation saved before the call should protect the article \
             from being reverted to the remote's stale unread state"
    );
}

#[test]
fn upsert_articles_in_current_transaction_preserves_older_published_at_on_resync() {
    let db = test_db();
    let (_account, feed) = insert_account_and_feed(&db, "http://localhost");
    let db_guard = db.lock().unwrap();
    let conn = db_guard.writer();

    let t1 = chrono::DateTime::parse_from_rfc3339("2026-01-01T00:00:00+00:00")
        .unwrap()
        .with_timezone(&chrono::Utc);
    let t2 = chrono::DateTime::parse_from_rfc3339("2026-06-01T00:00:00+00:00")
        .unwrap()
        .with_timezone(&chrono::Utc);
    let mut article = Article {
        id: ArticleId("preserve-published-at".to_string()),
        feed_id: feed.id.clone(),
        remote_id: Some("entry-preserve-published-at".to_string()),
        title: "Preserve on re-sync".to_string(),
        content_raw: "body".to_string(),
        content_sanitized: "body".to_string(),
        sanitizer_version: sanitizer::SANITIZER_VERSION,
        summary: None,
        url: None,
        author: None,
        published_at: t1,
        thumbnail: None,
        is_read: false,
        is_starred: false,
        fetched_at: t1,
    };
    upsert_articles_in_current_transaction(conn, std::slice::from_ref(&article)).unwrap();

    // Re-sync synthesizes a newer published_at (e.g. now()) for the same id.
    article.published_at = t2;
    upsert_articles_in_current_transaction(conn, std::slice::from_ref(&article)).unwrap();

    let published_at: String = conn
        .query_row(
            "SELECT published_at FROM articles WHERE id = ?1",
            rusqlite::params![article.id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        published_at, "2026-01-01T00:00:00+00:00",
        "existing older published_at should be preserved across re-sync"
    );

    // A later sync delivering an even older real publish date should replace it.
    let t0 = chrono::DateTime::parse_from_rfc3339("2025-12-01T00:00:00+00:00")
        .unwrap()
        .with_timezone(&chrono::Utc);
    article.published_at = t0;
    upsert_articles_in_current_transaction(conn, std::slice::from_ref(&article)).unwrap();

    let published_at: String = conn
        .query_row(
            "SELECT published_at FROM articles WHERE id = ?1",
            rusqlite::params![article.id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        published_at, "2025-12-01T00:00:00+00:00",
        "an older real published_at delivered later should replace the synthesized value"
    );
}
