use rusqlite::types::Type;
use rusqlite::{params, Connection, OptionalExtension};
use tracing::warn;

use crate::domain::account::{Account, ConnectionVerificationStatus};
use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;
use crate::repository::account::AccountRepository;

pub struct SqliteAccountRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SqliteAccountRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }
}

fn provider_kind_to_str(kind: &ProviderKind) -> &'static str {
    match kind {
        ProviderKind::Local => "Local",
        ProviderKind::FreshRss => "FreshRss",
    }
}

fn provider_kind_from_str(s: &str) -> DomainResult<ProviderKind> {
    match s {
        "Local" => Ok(ProviderKind::Local),
        "FreshRss" => Ok(ProviderKind::FreshRss),
        other => Err(DomainError::Persistence(format!(
            "Unknown account provider kind: {other}"
        ))),
    }
}

fn verification_status_to_str(status: ConnectionVerificationStatus) -> &'static str {
    match status {
        ConnectionVerificationStatus::Verified => "verified",
        ConnectionVerificationStatus::Unverified => "unverified",
        ConnectionVerificationStatus::Error => "error",
    }
}

fn verification_status_from_str(status: &str) -> DomainResult<ConnectionVerificationStatus> {
    match status {
        "verified" => Ok(ConnectionVerificationStatus::Verified),
        "unverified" => Ok(ConnectionVerificationStatus::Unverified),
        "error" => Ok(ConnectionVerificationStatus::Error),
        other => Err(DomainError::Persistence(format!(
            "Unknown account connection verification status: {other}"
        ))),
    }
}

fn require_account_row_affected(rows_affected: usize, id: &AccountId) -> DomainResult<()> {
    if rows_affected == 0 {
        return Err(DomainError::Validation(format!(
            "Account not found: {}",
            id.as_ref()
        )));
    }
    Ok(())
}

fn row_to_account(row: &rusqlite::Row) -> rusqlite::Result<Account> {
    let kind_str: String = row.get(1)?;
    let verification_status: String = row.get(9)?;
    Ok(Account {
        id: AccountId(row.get(0)?),
        kind: provider_kind_from_str(&kind_str).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(1, Type::Text, Box::new(error))
        })?,
        name: row.get(2)?,
        server_url: row.get(3)?,
        username: row.get(4)?,
        sync_interval_secs: row.get(5)?,
        sync_on_startup: row.get::<_, bool>(6)?,
        sync_on_wake: row.get::<_, bool>(7)?,
        keep_read_items_days: row.get(8)?,
        connection_verification_status: verification_status_from_str(&verification_status)
            .map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(9, Type::Text, Box::new(error))
            })?,
        connection_verified_at: row.get(10)?,
        connection_verification_error: row.get(11)?,
    })
}

impl AccountRepository for SqliteAccountRepository<'_> {
    fn find_all(&self) -> DomainResult<Vec<Account>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, kind, name, server_url, username, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days, connection_verification_status, connection_verified_at, connection_verification_error FROM accounts ORDER BY name COLLATE NOCASE, id",
        )?;
        let mut rows = stmt.query([])?;
        let mut accounts = Vec::new();
        while let Some(row) = rows.next()? {
            match row_to_account(row) {
                Ok(account) => accounts.push(account),
                Err(error) => warn!("Skipping invalid account row during list_accounts: {error}"),
            }
        }
        Ok(accounts)
    }

    fn find_by_id(&self, id: &AccountId) -> DomainResult<Option<Account>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, kind, name, server_url, username, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days, connection_verification_status, connection_verified_at, connection_verification_error FROM accounts WHERE id = ?1",
        )?;
        let account = stmt.query_row(params![id.0], row_to_account).optional()?;
        Ok(account)
    }

    fn save(&self, account: &Account) -> DomainResult<()> {
        self.conn.execute(
            "INSERT INTO accounts (
                id,
                kind,
                name,
                server_url,
                username,
                sync_interval_secs,
                sync_on_startup,
                sync_on_wake,
                keep_read_items_days,
                connection_verification_status,
                connection_verified_at,
                connection_verification_error
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
             ON CONFLICT(id) DO UPDATE SET
                kind = excluded.kind,
                name = excluded.name,
                server_url = excluded.server_url,
                username = excluded.username,
                sync_interval_secs = excluded.sync_interval_secs,
                sync_on_startup = excluded.sync_on_startup,
                sync_on_wake = excluded.sync_on_wake,
                keep_read_items_days = excluded.keep_read_items_days,
                connection_verification_status = excluded.connection_verification_status,
                connection_verified_at = excluded.connection_verified_at,
                connection_verification_error = excluded.connection_verification_error",
            params![
                account.id.0,
                provider_kind_to_str(&account.kind),
                account.name,
                account.server_url,
                account.username,
                account.sync_interval_secs,
                account.sync_on_startup,
                account.sync_on_wake,
                account.keep_read_items_days,
                verification_status_to_str(account.connection_verification_status),
                account.connection_verified_at,
                account.connection_verification_error,
            ],
        )?;
        Ok(())
    }

    fn update_sync_settings(
        &self,
        id: &AccountId,
        sync_interval_secs: i64,
        sync_on_startup: bool,
        sync_on_wake: bool,
        keep_read_items_days: i64,
    ) -> DomainResult<()> {
        let rows_affected = self.conn.execute(
            "UPDATE accounts SET sync_interval_secs = ?1, sync_on_startup = ?2, sync_on_wake = ?3, keep_read_items_days = ?4 WHERE id = ?5",
            params![sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days, id.0],
        )?;
        require_account_row_affected(rows_affected, id)
    }

    fn update_credentials(
        &self,
        id: &AccountId,
        server_url: Option<&str>,
        username: Option<&str>,
    ) -> DomainResult<()> {
        let rows_affected = self.conn.execute(
            "UPDATE accounts
             SET server_url = ?1,
                 username = ?2,
                 connection_verification_status = 'unverified',
                 connection_verified_at = NULL,
                 connection_verification_error = NULL
             WHERE id = ?3",
            params![server_url, username, id.0],
        )?;
        require_account_row_affected(rows_affected, id)
    }

    fn update_connection_verification(
        &self,
        id: &AccountId,
        status: ConnectionVerificationStatus,
        verified_at: Option<&str>,
        verification_error: Option<&str>,
    ) -> DomainResult<()> {
        let rows_affected = self.conn.execute(
            "UPDATE accounts
             SET connection_verification_status = ?1,
                 connection_verified_at = ?2,
                 connection_verification_error = ?3
             WHERE id = ?4",
            params![
                verification_status_to_str(status),
                verified_at,
                verification_error,
                id.0
            ],
        )?;
        require_account_row_affected(rows_affected, id)
    }

    fn rename(&self, id: &AccountId, name: &str) -> DomainResult<()> {
        let rows_affected = self.conn.execute(
            "UPDATE accounts SET name = ?1 WHERE id = ?2",
            params![name, id.0],
        )?;
        require_account_row_affected(rows_affected, id)
    }

    fn delete(&self, id: &AccountId) -> DomainResult<()> {
        let rows_affected = self
            .conn
            .execute("DELETE FROM accounts WHERE id = ?1", params![id.0])?;
        require_account_row_affected(rows_affected, id)
    }
}

#[cfg(test)]
mod tests {
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
    fn find_all_quarantines_unknown_provider_kind() {
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

        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].id, valid_account.id);
    }

    #[test]
    fn find_by_id_returns_error_for_unknown_provider_kind() {
        let db = test_db();
        let repo = SqliteAccountRepository::new(db.reader());
        let account_id = AccountId("acc-unknown".to_string());
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                params![account_id.0, "UnknownProvider", "Unknown"],
            )
            .unwrap();

        let error = repo
            .find_by_id(&account_id)
            .expect_err("unknown provider kind should fail account decode");

        assert!(error.to_string().contains("UnknownProvider"));
    }

    #[test]
    fn find_all_quarantines_unknown_verification_status() {
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

        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].id, valid_account.id);
    }

    #[test]
    fn find_by_id_returns_error_for_unknown_verification_status() {
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

        let error = repo
            .find_by_id(&account_id)
            .expect_err("unknown verification status should fail account decode");

        assert!(error.to_string().contains("expired"));
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

        assert_eq!(folder_count, 0);
        assert_eq!(feed_count, 0);
        assert_eq!(article_count, 0);
        assert_eq!(article_tag_count, 0);
        assert_eq!(tag_count, 1);
        assert_eq!(history_count, 0);
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
}
