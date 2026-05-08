use rusqlite::{params, Connection};

use crate::domain::error::DomainResult;
use crate::domain::folder::Folder;
use crate::domain::types::{AccountId, FolderId};
use crate::repository::folder::FolderRepository;

pub struct SqliteFolderRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SqliteFolderRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }
}

fn row_to_folder(row: &rusqlite::Row) -> rusqlite::Result<Folder> {
    Ok(Folder {
        id: FolderId(row.get(0)?),
        account_id: AccountId(row.get(1)?),
        remote_id: row.get(2)?,
        name: row.get(3)?,
        sort_order: row.get(4)?,
    })
}

impl FolderRepository for SqliteFolderRepository<'_> {
    fn find_by_account(&self, account_id: &AccountId) -> DomainResult<Vec<Folder>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, account_id, remote_id, name, sort_order FROM folders WHERE account_id = ?1 ORDER BY sort_order, id",
        )?;
        let folders = stmt
            .query_map(params![account_id.0], row_to_folder)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(folders)
    }

    fn save(&self, folder: &Folder) -> DomainResult<()> {
        self.conn.execute(
            "INSERT INTO folders (id, account_id, remote_id, name, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
               account_id = excluded.account_id,
               remote_id = excluded.remote_id,
               name = excluded.name,
               sort_order = excluded.sort_order",
            params![
                folder.id.0,
                folder.account_id.0,
                folder.remote_id,
                folder.name,
                folder.sort_order,
            ],
        )?;
        Ok(())
    }

    fn delete(&self, id: &FolderId) -> DomainResult<()> {
        self.conn
            .execute("DELETE FROM folders WHERE id = ?1", params![id.0])?;
        Ok(())
    }

    fn find_by_remote_id(
        &self,
        account_id: &AccountId,
        remote_id: &str,
    ) -> DomainResult<Option<Folder>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, account_id, remote_id, name, sort_order FROM folders WHERE account_id = ?1 AND remote_id = ?2",
        )?;
        let mut rows = stmt.query_map(params![account_id.0, remote_id], row_to_folder)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
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
        let repo = SqliteFolderRepository::new(db.writer());

        let folder = Folder {
            id: FolderId::new(),
            account_id: account_id.clone(),
            remote_id: None,
            name: "Tech".to_string(),
            sort_order: 1,
        };
        repo.save(&folder).unwrap();

        let folders = repo.find_by_account(&account_id).unwrap();
        assert_eq!(folders.len(), 1);
        assert_eq!(folders[0].name, "Tech");
    }

    #[test]
    fn delete_sets_feed_folder_id_to_null() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFolderRepository::new(db.writer());

        let folder = Folder {
            id: FolderId::new(),
            account_id: account_id.clone(),
            remote_id: None,
            name: "Tech".to_string(),
            sort_order: 0,
        };
        repo.save(&folder).unwrap();

        // Insert a feed referencing this folder
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, folder_id, title, url) VALUES ('f1', ?1, ?2, 'Feed', 'http://f.com')",
                params![account_id.0, folder.id.0],
            )
            .unwrap();

        repo.delete(&folder.id).unwrap();

        let folder_id: Option<String> = db
            .reader()
            .query_row("SELECT folder_id FROM feeds WHERE id = 'f1'", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert!(folder_id.is_none());
    }

    #[test]
    fn save_updates_existing_folder_without_clearing_feed_assignments() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFolderRepository::new(db.writer());

        let folder = Folder {
            id: FolderId::new(),
            account_id: account_id.clone(),
            remote_id: Some("remote-folder".to_string()),
            name: "Tech".to_string(),
            sort_order: 0,
        };
        repo.save(&folder).unwrap();

        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, folder_id, title, url) VALUES ('f1', ?1, ?2, 'Feed', 'http://f.com')",
                params![account_id.0, folder.id.0],
            )
            .unwrap();

        let updated_folder = Folder {
            name: "Engineering".to_string(),
            sort_order: 2,
            ..folder.clone()
        };
        repo.save(&updated_folder).unwrap();

        let folder_id: Option<String> = db
            .reader()
            .query_row("SELECT folder_id FROM feeds WHERE id = 'f1'", [], |row| {
                row.get(0)
            })
            .unwrap();
        let saved_name: String = db
            .reader()
            .query_row(
                "SELECT name FROM folders WHERE id = ?1",
                params![folder.id.0],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(folder_id.as_deref(), Some(folder.id.0.as_str()));
        assert_eq!(saved_name, "Engineering");
    }

    #[test]
    fn find_by_remote_id_separates_identical_remote_id_by_account() {
        let db = test_db();
        let account_a_id = insert_test_account(&db);
        let account_b_id = insert_test_account(&db);
        let repo = SqliteFolderRepository::new(db.writer());

        let folder_a = Folder {
            id: FolderId::new(),
            account_id: account_a_id.clone(),
            remote_id: Some("remote-folder".to_string()),
            name: "Account A".to_string(),
            sort_order: 0,
        };
        let folder_b = Folder {
            id: FolderId::new(),
            account_id: account_b_id.clone(),
            remote_id: Some("remote-folder".to_string()),
            name: "Account B".to_string(),
            sort_order: 0,
        };
        repo.save(&folder_a).unwrap();
        repo.save(&folder_b).unwrap();

        let found_a = repo
            .find_by_remote_id(&account_a_id, "remote-folder")
            .unwrap()
            .expect("folder for account A should be found");
        let found_b = repo
            .find_by_remote_id(&account_b_id, "remote-folder")
            .unwrap()
            .expect("folder for account B should be found");

        assert_eq!(found_a.id, folder_a.id);
        assert_eq!(found_a.account_id, account_a_id);
        assert_eq!(found_b.id, folder_b.id);
        assert_eq!(found_b.account_id, account_b_id);
    }

    #[test]
    fn find_by_account_ordered_by_sort_order() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFolderRepository::new(db.writer());

        for (name, order) in [("C", 3), ("A", 1), ("B", 2)] {
            let folder = Folder {
                id: FolderId::new(),
                account_id: account_id.clone(),
                remote_id: None,
                name: name.to_string(),
                sort_order: order,
            };
            repo.save(&folder).unwrap();
        }

        let folders = repo.find_by_account(&account_id).unwrap();
        let names: Vec<&str> = folders.iter().map(|f| f.name.as_str()).collect();
        assert_eq!(names, vec!["A", "B", "C"]);
    }

    #[test]
    fn find_by_account_orders_same_sort_order_by_id() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFolderRepository::new(db.writer());

        for (id, name) in [("folder-b", "B"), ("folder-a", "A")] {
            let folder = Folder {
                id: FolderId(id.to_string()),
                account_id: account_id.clone(),
                remote_id: None,
                name: name.to_string(),
                sort_order: 1,
            };
            repo.save(&folder).unwrap();
        }

        let folders = repo.find_by_account(&account_id).unwrap();
        let ids: Vec<&str> = folders.iter().map(|folder| folder.id.0.as_str()).collect();

        assert_eq!(ids, vec!["folder-a", "folder-b"]);
    }
}
