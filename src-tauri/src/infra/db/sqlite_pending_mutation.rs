use rusqlite::{params, Connection};

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::types::AccountId;
use crate::repository::pending_mutation::{
    PendingMutation, PendingMutationRepository, PendingMutationType,
};

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
                let mutation_type = row.get::<_, String>(2)?;
                Ok(PendingMutation {
                    id: row.get(0)?,
                    account_id: AccountId(row.get(1)?),
                    mutation_type: PendingMutationType::parse(&mutation_type).map_err(|error| {
                        rusqlite::Error::FromSqlConversionFailure(
                            2,
                            rusqlite::types::Type::Text,
                            Box::new(error),
                        )
                    })?,
                    remote_entry_id: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(mutations)
    }

    fn save(&self, mutation: &PendingMutation) -> DomainResult<()> {
        if mutation.remote_entry_id.trim().is_empty() {
            return Err(DomainError::Validation(
                "pending mutation remote_entry_id cannot be blank".to_string(),
            ));
        }

        let tx = self.conn.unchecked_transaction()?;
        let replacement_types = mutation.mutation_type.replacement_type_values();
        let placeholders = std::iter::repeat_n("?", replacement_types.len())
            .collect::<Vec<_>>()
            .join(", ");
        let delete_sql = format!(
            "DELETE FROM pending_mutations
             WHERE account_id = ?1 AND remote_entry_id = ?2 AND mutation_type IN ({placeholders})"
        );
        let mut delete_params: Vec<&dyn rusqlite::types::ToSql> =
            Vec::with_capacity(2 + replacement_types.len());
        delete_params.push(&mutation.account_id.0);
        delete_params.push(&mutation.remote_entry_id);
        for mutation_type in replacement_types {
            delete_params.push(mutation_type);
        }
        tx.execute(&delete_sql, rusqlite::params_from_iter(delete_params))?;
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
            mutation_type: PendingMutationType::MarkRead,
            remote_entry_id: "entry-1".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
        };
        repo.save(&mutation).unwrap();

        let found = repo.find_by_account(&account_id).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].mutation_type, PendingMutationType::MarkRead);
        assert!(found[0].id.is_some());
    }

    #[test]
    fn save_rejects_blank_remote_entry_id_without_inserting_rows() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqlitePendingMutationRepository::new(db.writer());

        for remote_entry_id in ["", "   ", "\n\t"] {
            let error = repo
                .save(&PendingMutation {
                    id: None,
                    account_id: account_id.clone(),
                    mutation_type: PendingMutationType::MarkRead,
                    remote_entry_id: remote_entry_id.to_string(),
                    created_at: "2024-01-01T00:00:00Z".to_string(),
                })
                .expect_err("blank remote_entry_id should be rejected");

            assert!(error.to_string().contains("remote_entry_id"));
        }

        let count: i64 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM pending_mutations", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn save_persists_canonical_mutation_type_values() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqlitePendingMutationRepository::new(db.writer());

        for (mutation_type, remote_entry_id, expected) in [
            (PendingMutationType::MarkRead, "entry-read", "mark_read"),
            (
                PendingMutationType::MarkUnread,
                "entry-unread",
                "mark_unread",
            ),
            (PendingMutationType::Star, "entry-star", "star"),
            (PendingMutationType::Unstar, "entry-unstar", "unstar"),
        ] {
            repo.save(&PendingMutation {
                id: None,
                account_id: account_id.clone(),
                mutation_type,
                remote_entry_id: remote_entry_id.to_string(),
                created_at: "2024-01-01T00:00:00Z".to_string(),
            })
            .unwrap();

            let stored_type: String = db
                .reader()
                .query_row(
                    "SELECT mutation_type FROM pending_mutations WHERE remote_entry_id = ?1",
                    params![remote_entry_id],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(stored_type, expected);
        }
    }

    #[test]
    fn find_by_account_canonicalizes_legacy_mutation_types() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        db.writer()
            .execute(
                "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
                 VALUES (?1, 'set_starred', 'entry-star', '2024-01-01T00:00:00Z'),
                        (?1, 'UnsetStarred', 'entry-unstar', '2024-01-01T00:00:01Z')",
                params![account_id.0],
            )
            .unwrap();

        let repo = SqlitePendingMutationRepository::new(db.reader());
        let found = repo.find_by_account(&account_id).unwrap();

        assert_eq!(
            found
                .iter()
                .map(|mutation| mutation.mutation_type)
                .collect::<Vec<_>>(),
            [PendingMutationType::Star, PendingMutationType::Unstar]
        );
    }

    #[test]
    fn find_by_account_filters_account_and_orders_by_created_at_ascending() {
        let db = test_db();
        let account_a = insert_test_account(&db);
        let account_b = insert_test_account(&db);
        let repo = SqlitePendingMutationRepository::new(db.writer());

        for mutation in [
            PendingMutation {
                id: None,
                account_id: account_a.clone(),
                mutation_type: PendingMutationType::MarkRead,
                remote_entry_id: "entry-new".to_string(),
                created_at: "2024-01-01T00:00:03Z".to_string(),
            },
            PendingMutation {
                id: None,
                account_id: account_b,
                mutation_type: PendingMutationType::MarkRead,
                remote_entry_id: "entry-other-account".to_string(),
                created_at: "2024-01-01T00:00:01Z".to_string(),
            },
            PendingMutation {
                id: None,
                account_id: account_a.clone(),
                mutation_type: PendingMutationType::MarkUnread,
                remote_entry_id: "entry-old".to_string(),
                created_at: "2024-01-01T00:00:01Z".to_string(),
            },
            PendingMutation {
                id: None,
                account_id: account_a.clone(),
                mutation_type: PendingMutationType::Star,
                remote_entry_id: "entry-mid".to_string(),
                created_at: "2024-01-01T00:00:02Z".to_string(),
            },
        ] {
            repo.save(&mutation).unwrap();
        }

        let found = repo.find_by_account(&account_a).unwrap();

        assert_eq!(
            found
                .iter()
                .map(|mutation| mutation.remote_entry_id.as_str())
                .collect::<Vec<_>>(),
            ["entry-old", "entry-mid", "entry-new"]
        );
        assert!(found
            .iter()
            .all(|mutation| mutation.account_id == account_a));
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
                mutation_type: PendingMutationType::MarkRead,
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

    #[test]
    fn save_replaces_existing_pending_mutation_for_same_remote_entry_and_axis() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqlitePendingMutationRepository::new(db.writer());

        repo.save(&PendingMutation {
            id: None,
            account_id: account_id.clone(),
            mutation_type: PendingMutationType::MarkRead,
            remote_entry_id: "entry-1".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
        })
        .unwrap();
        repo.save(&PendingMutation {
            id: None,
            account_id: account_id.clone(),
            mutation_type: PendingMutationType::MarkUnread,
            remote_entry_id: "entry-1".to_string(),
            created_at: "2024-01-01T00:00:01Z".to_string(),
        })
        .unwrap();

        let found = repo.find_by_account(&account_id).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].mutation_type, PendingMutationType::MarkUnread);
        assert_eq!(found[0].created_at, "2024-01-01T00:00:01Z");
    }

    #[test]
    fn save_deduplicates_by_mutation_axis_for_same_remote_entry() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqlitePendingMutationRepository::new(db.writer());

        for (mutation_type, created_at) in [
            (PendingMutationType::MarkRead, "2024-01-01T00:00:00Z"),
            (PendingMutationType::Star, "2024-01-01T00:00:01Z"),
            (PendingMutationType::MarkUnread, "2024-01-01T00:00:02Z"),
            (PendingMutationType::Unstar, "2024-01-01T00:00:03Z"),
        ] {
            repo.save(&PendingMutation {
                id: None,
                account_id: account_id.clone(),
                mutation_type,
                remote_entry_id: "entry-1".to_string(),
                created_at: created_at.to_string(),
            })
            .unwrap();
        }

        let found = repo.find_by_account(&account_id).unwrap();

        assert_eq!(
            found
                .iter()
                .map(|mutation| (mutation.mutation_type, mutation.created_at.as_str()))
                .collect::<Vec<_>>(),
            [
                (PendingMutationType::MarkUnread, "2024-01-01T00:00:02Z"),
                (PendingMutationType::Unstar, "2024-01-01T00:00:03Z")
            ]
        );
    }

    #[test]
    fn save_does_not_replace_different_mutation_axis_for_same_remote_entry() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqlitePendingMutationRepository::new(db.writer());

        repo.save(&PendingMutation {
            id: None,
            account_id: account_id.clone(),
            mutation_type: PendingMutationType::MarkRead,
            remote_entry_id: "entry-1".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
        })
        .unwrap();
        repo.save(&PendingMutation {
            id: None,
            account_id: account_id.clone(),
            mutation_type: PendingMutationType::Star,
            remote_entry_id: "entry-1".to_string(),
            created_at: "2024-01-01T00:00:01Z".to_string(),
        })
        .unwrap();

        let found = repo.find_by_account(&account_id).unwrap();

        assert_eq!(
            found
                .iter()
                .map(|mutation| mutation.mutation_type)
                .collect::<Vec<_>>(),
            [PendingMutationType::MarkRead, PendingMutationType::Star]
        );
    }

    #[test]
    fn save_replacement_is_scoped_to_the_same_account() {
        let db = test_db();
        let account_a = insert_test_account(&db);
        let account_b = insert_test_account(&db);
        let repo = SqlitePendingMutationRepository::new(db.writer());

        repo.save(&PendingMutation {
            id: None,
            account_id: account_a.clone(),
            mutation_type: PendingMutationType::MarkRead,
            remote_entry_id: "shared-entry".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
        })
        .unwrap();
        repo.save(&PendingMutation {
            id: None,
            account_id: account_b.clone(),
            mutation_type: PendingMutationType::Star,
            remote_entry_id: "shared-entry".to_string(),
            created_at: "2024-01-01T00:00:01Z".to_string(),
        })
        .unwrap();

        let found_a = repo.find_by_account(&account_a).unwrap();
        let found_b = repo.find_by_account(&account_b).unwrap();

        assert_eq!(found_a.len(), 1);
        assert_eq!(found_a[0].mutation_type, PendingMutationType::MarkRead);
        assert_eq!(found_b.len(), 1);
        assert_eq!(found_b[0].mutation_type, PendingMutationType::Star);
    }

    #[test]
    fn find_by_account_projects_invalid_stored_mutation_type_as_error() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        db.writer()
            .execute(
                "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
                 VALUES (?1, 'delete_remote_entry', 'entry-1', '2024-01-01T00:00:00Z')",
                params![account_id.0],
            )
            .unwrap();

        let repo = SqlitePendingMutationRepository::new(db.reader());
        let error = repo.find_by_account(&account_id).unwrap_err();

        assert!(error
            .to_string()
            .contains("Unknown pending mutation type: delete_remote_entry"));
    }

    #[test]
    fn save_keeps_existing_pending_mutation_when_replacement_insert_fails() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqlitePendingMutationRepository::new(db.writer());

        repo.save(&PendingMutation {
            id: None,
            account_id: account_id.clone(),
            mutation_type: PendingMutationType::MarkRead,
            remote_entry_id: "entry-1".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
        })
        .unwrap();

        db.writer()
            .execute_batch(
                "CREATE TEMP TRIGGER fail_pending_mutation_replacement
                 BEFORE INSERT ON pending_mutations
                 WHEN NEW.remote_entry_id = 'entry-1'
                 BEGIN
                   SELECT RAISE(ABORT, 'forced replacement failure');
                 END;",
            )
            .unwrap();

        let result = repo.save(&PendingMutation {
            id: None,
            account_id: account_id.clone(),
            mutation_type: PendingMutationType::Unstar,
            remote_entry_id: "entry-1".to_string(),
            created_at: "2024-01-01T00:00:01Z".to_string(),
        });

        assert!(result.is_err());

        let found = repo.find_by_account(&account_id).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].mutation_type, PendingMutationType::MarkRead);
        assert_eq!(found[0].created_at, "2024-01-01T00:00:00Z");
    }
}
