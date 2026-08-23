use rusqlite::{params, Connection, OptionalExtension};

use crate::domain::error::{DomainError, DomainResult};
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

    fn normalize_name_case_before_unique_index(&self) -> DomainResult<()> {
        let duplicate_groups = {
            let mut stmt = self.conn.prepare(
                "SELECT account_id, lower(name), remote_id IS NULL
                 FROM folders
                 GROUP BY account_id, lower(name), remote_id IS NULL
                 HAVING COUNT(*) > 1",
            )?;
            let rows = stmt.query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)? != 0,
                ))
            })?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        if duplicate_groups.is_empty() {
            return Ok(());
        }

        let tx = self.conn.unchecked_transaction()?;
        for (account_id, name_key, local_only) in duplicate_groups {
            let duplicate_folders = {
                let mut stmt = tx.prepare(
                    "SELECT folders.id, folders.remote_id, folders.sort_order, COUNT(feeds.id) AS feed_count
                     FROM folders
                     LEFT JOIN feeds ON feeds.folder_id = folders.id
                     WHERE folders.account_id = ?1
                       AND lower(folders.name) = ?2
                       AND (folders.remote_id IS NULL) = ?3
                     GROUP BY folders.id, folders.remote_id, folders.sort_order
                     ORDER BY feed_count DESC, folders.sort_order, folders.id",
                )?;
                let rows = stmt.query_map(params![account_id, name_key, local_only], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, i32>(2)?,
                    ))
                })?;
                rows.collect::<Result<Vec<_>, _>>()?
            };

            let Some((canonical_id, canonical_remote_id, _)) = duplicate_folders.first() else {
                continue;
            };
            let replacement_remote_id = canonical_remote_id.clone().or_else(|| {
                duplicate_folders
                    .iter()
                    .find_map(|(_, remote_id, _)| remote_id.clone())
            });

            for (duplicate_id, _, _) in duplicate_folders.iter().skip(1) {
                tx.execute(
                    "UPDATE feeds SET folder_id = ?1 WHERE folder_id = ?2",
                    params![canonical_id, duplicate_id],
                )?;
                tx.execute("DELETE FROM folders WHERE id = ?1", params![duplicate_id])?;
            }

            if replacement_remote_id != *canonical_remote_id {
                tx.execute(
                    "UPDATE folders SET remote_id = ?1 WHERE id = ?2",
                    params![replacement_remote_id, canonical_id],
                )?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    fn normalize_sort_order_before_unique_index(&self) -> DomainResult<()> {
        let duplicate_account_ids = {
            let mut stmt = self.conn.prepare(
                "SELECT account_id
                 FROM folders
                 GROUP BY account_id, sort_order
                 HAVING COUNT(*) > 1",
            )?;
            let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        if duplicate_account_ids.is_empty() {
            return Ok(());
        }

        let tx = self.conn.unchecked_transaction()?;
        for account_id in duplicate_account_ids {
            let folder_ids = {
                let mut stmt = tx.prepare(
                    "SELECT id FROM folders WHERE account_id = ?1 ORDER BY sort_order, id",
                )?;
                let rows = stmt.query_map(params![account_id], |row| row.get::<_, String>(0))?;
                rows.collect::<Result<Vec<_>, _>>()?
            };

            for (sort_order, folder_id) in folder_ids.iter().enumerate() {
                tx.execute(
                    "UPDATE folders SET sort_order = ?1 WHERE id = ?2",
                    params![sort_order as i32, folder_id],
                )?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    fn ensure_order_contract(&self) -> DomainResult<()> {
        self.normalize_name_case_before_unique_index()?;
        self.normalize_sort_order_before_unique_index()?;
        self.conn.execute_batch(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_account_sort_order_unique
               ON folders(account_id, sort_order);
             CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_account_name_nocase_unique
               ON folders(account_id, lower(name)) WHERE remote_id IS NOT NULL;
             CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_account_local_name_nocase_unique
               ON folders(account_id, lower(name)) WHERE remote_id IS NULL;",
        )?;
        Ok(())
    }

    fn ensure_name_case_contract(&self, folder: &Folder) -> DomainResult<()> {
        let incoming_name_key = folder_name_case_key(&folder.name);
        let mut stmt = self.conn.prepare(
            "SELECT id, name, remote_id FROM folders WHERE account_id = ?1 AND id != ?2",
        )?;
        let existing_folders = stmt
            .query_map(params![folder.account_id.0, folder.id.0], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        if existing_folders.iter().any(|(_, name, remote_id)| {
            remote_id.is_some() == folder.remote_id.is_some()
                && folder_name_case_key(name) == incoming_name_key
        }) {
            return Err(crate::domain::error::DomainError::Validation(format!(
                "Folder name already exists for account: {}",
                folder.name
            )));
        }

        Ok(())
    }

    pub fn detach_feeds_and_delete(&self, id: &FolderId) -> DomainResult<()> {
        self.detach_feeds_and_delete_many(std::slice::from_ref(id))
    }

    pub fn detach_feeds_and_delete_many(&self, ids: &[FolderId]) -> DomainResult<()> {
        if ids.is_empty() {
            return Ok(());
        }

        self.ensure_order_contract()?;
        let tx = self.conn.unchecked_transaction()?;
        let mut account_id: Option<String> = None;
        for id in ids {
            let folder_account_id = tx
                .query_row(
                    "SELECT account_id FROM folders WHERE id = ?1",
                    params![id.0],
                    |row| row.get::<_, String>(0),
                )
                .optional()?;
            let Some(folder_account_id) = folder_account_id else {
                continue;
            };

            if let Some(expected_account_id) = account_id.as_ref() {
                if expected_account_id != &folder_account_id {
                    return Err(DomainError::Validation(
                        "folders must belong to the same account for batch deletion".to_string(),
                    ));
                }
            } else {
                account_id = Some(folder_account_id);
            }

            tx.execute(
                "UPDATE feeds SET folder_id = NULL WHERE folder_id = ?1",
                params![id.0],
            )?;
            tx.execute("DELETE FROM folders WHERE id = ?1", params![id.0])?;
        }

        if let Some(account_id) = account_id {
            let folder_ids = {
                let mut stmt = tx.prepare(
                    "SELECT id FROM folders WHERE account_id = ?1 ORDER BY sort_order, id",
                )?;
                let folder_ids = stmt
                    .query_map(params![account_id], |row| row.get::<_, String>(0))?
                    .collect::<Result<Vec<_>, _>>()?;
                folder_ids
            };

            for (sort_order, folder_id) in folder_ids.iter().enumerate() {
                tx.execute(
                    "UPDATE folders SET sort_order = ?1 WHERE id = ?2",
                    params![sort_order as i32, folder_id],
                )?;
            }
        }

        tx.commit()?;
        Ok(())
    }
}

fn folder_name_case_key(name: &str) -> String {
    name.trim().to_lowercase()
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
        self.ensure_order_contract()?;
        let mut stmt = self.conn.prepare(
            "SELECT id, account_id, remote_id, name, sort_order FROM folders WHERE account_id = ?1 ORDER BY sort_order, id",
        )?;
        let folders = stmt
            .query_map(params![account_id.0], row_to_folder)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(folders)
    }

    fn save(&self, folder: &Folder) -> DomainResult<()> {
        self.ensure_order_contract()?;
        self.ensure_name_case_contract(folder)?;
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
        self.detach_feeds_and_delete(id)
    }

    fn find_by_remote_id(
        &self,
        account_id: &AccountId,
        remote_id: &str,
    ) -> DomainResult<Option<Folder>> {
        self.ensure_order_contract()?;
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
mod tests;
