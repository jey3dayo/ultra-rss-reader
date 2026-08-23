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
        ProviderKind::Quarantined => "Quarantined",
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
        ConnectionVerificationStatus::Quarantined => "quarantined",
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

fn validate_sync_settings(sync_interval_secs: i64, keep_read_items_days: i64) -> DomainResult<()> {
    if !(60..=86_400).contains(&sync_interval_secs) {
        return Err(DomainError::Validation(
            "Sync interval must be between 60 and 86400 seconds".into(),
        ));
    }
    if !(0..=3650).contains(&keep_read_items_days) {
        return Err(DomainError::Validation(
            "Keep read items days must be between 0 and 3650".into(),
        ));
    }
    Ok(())
}

fn row_to_account(row: &rusqlite::Row) -> rusqlite::Result<Account> {
    let kind_str: String = row.get(1)?;
    let verification_status: String = row.get(9)?;
    let kind = match provider_kind_from_str(&kind_str) {
        Ok(kind) => kind,
        Err(error) => {
            return Ok(Account {
                id: AccountId(row.get(0)?),
                kind: ProviderKind::Quarantined,
                name: row.get(2)?,
                server_url: row.get(3)?,
                username: row.get(4)?,
                sync_interval_secs: row.get(5)?,
                sync_on_startup: row.get::<_, bool>(6)?,
                sync_on_wake: row.get::<_, bool>(7)?,
                keep_read_items_days: row.get(8)?,
                connection_verification_status: ConnectionVerificationStatus::Quarantined,
                connection_verified_at: None,
                connection_verification_error: Some(error.to_string()),
            });
        }
    };
    let connection_verification_status = match verification_status_from_str(&verification_status) {
        Ok(status) => status,
        Err(error) => {
            return Ok(Account {
                id: AccountId(row.get(0)?),
                kind: ProviderKind::Quarantined,
                name: row.get(2)?,
                server_url: row.get(3)?,
                username: row.get(4)?,
                sync_interval_secs: row.get(5)?,
                sync_on_startup: row.get::<_, bool>(6)?,
                sync_on_wake: row.get::<_, bool>(7)?,
                keep_read_items_days: row.get(8)?,
                connection_verification_status: ConnectionVerificationStatus::Quarantined,
                connection_verified_at: None,
                connection_verification_error: Some(error.to_string()),
            });
        }
    };
    Ok(Account {
        id: AccountId(row.get(0)?),
        kind,
        name: row.get(2)?,
        server_url: row.get(3)?,
        username: row.get(4)?,
        sync_interval_secs: row.get(5)?,
        sync_on_startup: row.get::<_, bool>(6)?,
        sync_on_wake: row.get::<_, bool>(7)?,
        keep_read_items_days: row.get(8)?,
        connection_verification_status,
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
        validate_sync_settings(account.sync_interval_secs, account.keep_read_items_days)?;

        let tx = self.conn.unchecked_transaction()?;
        let existing_remote_identity = tx
            .query_row(
                "SELECT kind, server_url, username FROM accounts WHERE id = ?1",
                params![account.id.0],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                    ))
                },
            )
            .optional()?;
        let remote_identity_changed =
            existing_remote_identity.is_some_and(|(kind, server_url, username)| {
                kind != provider_kind_to_str(&account.kind)
                    || server_url.as_deref() != account.server_url.as_deref()
                    || username.as_deref() != account.username.as_deref()
            });

        tx.execute(
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
        if remote_identity_changed {
            tx.execute(
                "DELETE FROM sync_state WHERE account_id = ?1",
                params![account.id.0],
            )?;
            tx.execute(
                "DELETE FROM pending_mutations WHERE account_id = ?1",
                params![account.id.0],
            )?;
        }
        tx.commit()?;
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
        validate_sync_settings(sync_interval_secs, keep_read_items_days)?;

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
        let existing = self.find_by_id(id)?.ok_or_else(|| {
            DomainError::Validation(format!("Account not found: {}", id.as_ref()))
        })?;
        let remote_identity_changed = existing.server_url.as_deref() != server_url
            || existing.username.as_deref() != username;

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
        require_account_row_affected(rows_affected, id)?;

        if remote_identity_changed {
            self.conn.execute(
                "DELETE FROM sync_state WHERE account_id = ?1",
                params![id.0],
            )?;
            self.conn.execute(
                "DELETE FROM pending_mutations WHERE account_id = ?1",
                params![id.0],
            )?;
        }

        Ok(())
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
mod tests;
