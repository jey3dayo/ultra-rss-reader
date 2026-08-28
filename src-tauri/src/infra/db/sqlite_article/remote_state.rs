use std::collections::HashSet;

use rusqlite::params;

use super::SqliteArticleRepository;
use crate::domain::error::DomainResult;
use crate::domain::provider::GREADER_FEED_ID_PREFIX;
use crate::domain::types::AccountId;
use crate::repository::article::ArticleRemoteStateRepository;

impl ArticleRemoteStateRepository for SqliteArticleRepository<'_> {
    fn apply_remote_state(
        &self,
        account_id: &AccountId,
        read_remote_ids: &[String],
        starred_remote_ids: &[String],
        pending_read_remote_ids: &[String],
        pending_starred_remote_ids: &[String],
    ) -> DomainResult<()> {
        let tx = self.conn.unchecked_transaction()?;
        let read_remote_id_set: HashSet<&str> =
            read_remote_ids.iter().map(String::as_str).collect();
        let starred_remote_id_set: HashSet<&str> =
            starred_remote_ids.iter().map(String::as_str).collect();
        let pending_read_remote_id_set: HashSet<&str> =
            pending_read_remote_ids.iter().map(String::as_str).collect();
        let pending_starred_remote_id_set: HashSet<&str> = pending_starred_remote_ids
            .iter()
            .map(String::as_str)
            .collect();

        // Get all articles with remote_id in this account (via feed -> account join)
        let mut stmt = tx.prepare(&format!(
            "SELECT a.id, a.remote_id, a.is_read, a.is_starred FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             WHERE f.account_id = ?1
               AND a.remote_id IS NOT NULL
               AND f.remote_id LIKE '{GREADER_FEED_ID_PREFIX}%'"
        ))?;

        let rows: Vec<(String, String, bool, bool)> = stmt
            .query_map(params![account_id.0], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, bool>(2)?,
                    row.get::<_, bool>(3)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut update_stmt =
            tx.prepare("UPDATE articles SET is_read = ?1, is_starred = ?2 WHERE id = ?3")?;

        for (article_id, remote_id, current_read, current_starred) in &rows {
            let remote_id = remote_id.as_str();
            let is_read = if pending_read_remote_id_set.contains(remote_id) {
                *current_read
            } else {
                read_remote_id_set.contains(remote_id)
            };
            let is_starred = if pending_starred_remote_id_set.contains(remote_id) {
                *current_starred
            } else {
                starred_remote_id_set.contains(remote_id)
            };
            if is_read == *current_read && is_starred == *current_starred {
                continue;
            }
            update_stmt.execute(params![is_read, is_starred, article_id])?;
        }

        drop(update_stmt);
        drop(stmt);
        tx.commit()?;
        Ok(())
    }
}
