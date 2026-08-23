use rusqlite::{params, Connection};

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;
use crate::repository::pending_mutation::{
    PendingMutation, PendingMutationAxis, PendingMutationRepository, PendingMutationType,
};

#[derive(Debug, Clone, PartialEq, Eq)]
enum PendingMutationAccountScope {
    LocalOnly,
    Remote(ProviderKind),
}

impl PendingMutationAccountScope {
    fn from_provider_kind(kind: &str) -> DomainResult<Self> {
        match kind {
            "Local" => Ok(Self::LocalOnly),
            "Quarantined" => Ok(Self::LocalOnly),
            "FreshRss" => Ok(Self::Remote(ProviderKind::FreshRss)),
            other => Err(DomainError::Persistence(format!(
                "Unknown account provider kind for pending mutation: {other}"
            ))),
        }
    }
}

fn pending_mutation_account_scope(
    conn: &Connection,
    account_id: &AccountId,
) -> DomainResult<PendingMutationAccountScope> {
    let kind = conn.query_row(
        "SELECT kind FROM accounts WHERE id = ?1",
        params![account_id.0],
        |row| row.get::<_, String>(0),
    )?;
    PendingMutationAccountScope::from_provider_kind(&kind)
}

fn delete_replaced_mutations(
    conn: &Connection,
    account_id: &AccountId,
    remote_entry_id: &str,
    replacement_types: &[&str],
) -> DomainResult<()> {
    if replacement_types.is_empty() {
        return Ok(());
    }

    let placeholders = std::iter::repeat_n("?", replacement_types.len())
        .collect::<Vec<_>>()
        .join(", ");
    let delete_sql = format!(
        "DELETE FROM pending_mutations
         WHERE account_id = ?1 AND remote_entry_id = ?2 AND mutation_type IN ({placeholders})"
    );
    let mut delete_params: Vec<&dyn rusqlite::types::ToSql> =
        Vec::with_capacity(2 + replacement_types.len());
    delete_params.push(&account_id.0);
    delete_params.push(&remote_entry_id);
    for mutation_type in replacement_types {
        delete_params.push(mutation_type);
    }

    conn.execute(&delete_sql, rusqlite::params_from_iter(delete_params))?;
    Ok(())
}

pub struct SqlitePendingMutationRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SqlitePendingMutationRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }
}

impl PendingMutationRepository for SqlitePendingMutationRepository<'_> {
    fn find_by_account(&self, account_id: &AccountId) -> DomainResult<Vec<PendingMutation>> {
        if pending_mutation_account_scope(self.conn, account_id)?
            == PendingMutationAccountScope::LocalOnly
        {
            return Ok(Vec::new());
        }

        let mut stmt = self.conn.prepare(
            "SELECT id, account_id, mutation_type, remote_entry_id, created_at
             FROM pending_mutations
             WHERE account_id = ?1
             ORDER BY datetime(created_at) IS NULL, datetime(created_at), id",
        )?;
        let mut rows = stmt.query(params![account_id.0])?;
        let mut mutations = Vec::new();
        while let Some(row) = rows.next()? {
            let mutation_type = row.get::<_, String>(2)?;
            mutations.push(PendingMutation {
                id: row.get(0)?,
                account_id: AccountId(row.get(1)?),
                mutation_type: PendingMutationType::parse(&mutation_type)?,
                remote_entry_id: row.get(3)?,
                created_at: row.get(4)?,
            });
        }
        Ok(mutations)
    }

    fn save(&self, mutation: &PendingMutation) -> DomainResult<()> {
        if mutation.remote_entry_id.trim().is_empty() {
            return Err(DomainError::Validation(
                "pending mutation remote_entry_id cannot be blank".to_string(),
            ));
        }
        match pending_mutation_account_scope(self.conn, &mutation.account_id)? {
            PendingMutationAccountScope::LocalOnly => {
                return Err(DomainError::Validation(
                    "pending mutations require a remote account".to_string(),
                ));
            }
            PendingMutationAccountScope::Remote(kind) => {
                let capabilities = kind.capabilities();
                if !mutation.mutation_type.is_supported_by(&capabilities) {
                    return Err(DomainError::Validation(format!(
                        "pending mutation {} is not supported by account provider capabilities",
                        mutation.mutation_type
                    )));
                }
            }
        }

        let tx = self.conn.unchecked_transaction()?;
        let replacement_types = mutation.mutation_type.replacement_type_values();
        delete_replaced_mutations(
            &tx,
            &mutation.account_id,
            &mutation.remote_entry_id,
            replacement_types,
        )?;
        tx.execute(
            "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![
                mutation.account_id.0,
                mutation.mutation_type.as_str(),
                mutation.remote_entry_id,
                mutation.created_at,
            ],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn delete(&self, ids: &[i64]) -> DomainResult<()> {
        if ids.is_empty() {
            return Ok(());
        }
        let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
        let sql = format!(
            "DELETE FROM pending_mutations WHERE id IN ({})",
            placeholders.join(", ")
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let params: Vec<&dyn rusqlite::types::ToSql> = ids
            .iter()
            .map(|id| id as &dyn rusqlite::types::ToSql)
            .collect();
        stmt.execute(params.as_slice())?;
        Ok(())
    }

    fn delete_by_account_remote_entry_ids_and_axis(
        &self,
        account_id: &AccountId,
        remote_entry_ids: &[String],
        axis: PendingMutationAxis,
    ) -> DomainResult<()> {
        if remote_entry_ids.is_empty() {
            return Ok(());
        }

        let entry_placeholders = std::iter::repeat_n("?", remote_entry_ids.len())
            .collect::<Vec<_>>()
            .join(", ");
        let type_values = match axis {
            PendingMutationAxis::ReadState => {
                PendingMutationType::MarkRead.replacement_type_values()
            }
            PendingMutationAxis::StarState => PendingMutationType::Star.replacement_type_values(),
        };
        let type_placeholders = std::iter::repeat_n("?", type_values.len())
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!(
            "DELETE FROM pending_mutations
             WHERE account_id = ?1
               AND remote_entry_id IN ({entry_placeholders})
               AND mutation_type IN ({type_placeholders})"
        );
        let mut params: Vec<&dyn rusqlite::types::ToSql> =
            Vec::with_capacity(1 + remote_entry_ids.len() + type_values.len());
        params.push(&account_id.0);
        for remote_entry_id in remote_entry_ids {
            params.push(remote_entry_id);
        }
        for mutation_type in type_values {
            params.push(mutation_type);
        }

        self.conn
            .execute(&sql, rusqlite::params_from_iter(params))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests;
