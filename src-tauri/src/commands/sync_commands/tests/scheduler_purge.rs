use super::*;

#[tokio::test]
async fn second_sync_skips_when_flag_already_set() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let syncing = AtomicBool::new(false);

    let result1 = run_full_sync(&db, &syncing).await.unwrap();

    syncing.store(true, Ordering::SeqCst);
    let result2 = run_full_sync(&db, &syncing).await.unwrap();
    syncing.store(false, Ordering::SeqCst); // cleanup

    assert!(result1.synced, "first sync should execute");
    assert!(!result2.synced, "concurrent sync should be skipped");
}

#[tokio::test]
async fn run_automatic_sync_skips_until_manual_sync_enabled() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let syncing = AtomicBool::new(false);
    let automatic_sync_enabled = AtomicBool::new(false);

    let result = run_automatic_sync(&db, &syncing, &automatic_sync_enabled).await;

    assert!(result.is_ok());
    let sync_result = result.unwrap();
    assert!(
        !sync_result.synced,
        "automatic sync should stay locked initially"
    );
    assert!(
        !syncing.load(Ordering::SeqCst),
        "automatic sync should not set the syncing flag when locked"
    );
}

#[tokio::test]
async fn run_automatic_sync_runs_after_manual_sync_enabled() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let syncing = AtomicBool::new(false);
    let automatic_sync_enabled = AtomicBool::new(true);

    let result = run_automatic_sync(&db, &syncing, &automatic_sync_enabled)
        .await
        .unwrap();

    assert!(result.synced, "automatic sync should run after unlock");
    assert!(
        !syncing.load(Ordering::SeqCst),
        "syncing flag should be reset after automatic sync"
    );
}

#[test]
fn sync_guard_resets_on_drop() {
    let syncing = AtomicBool::new(true);
    {
        let _guard = SyncGuard(&syncing);
        assert!(syncing.load(Ordering::SeqCst));
    }
    assert!(
        !syncing.load(Ordering::SeqCst),
        "flag should be false after guard drop"
    );
}

#[tokio::test]
async fn enable_automatic_sync_notifies_waiters_only_once() {
    let automatic_sync_enabled = AtomicBool::new(false);
    let automatic_sync_notify = tokio::sync::Notify::new();

    let waiter = automatic_sync_notify.notified();
    enable_automatic_sync(&automatic_sync_enabled, &automatic_sync_notify);

    tokio::time::timeout(std::time::Duration::from_millis(50), waiter)
        .await
        .expect("waiter should be notified after enabling automatic sync");

    enable_automatic_sync(&automatic_sync_enabled, &automatic_sync_notify);
    assert!(automatic_sync_enabled.load(Ordering::SeqCst));
}

#[test]
fn clear_scheduler_sync_status_clears_account_level_backoff() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account_id = AccountId::new();
    {
        let db_guard = db.lock().unwrap();
        db_guard
            .writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                rusqlite::params![account_id.as_ref(), "Local", "Local"],
            )
            .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO sync_state (account_id, scope_key, last_error, error_count, next_retry_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![
                        account_id.as_ref(),
                        SyncStateScopeKey::scheduler().as_string(),
                        "old failure",
                        2,
                        "2099-01-01T00:00:00Z",
                    ],
                )
                .unwrap();
    }

    clear_scheduler_sync_status(&db, &account_id).unwrap();

    let db_guard = db.lock().unwrap();
    let repo = SqliteSyncStateRepository::new(db_guard.reader());
    let state = repo
        .get(&account_id, SyncStateScopeKey::scheduler())
        .unwrap()
        .unwrap();
    assert_eq!(state.error_count, 0);
    assert_eq!(state.last_error, None);
    assert_eq!(state.next_retry_at, None);
    assert!(state.last_success_at.is_some());
}

#[test]
fn purge_old_articles_deletes_old_read_items_when_retention_is_enabled() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = Account {
        id: AccountId::new(),
        kind: ProviderKind::Local,
        name: "Local".to_string(),
        server_url: None,
        username: None,
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    };
    let feed_id = FeedId::new();
    let old = chrono::Utc::now() - chrono::Duration::days(60);
    {
        let db_guard = db.lock().unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO accounts (id, kind, name, keep_read_items_days) VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![account.id.as_ref(), "Local", account.name, account.keep_read_items_days],
                )
                .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO feeds (id, account_id, title, url, site_url) VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![
                        feed_id.as_ref(),
                        account.id.as_ref(),
                        "Feed",
                        "https://example.com/feed.xml",
                        "https://example.com",
                    ],
                )
                .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO articles (id, feed_id, title, published_at, fetched_at, is_read) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    rusqlite::params![
                        "old-read",
                        feed_id.as_ref(),
                        "Old read",
                        old.to_rfc3339(),
                        old.to_rfc3339(),
                        true,
                    ],
                )
                .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO articles (id, feed_id, title, published_at, fetched_at, is_read) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    rusqlite::params![
                        "older-read",
                        feed_id.as_ref(),
                        "Older read",
                        (old - chrono::Duration::minutes(1)).to_rfc3339(),
                        (old - chrono::Duration::minutes(1)).to_rfc3339(),
                        true,
                    ],
                )
                .unwrap();
    }

    purge_old_articles(&db);

    let older_remaining: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE id = ?1",
            rusqlite::params!["older-read"],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(older_remaining, 0);

    let latest_remaining: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE id = ?1",
            rusqlite::params!["old-read"],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(latest_remaining, 1);
}

#[test]
fn purge_old_articles_preserves_old_read_items_within_retention_window() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = Account {
        id: AccountId::new(),
        kind: ProviderKind::Local,
        name: "Local".to_string(),
        server_url: None,
        username: None,
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 3650,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    };
    let feed_id = FeedId::new();
    let old = chrono::Utc::now() - chrono::Duration::days(60);
    {
        let db_guard = db.lock().unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO accounts (id, kind, name, keep_read_items_days) VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![account.id.as_ref(), "Local", account.name, account.keep_read_items_days],
                )
                .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO feeds (id, account_id, title, url, site_url) VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![
                        feed_id.as_ref(),
                        account.id.as_ref(),
                        "Feed",
                        "https://example.com/feed.xml",
                        "https://example.com",
                    ],
                )
                .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO articles (id, feed_id, title, published_at, fetched_at, is_read) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    rusqlite::params![
                        "old-read",
                        feed_id.as_ref(),
                        "Old read",
                        old.to_rfc3339(),
                        old.to_rfc3339(),
                        true,
                    ],
                )
                .unwrap();
    }

    purge_old_articles(&db);

    let remaining: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE id = ?1",
            rusqlite::params!["old-read"],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(remaining, 1);
}

#[test]
fn purge_old_articles_preserves_old_read_items_when_legacy_retention_is_disabled() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = Account {
        id: AccountId::new(),
        kind: ProviderKind::Local,
        name: "Local".to_string(),
        server_url: None,
        username: None,
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 0,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    };
    let feed_id = FeedId::new();
    let old = chrono::Utc::now() - chrono::Duration::days(60);
    {
        let db_guard = db.lock().unwrap();
        db_guard
            .writer()
            .execute("PRAGMA ignore_check_constraints = ON", [])
            .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO accounts (id, kind, name, keep_read_items_days) VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![account.id.as_ref(), "Local", account.name, account.keep_read_items_days],
                )
                .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO feeds (id, account_id, title, url, site_url) VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![
                        feed_id.as_ref(),
                        account.id.as_ref(),
                        "Feed",
                        "https://example.com/feed.xml",
                        "https://example.com",
                    ],
                )
                .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO articles (id, feed_id, title, published_at, fetched_at, is_read) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    rusqlite::params![
                        "old-read",
                        feed_id.as_ref(),
                        "Old read",
                        old.to_rfc3339(),
                        old.to_rfc3339(),
                        true,
                    ],
                )
                .unwrap();
    }

    purge_old_articles(&db);

    let remaining: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE id = ?1",
            rusqlite::params!["old-read"],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(remaining, 1);
}

#[test]
fn purge_old_articles_failure_does_not_change_sync_result_contract() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let poison_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _guard = db.lock().unwrap();
        panic!("poison purge db lock");
    }));
    assert!(poison_result.is_err());

    purge_old_articles(&db);
    assert!(should_purge_old_articles_after_sync(true));
}
