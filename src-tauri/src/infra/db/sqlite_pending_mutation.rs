use rusqlite::{params, Connection};

use crate::domain::error::DomainResult;
use crate::domain::types::AccountId;
use crate::repository::pending_mutation::{PendingMutation, PendingMutationRepository};

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
        let mut stmt = self.conn.prepare(
            "SELECT id, account_id, mutation_type, remote_entry_id, created_at FROM pending_mutations WHERE account_id = ?1 ORDER BY created_at",
        )?;
        let mutations = stmt
            .query_map(params![account_id.0], |row| {
                Ok(PendingMutation {
                    id: row.get(0)?,
                    account_id: AccountId(row.get(1)?),
                    mutation_type: row.get(2)?,
                    remote_entry_id: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(mutations)
    }

    fn save(&self, mutation: &PendingMutation) -> DomainResult<()> {
        self.conn.execute(
            "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![
                mutation.account_id.0,
                mutation.mutation_type,
                mutation.remote_entry_id,
                mutation.created_at,
            ],
        )?;
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::db::connection::DbManager;

    fn test_db() -> DbManager {
        DbManager::new_in_memory().unwrap()
    }

    fn insert_test_account(db: &DbManager) -> AccountId {
        let id = AccountId::new();
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                params![id.0, "Local", "Test"],
            )
            .unwrap();
        id
    }

    #[test]
    fn save_and_find_by_account() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqlitePendingMutationRepository::new(db.writer());

        let mutation = PendingMutation {
            id: None,
            account_id: account_id.clone(),
            mutation_type: "MarkRead".to_string(),
            remote_entry_id: "entry-1".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
        };
        repo.save(&mutation).unwrap();

        let found = repo.find_by_account(&account_id).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].mutation_type, "MarkRead");
        assert!(found[0].id.is_some());
    }

    #[test]
    fn delete_removes_by_ids() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqlitePendingMutationRepository::new(db.writer());

        for i in 0..3 {
            let mutation = PendingMutation {
                id: None,
                account_id: account_id.clone(),
                mutation_type: "MarkRead".to_string(),
                remote_entry_id: format!("entry-{i}"),
                created_at: format!("2024-01-01T00:00:0{i}Z"),
            };
            repo.save(&mutation).unwrap();
        }

        let all = repo.find_by_account(&account_id).unwrap();
        assert_eq!(all.len(), 3);

        let ids_to_delete: Vec<i64> = all[..2].iter().map(|m| m.id.unwrap()).collect();
        repo.delete(&ids_to_delete).unwrap();

        let remaining = repo.find_by_account(&account_id).unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].remote_entry_id, "entry-2");
    }

    #[test]
    fn delete_empty_ids_is_noop() {
        let db = test_db();
        let repo = SqlitePendingMutationRepository::new(db.writer());
        repo.delete(&[]).unwrap();
    }
}
