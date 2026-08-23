use super::*;
use crate::infra::db::connection::DbManager;

fn test_db() -> DbManager {
    DbManager::new_in_memory().unwrap()
}

fn make_account(name: &str) -> Account {
    Account {
        id: AccountId::new(),
        kind: ProviderKind::Local,
        name: name.to_string(),
        server_url: None,
        username: None,
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    }
}

#[test]
fn save_and_find_all() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    let account = make_account("Test Account");
    repo.save(&account).unwrap();

    let all = repo.find_all().unwrap();
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].name, "Test Account");
    assert_eq!(all[0].id, account.id);
}

#[test]
fn find_all_returns_unknown_provider_kind_as_quarantined_account() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.reader());
    let valid_account = make_account("Valid");
    SqliteAccountRepository::new(db.writer())
        .save(&valid_account)
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
            params!["acc-unknown", "UnknownProvider", "Unknown"],
        )
        .unwrap();

    let accounts = repo.find_all().unwrap();

    assert_eq!(accounts.len(), 2);
    assert!(accounts
        .iter()
        .any(|account| account.id == valid_account.id));
    let quarantined = accounts
        .iter()
        .find(|account| account.id == AccountId("acc-unknown".to_string()))
        .expect("quarantined account should be listed");
    assert_eq!(quarantined.kind, ProviderKind::Quarantined);
    assert_eq!(
        quarantined.connection_verification_status,
        ConnectionVerificationStatus::Quarantined
    );
    assert!(quarantined
        .connection_verification_error
        .as_deref()
        .is_some_and(|message| message.contains("UnknownProvider")));
}

#[test]
fn find_by_id_returns_unknown_provider_kind_as_quarantined_account() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.reader());
    let account_id = AccountId("acc-unknown".to_string());
    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
            params![account_id.0, "UnknownProvider", "Unknown"],
        )
        .unwrap();

    let account = repo
        .find_by_id(&account_id)
        .expect("unknown provider kind should stay displayable")
        .expect("quarantined account should be returned");

    assert_eq!(account.kind, ProviderKind::Quarantined);
    assert_eq!(
        account.connection_verification_status,
        ConnectionVerificationStatus::Quarantined
    );
    assert!(account
        .connection_verification_error
        .as_deref()
        .is_some_and(|message| message.contains("UnknownProvider")));
}

#[test]
fn find_all_returns_unknown_verification_status_as_quarantined_account() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.reader());
    let valid_account = make_account("Valid");
    SqliteAccountRepository::new(db.writer())
        .save(&valid_account)
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name, connection_verification_status)
             VALUES (?1, ?2, ?3, ?4)",
            params!["acc-expired", "Local", "Expired", "expired"],
        )
        .unwrap();

    let accounts = repo.find_all().unwrap();

    assert_eq!(accounts.len(), 2);
    assert!(accounts
        .iter()
        .any(|account| account.id == valid_account.id));
    let quarantined = accounts
        .iter()
        .find(|account| account.id == AccountId("acc-expired".to_string()))
        .expect("quarantined account should be listed");
    assert_eq!(quarantined.kind, ProviderKind::Quarantined);
    assert_eq!(
        quarantined.connection_verification_status,
        ConnectionVerificationStatus::Quarantined
    );
    assert!(quarantined
        .connection_verification_error
        .as_deref()
        .is_some_and(|message| message.contains("expired")));
}

#[test]
fn find_by_id_returns_unknown_verification_status_as_quarantined_account() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.reader());
    let account_id = AccountId("acc-expired".to_string());
    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name, connection_verification_status)
             VALUES (?1, ?2, ?3, ?4)",
            params![account_id.0, "Local", "Expired", "expired"],
        )
        .unwrap();

    let account = repo
        .find_by_id(&account_id)
        .expect("unknown verification status should stay displayable")
        .expect("quarantined account should be returned");

    assert_eq!(account.kind, ProviderKind::Quarantined);
    assert_eq!(
        account.connection_verification_status,
        ConnectionVerificationStatus::Quarantined
    );
    assert!(account
        .connection_verification_error
        .as_deref()
        .is_some_and(|message| message.contains("expired")));
}

#[test]
fn delete_cascades_account_retention_matrix_for_articles_tags_history_backoff() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    let account = make_account("Test");
    repo.save(&account).unwrap();

    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name) VALUES ('folder-1', ?1, 'Folder')",
            params![account.id.0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, folder_id, title, url, site_url)
             VALUES ('feed-1', ?1, 'folder-1', 'Feed', 'https://example.com/feed.xml', 'https://example.com')",
            params![account.id.0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO articles (id, feed_id, remote_id, title, published_at, fetched_at)
             VALUES ('article-1', 'feed-1', 'remote-1', 'Article', '2026-05-09T00:00:00Z', '2026-05-09T00:01:00Z')",
            [],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO tags (id, name) VALUES ('tag-1', 'Retained Tag')",
            [],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO article_tags (article_id, tag_id) VALUES ('article-1', 'tag-1')",
            [],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO article_view_history (account_id, article_id, viewed_at)
             VALUES (?1, 'article-1', '2026-05-09T00:03:00Z')",
            params![account.id.0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO sync_state (account_id, scope_key) VALUES (?1, '')",
            params![account.id.0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO feed_http_cache (feed_id, etag, last_modified, last_fetched_at)
             VALUES ('feed-1', 'etag-1', 'Wed, 01 May 2026 00:00:00 GMT', '2026-05-09T00:01:00Z')",
            [],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
             VALUES (?1, 'mark_read', 'remote-1', '2026-05-09T00:02:00Z')",
            params![account.id.0],
        )
        .unwrap();

    repo.delete(&account.id).unwrap();

    let folder_count: i32 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM folders", [], |row| row.get(0))
        .unwrap();
    let feed_count: i32 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM feeds", [], |row| row.get(0))
        .unwrap();
    let article_count: i32 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM articles", [], |row| row.get(0))
        .unwrap();
    let sync_state_count: i32 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM sync_state", [], |row| row.get(0))
        .unwrap();
    let pending_count: i32 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM pending_mutations", [], |row| {
            row.get(0)
        })
        .unwrap();
    let article_tag_count: i32 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM article_tags", [], |row| row.get(0))
        .unwrap();
    let tag_count: i32 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM tags", [], |row| row.get(0))
        .unwrap();
    let history_count: i32 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM article_view_history", [], |row| {
            row.get(0)
        })
        .unwrap();
    let http_cache_count: i32 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM feed_http_cache", [], |row| row.get(0))
        .unwrap();

    assert_eq!(folder_count, 0);
    assert_eq!(feed_count, 0);
    assert_eq!(article_count, 0);
    assert_eq!(article_tag_count, 0);
    assert_eq!(tag_count, 1);
    assert_eq!(history_count, 0);
    assert_eq!(http_cache_count, 0);
    assert_eq!(sync_state_count, 0);
    assert_eq!(pending_count, 0);
}

#[test]
fn save_updates_existing() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    let mut account = make_account("Original");
    repo.save(&account).unwrap();

    account.name = "Updated".to_string();
    repo.save(&account).unwrap();

    let all = repo.find_all().unwrap();
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].name, "Updated");
}

#[test]
fn save_update_preserves_related_folders_feeds_and_articles() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    let mut account = make_account("Original");
    repo.save(&account).unwrap();

    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name) VALUES ('folder-1', ?1, 'Folder')",
            params![account.id.0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, folder_id, title, url, site_url)
             VALUES ('feed-1', ?1, 'folder-1', 'Feed', 'https://example.com/feed.xml', 'https://example.com')",
            params![account.id.0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO articles (id, feed_id, title, published_at, fetched_at)
             VALUES ('article-1', 'feed-1', 'Article', '2026-05-09T00:00:00Z', '2026-05-09T00:01:00Z')",
            [],
        )
        .unwrap();

    account.name = "Updated".to_string();
    repo.save(&account).unwrap();

    let folder_count: i32 = db
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM folders WHERE account_id = ?1",
            params![account.id.0],
            |row| row.get(0),
        )
        .unwrap();
    let feed_count: i32 = db
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM feeds WHERE account_id = ?1",
            params![account.id.0],
            |row| row.get(0),
        )
        .unwrap();
    let article_count: i32 = db
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE feed_id = 'feed-1'",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(folder_count, 1);
    assert_eq!(feed_count, 1);
    assert_eq!(article_count, 1);
}

#[test]
fn save_clears_remote_sync_state_and_pending_mutations_when_provider_identity_changes() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    let mut account = make_account("FreshRSS");
    account.kind = ProviderKind::FreshRss;
    account.server_url = Some("https://old.example.com".to_string());
    account.username = Some("old-user".to_string());
    repo.save(&account).unwrap();

    db.writer()
        .execute(
            "INSERT INTO sync_state (account_id, scope_key, continuation, last_error, error_count, next_retry_at)
             VALUES (?1, 'account:greader:all', 'cursor', 'backoff', 3, '2026-05-10T00:00:00Z')",
            params![account.id.0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
             VALUES (?1, 'mark_read', 'remote-1', '2026-05-09T00:02:00Z')",
            params![account.id.0],
        )
        .unwrap();

    account.kind = ProviderKind::Local;
    account.server_url = None;
    account.username = None;
    repo.save(&account).unwrap();

    let sync_state_count: i32 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM sync_state", [], |row| row.get(0))
        .unwrap();
    let pending_count: i32 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM pending_mutations", [], |row| {
            row.get(0)
        })
        .unwrap();
    let updated = repo.find_by_id(&account.id).unwrap().unwrap();

    assert_eq!(updated.kind, ProviderKind::Local);
    assert_eq!(sync_state_count, 0);
    assert_eq!(pending_count, 0);
}

#[test]
fn save_keeps_remote_sync_state_and_pending_mutations_when_provider_identity_is_unchanged() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    let mut account = make_account("FreshRSS");
    account.kind = ProviderKind::FreshRss;
    account.server_url = Some("https://same.example.com".to_string());
    account.username = Some("same-user".to_string());
    repo.save(&account).unwrap();

    db.writer()
        .execute(
            "INSERT INTO sync_state (account_id, scope_key, continuation, last_error, error_count, next_retry_at)
             VALUES (?1, 'account:greader:all', 'cursor', 'backoff', 3, '2026-05-10T00:00:00Z')",
            params![account.id.0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
             VALUES (?1, 'mark_read', 'remote-1', '2026-05-09T00:02:00Z')",
            params![account.id.0],
        )
        .unwrap();

    account.name = "Renamed FreshRSS".to_string();
    repo.save(&account).unwrap();

    let sync_state_count: i32 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM sync_state", [], |row| row.get(0))
        .unwrap();
    let pending_count: i32 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM pending_mutations", [], |row| {
            row.get(0)
        })
        .unwrap();

    assert_eq!(sync_state_count, 1);
    assert_eq!(pending_count, 1);
}

#[test]
fn find_all_returns_accounts_in_stable_name_order() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    for account in [
        Account {
            id: AccountId("account-z".to_string()),
            ..make_account("Zeta")
        },
        Account {
            id: AccountId("account-b".to_string()),
            ..make_account("alpha")
        },
        Account {
            id: AccountId("account-a".to_string()),
            ..make_account("Alpha")
        },
    ] {
        repo.save(&account).unwrap();
    }

    let account_ids = repo
        .find_all()
        .unwrap()
        .into_iter()
        .map(|account| account.id.0)
        .collect::<Vec<_>>();

    assert_eq!(account_ids, vec!["account-a", "account-b", "account-z"]);
}

#[test]
fn update_sync_settings_persists_startup_flag() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    let account = make_account("Startup");
    repo.save(&account).unwrap();

    repo.update_sync_settings(&account.id, 7200, false, true, 90)
        .unwrap();

    let saved = repo.find_by_id(&account.id).unwrap().unwrap();
    assert_eq!(saved.sync_interval_secs, 7200);
    assert!(!saved.sync_on_startup);
    assert!(saved.sync_on_wake);
    assert_eq!(saved.keep_read_items_days, 90);
}

#[test]
fn save_rejects_out_of_range_sync_settings() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    for (sync_interval_secs, keep_read_items_days) in
        [(59, 30), (86_401, 30), (3600, -1), (3600, 3651)]
    {
        let account = Account {
            sync_interval_secs,
            keep_read_items_days,
            ..make_account("Invalid")
        };

        assert!(
            repo.save(&account).is_err(),
            "sync_interval_secs={sync_interval_secs}, keep_read_items_days={keep_read_items_days} should be rejected"
        );
    }
}

#[test]
fn accounts_table_rejects_out_of_range_sync_settings() {
    let db = test_db();

    for (sync_interval_secs, keep_read_items_days) in
        [(59, 30), (86_401, 30), (3600, -1), (3600, 3651)]
    {
        let result = db.writer().execute(
            "INSERT INTO accounts (id, kind, name, sync_interval_secs, keep_read_items_days)
             VALUES (?1, 'Local', 'Invalid', ?2, ?3)",
            params![
                format!("invalid-{sync_interval_secs}-{keep_read_items_days}"),
                sync_interval_secs,
                keep_read_items_days
            ],
        );

        assert!(
            result.is_err(),
            "sync_interval_secs={sync_interval_secs}, keep_read_items_days={keep_read_items_days} should be rejected"
        );
    }
}

#[test]
fn update_sync_settings_rejects_out_of_range_values() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    let account = make_account("Startup");
    repo.save(&account).unwrap();

    for (sync_interval_secs, keep_read_items_days) in
        [(59, 30), (86_401, 30), (3600, -1), (3600, 3651)]
    {
        assert!(
            repo.update_sync_settings(
                &account.id,
                sync_interval_secs,
                false,
                true,
                keep_read_items_days,
            )
            .is_err(),
            "sync_interval_secs={sync_interval_secs}, keep_read_items_days={keep_read_items_days} should be rejected"
        );
    }

    let saved = repo.find_by_id(&account.id).unwrap().unwrap();
    assert_eq!(saved.sync_interval_secs, 3600);
    assert_eq!(saved.keep_read_items_days, 30);
}

#[test]
fn update_sync_settings_returns_error_for_missing_account() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    let error = repo
        .update_sync_settings(
            &AccountId("missing-account".to_string()),
            7200,
            false,
            true,
            90,
        )
        .expect_err("missing account update should fail");

    assert!(error.to_string().contains("Account not found"));
}

#[test]
fn save_and_update_credentials_persist_connection_verification_state() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    let mut account = make_account("FreshRSS");
    account.kind = ProviderKind::FreshRss;
    account.connection_verification_status =
        crate::domain::account::ConnectionVerificationStatus::Verified;
    account.connection_verified_at = Some("2026-04-19T05:32:00Z".to_string());
    repo.save(&account).unwrap();

    let saved = repo.find_by_id(&account.id).unwrap().unwrap();
    assert_eq!(
        saved.connection_verification_status,
        crate::domain::account::ConnectionVerificationStatus::Verified
    );
    assert_eq!(
        saved.connection_verified_at.as_deref(),
        Some("2026-04-19T05:32:00Z")
    );

    repo.update_credentials(
        &account.id,
        Some("https://freshrss.example.com"),
        Some("debug"),
    )
    .unwrap();

    let updated = repo.find_by_id(&account.id).unwrap().unwrap();
    assert_eq!(
        updated.connection_verification_status,
        crate::domain::account::ConnectionVerificationStatus::Unverified
    );
    assert_eq!(updated.connection_verified_at, None);
    assert_eq!(updated.connection_verification_error, None);
}

#[test]
fn update_credentials_resets_connection_verification_state() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    let mut account = make_account("FreshRSS");
    account.kind = ProviderKind::FreshRss;
    account.server_url = Some("https://old.example.com".to_string());
    account.username = Some("old-user".to_string());
    repo.save(&account).unwrap();
    repo.update_connection_verification(
        &account.id,
        ConnectionVerificationStatus::Error,
        Some("2026-05-09T00:00:00Z"),
        Some("old credentials failed"),
    )
    .unwrap();

    repo.update_credentials(
        &account.id,
        Some("https://new.example.com"),
        Some("new-user"),
    )
    .unwrap();

    let updated = repo.find_by_id(&account.id).unwrap().unwrap();
    assert_eq!(
        updated.server_url.as_deref(),
        Some("https://new.example.com")
    );
    assert_eq!(updated.username.as_deref(), Some("new-user"));
    assert_eq!(
        updated.connection_verification_status,
        ConnectionVerificationStatus::Unverified
    );
    assert_eq!(updated.connection_verified_at, None);
    assert_eq!(updated.connection_verification_error, None);
}

#[test]
fn update_credentials_clears_remote_sync_state_when_server_or_user_changes() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    let mut account = make_account("FreshRSS");
    account.kind = ProviderKind::FreshRss;
    account.server_url = Some("https://old.example.com".to_string());
    account.username = Some("old-user".to_string());
    repo.save(&account).unwrap();

    db.writer()
        .execute(
            "INSERT INTO sync_state (account_id, scope_key, continuation)
             VALUES (?1, 'account:greader:all', 'cursor')",
            params![account.id.0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
             VALUES (?1, 'mark_read', 'remote-1', '2026-05-09T00:02:00Z')",
            params![account.id.0],
        )
        .unwrap();

    repo.update_credentials(
        &account.id,
        Some("https://new.example.com"),
        Some("old-user"),
    )
    .unwrap();

    let sync_state_count: i32 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM sync_state", [], |row| row.get(0))
        .unwrap();
    let pending_count: i32 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM pending_mutations", [], |row| {
            row.get(0)
        })
        .unwrap();

    assert_eq!(sync_state_count, 0);
    assert_eq!(pending_count, 0);
}

#[test]
fn update_credentials_keeps_remote_sync_state_when_identity_is_unchanged() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    let mut account = make_account("FreshRSS");
    account.kind = ProviderKind::FreshRss;
    account.server_url = Some("https://same.example.com".to_string());
    account.username = Some("same-user".to_string());
    repo.save(&account).unwrap();

    db.writer()
        .execute(
            "INSERT INTO sync_state (account_id, scope_key, continuation)
             VALUES (?1, 'account:greader:all', 'cursor')",
            params![account.id.0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
             VALUES (?1, 'mark_read', 'remote-1', '2026-05-09T00:02:00Z')",
            params![account.id.0],
        )
        .unwrap();

    repo.update_credentials(
        &account.id,
        Some("https://same.example.com"),
        Some("same-user"),
    )
    .unwrap();

    let sync_state_count: i32 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM sync_state", [], |row| row.get(0))
        .unwrap();
    let pending_count: i32 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM pending_mutations", [], |row| {
            row.get(0)
        })
        .unwrap();

    assert_eq!(sync_state_count, 1);
    assert_eq!(pending_count, 1);
}

#[test]
fn update_credentials_returns_error_for_missing_account() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    let error = repo
        .update_credentials(
            &AccountId("missing-account".to_string()),
            Some("https://new.example.com"),
            Some("new-user"),
        )
        .expect_err("missing account credential update should fail");

    assert!(error.to_string().contains("Account not found"));
}

#[test]
fn update_connection_verification_returns_error_for_missing_account() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    let error = repo
        .update_connection_verification(
            &AccountId("missing-account".to_string()),
            ConnectionVerificationStatus::Verified,
            Some("2026-05-10T00:00:00Z"),
            None,
        )
        .expect_err("missing account verification update should fail");

    assert!(error.to_string().contains("Account not found"));
}

#[test]
fn rename_returns_error_for_missing_account() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    let error = repo
        .rename(&AccountId("missing-account".to_string()), "Renamed")
        .expect_err("missing account rename should fail");

    assert!(error.to_string().contains("Account not found"));
}

#[test]
fn delete_returns_error_for_missing_account() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());

    let error = repo
        .delete(&AccountId("missing-account".to_string()))
        .expect_err("missing account delete should fail");

    assert!(error.to_string().contains("Account not found"));
}
