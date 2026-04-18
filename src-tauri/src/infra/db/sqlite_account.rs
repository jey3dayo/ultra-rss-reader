use rusqlite::{params, Connection, OptionalExtension};

use crate::domain::account::{Account, ConnectionVerificationStatus};
use crate::domain::error::DomainResult;
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

fn provider_kind_from_str(s: &str) -> ProviderKind {
    match s {
        "FreshRss" => ProviderKind::FreshRss,
        _ => ProviderKind::Local,
    }
}

fn verification_status_to_str(status: ConnectionVerificationStatus) -> &'static str {
    match status {
        ConnectionVerificationStatus::Verified => "verified",
        ConnectionVerificationStatus::Unverified => "unverified",
        ConnectionVerificationStatus::Error => "error",
    }
}

fn verification_status_from_str(status: &str) -> ConnectionVerificationStatus {
    match status {
        "verified" => ConnectionVerificationStatus::Verified,
        "error" => ConnectionVerificationStatus::Error,
        _ => ConnectionVerificationStatus::Unverified,
    }
}

fn row_to_account(row: &rusqlite::Row) -> rusqlite::Result<Account> {
    let kind_str: String = row.get(1)?;
    let verification_status: String = row.get(9)?;
    Ok(Account {
        id: AccountId(row.get(0)?),
        kind: provider_kind_from_str(&kind_str),
        name: row.get(2)?,
        server_url: row.get(3)?,
        username: row.get(4)?,
        sync_interval_secs: row.get(5)?,
        sync_on_startup: row.get::<_, bool>(6)?,
        sync_on_wake: row.get::<_, bool>(7)?,
        keep_read_items_days: row.get(8)?,
        connection_verification_status: verification_status_from_str(&verification_status),
        connection_verified_at: row.get(10)?,
        connection_verification_error: row.get(11)?,
    })
}

impl AccountRepository for SqliteAccountRepository<'_> {
    fn find_all(&self) -> DomainResult<Vec<Account>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, kind, name, server_url, username, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days, connection_verification_status, connection_verified_at, connection_verification_error FROM accounts",
        )?;
        let accounts = stmt
            .query_map([], row_to_account)?
            .collect::<Result<Vec<_>, _>>()?;
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
            "INSERT OR REPLACE INTO accounts (id, kind, name, server_url, username, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days, connection_verification_status, connection_verified_at, connection_verification_error) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
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
        self.conn.execute(
            "UPDATE accounts SET sync_interval_secs = ?1, sync_on_startup = ?2, sync_on_wake = ?3, keep_read_items_days = ?4 WHERE id = ?5",
            params![sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days, id.0],
        )?;
        Ok(())
    }

    fn update_credentials(
        &self,
        id: &AccountId,
        server_url: Option<&str>,
        username: Option<&str>,
    ) -> DomainResult<()> {
        self.conn.execute(
            "UPDATE accounts
             SET server_url = ?1,
                 username = ?2,
                 connection_verification_status = 'unverified',
                 connection_verified_at = NULL,
                 connection_verification_error = NULL
             WHERE id = ?3",
            params![server_url, username, id.0],
        )?;
        Ok(())
    }

    fn update_connection_verification(
        &self,
        id: &AccountId,
        status: ConnectionVerificationStatus,
        verified_at: Option<&str>,
        verification_error: Option<&str>,
    ) -> DomainResult<()> {
        self.conn.execute(
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
        Ok(())
    }

    fn rename(&self, id: &AccountId, name: &str) -> DomainResult<()> {
        self.conn.execute(
            "UPDATE accounts SET name = ?1 WHERE id = ?2",
            params![name, id.0],
        )?;
        Ok(())
    }

    fn delete(&self, id: &AccountId) -> DomainResult<()> {
        self.conn
            .execute("DELETE FROM accounts WHERE id = ?1", params![id.0])?;
        Ok(())
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
    fn delete_cascades_feeds() {
        let db = test_db();
        let repo = SqliteAccountRepository::new(db.writer());

        let account = make_account("Test");
        repo.save(&account).unwrap();

        // Insert a feed referencing this account
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, title, url) VALUES ('f1', ?1, 'Feed', 'http://f.com')",
                params![account.id.0],
            )
            .unwrap();

        repo.delete(&account.id).unwrap();

        let count: i32 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM feeds", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
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
}
