use rusqlite::{params, Connection, OptionalExtension};

use crate::domain::account::Account;
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

fn row_to_account(row: &rusqlite::Row) -> rusqlite::Result<Account> {
    let kind_str: String = row.get(1)?;
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
    })
}

impl AccountRepository for SqliteAccountRepository<'_> {
    fn find_all(&self) -> DomainResult<Vec<Account>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, kind, name, server_url, username, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days FROM accounts",
        )?;
        let accounts = stmt
            .query_map([], row_to_account)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(accounts)
    }

    fn find_by_id(&self, id: &AccountId) -> DomainResult<Option<Account>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, kind, name, server_url, username, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days FROM accounts WHERE id = ?1",
        )?;
        let account = stmt.query_row(params![id.0], row_to_account).optional()?;
        Ok(account)
    }

    fn save(&self, account: &Account) -> DomainResult<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO accounts (id, kind, name, server_url, username, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
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
            "UPDATE accounts SET server_url = ?1, username = ?2 WHERE id = ?3",
            params![server_url, username, id.0],
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
}
