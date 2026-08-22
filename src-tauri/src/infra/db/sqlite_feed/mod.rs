use rusqlite::{params, Connection};

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::feed::Feed;
use crate::domain::types::{AccountId, FeedId, FolderId};
use crate::infra::db::sqlite_mute_keyword::{
    build_mute_keyword_exclusion_clause, SqliteMuteKeywordRepository,
};
use crate::repository::feed::FeedRepository;
use crate::repository::mute_keyword::MuteKeywordRepository;
use crate::repository::sync_state::SyncStateScopeKey;

mod mapping;
#[cfg(test)]
mod tests;
mod unread;

use mapping::{normalize_unread_count, row_to_feed};
pub(crate) use unread::{
    recalculate_unread_count_with_conn, recalculate_unread_counts_with_conn,
    unread_counts_for_feed_ids_with_conn,
};

pub struct SqliteFeedRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SqliteFeedRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    fn validate_display_mode(name: &str, mode: &str) -> DomainResult<()> {
        if matches!(mode, "inherit" | "on" | "off") {
            Ok(())
        } else {
            Err(DomainError::Validation(format!(
                "invalid feed {name}: {mode}"
            )))
        }
    }

    fn validate_display_modes(reader_mode: &str, web_preview_mode: &str) -> DomainResult<()> {
        Self::validate_display_mode("reader mode", reader_mode)?;
        Self::validate_display_mode("web preview mode", web_preview_mode)
    }

    fn validate_folder_account(&self, feed: &Feed) -> DomainResult<()> {
        let Some(folder_id) = &feed.folder_id else {
            return Ok(());
        };

        let belongs_to_account: bool = self.conn.query_row(
            "SELECT EXISTS(
                SELECT 1
                  FROM folders
                 WHERE id = ?1
                   AND account_id = ?2
            )",
            params![folder_id.0, feed.account_id.0],
            |row| row.get::<_, i64>(0).map(|exists| exists != 0),
        )?;

        if !belongs_to_account {
            return Err(DomainError::Validation(
                "feed folder does not belong to feed account".to_string(),
            ));
        }

        Ok(())
    }
}

const SELECT_COLS: &str = "id, account_id, folder_id, remote_id, title, url, site_url, icon, icon_url, unread_count, reader_mode, web_preview_mode";

impl FeedRepository for SqliteFeedRepository<'_> {
    fn find_by_account(&self, account_id: &AccountId) -> DomainResult<Vec<Feed>> {
        let sql = if !SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            format!(
                "SELECT {SELECT_COLS} FROM feeds WHERE account_id = ?1 ORDER BY title COLLATE NOCASE, id"
            )
        } else {
            let mute_clause = build_mute_keyword_exclusion_clause(
                "a.title",
                "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
            );
            format!(
                "SELECT
                    f.id,
                    f.account_id,
                    f.folder_id,
                    f.remote_id,
                    f.title,
                    f.url,
                    f.site_url,
                    f.icon,
                    f.icon_url,
                    (
                        SELECT COUNT(*)
                        FROM articles a
                        WHERE a.feed_id = f.id
                          AND a.is_read = 0
                          AND {mute_clause}
                    ) AS unread_count,
                    f.reader_mode,
                    f.web_preview_mode
                 FROM feeds f
                 WHERE f.account_id = ?1
                 ORDER BY f.title COLLATE NOCASE, f.id"
            )
        };
        let mut stmt = self.conn.prepare(&sql)?;
        let feeds = stmt
            .query_map(params![account_id.0], row_to_feed)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(feeds)
    }

    fn find_by_id(&self, feed_id: &FeedId) -> DomainResult<Option<Feed>> {
        let sql = format!("SELECT {SELECT_COLS} FROM feeds WHERE id = ?1");
        let mut stmt = self.conn.prepare(&sql)?;
        let mut rows = stmt.query_map(params![feed_id.0], row_to_feed)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    fn save(&self, feed: &Feed) -> DomainResult<()> {
        self.validate_folder_account(feed)?;
        Self::validate_display_modes(&feed.reader_mode, &feed.web_preview_mode)?;

        self.conn.execute(
            "INSERT INTO feeds (id, account_id, folder_id, remote_id, title, url, site_url, icon, icon_url, unread_count, reader_mode, web_preview_mode)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
             ON CONFLICT(id) DO UPDATE SET
               folder_id = excluded.folder_id,
               remote_id = excluded.remote_id,
               title = excluded.title,
               url = excluded.url,
               site_url = excluded.site_url,
               icon = excluded.icon,
               icon_url = excluded.icon_url,
               unread_count = excluded.unread_count,
               reader_mode = excluded.reader_mode,
               web_preview_mode = excluded.web_preview_mode
             ON CONFLICT(account_id, url) DO UPDATE SET
               folder_id = excluded.folder_id,
               remote_id = CASE
                 WHEN excluded.remote_id IS NULL THEN NULL
                 WHEN NOT EXISTS (
                   SELECT 1
                     FROM feeds AS conflicting_remote
                    WHERE conflicting_remote.account_id = feeds.account_id
                      AND conflicting_remote.remote_id = excluded.remote_id
                      AND conflicting_remote.id <> feeds.id
                 ) THEN excluded.remote_id
                 ELSE feeds.remote_id
               END,
               title = excluded.title,
               site_url = excluded.site_url,
               icon = excluded.icon,
               icon_url = excluded.icon_url,
               unread_count = excluded.unread_count
             ON CONFLICT(account_id, remote_id) DO UPDATE SET
               folder_id = excluded.folder_id,
               url = excluded.url,
               icon = excluded.icon,
               icon_url = excluded.icon_url,
               unread_count = excluded.unread_count",
            params![
                feed.id.0,
                feed.account_id.0,
                feed.folder_id.as_ref().map(|f| &f.0),
                feed.remote_id,
                feed.title,
                feed.url,
                feed.site_url,
                feed.icon,
                feed.icon_url,
                normalize_unread_count(i64::from(feed.unread_count)),
                feed.reader_mode,
                feed.web_preview_mode,
            ],
        )?;
        Ok(())
    }

    fn update_unread_count(&self, feed_id: &FeedId, count: i32) -> DomainResult<()> {
        self.conn.execute(
            "UPDATE feeds SET unread_count = ?1 WHERE id = ?2",
            params![normalize_unread_count(i64::from(count)), feed_id.0],
        )?;
        Ok(())
    }

    fn recalculate_unread_count(&self, feed_id: &FeedId) -> DomainResult<i32> {
        recalculate_unread_count_with_conn(self.conn, feed_id)
    }

    fn recalculate_unread_counts(&self, feed_ids: &[FeedId]) -> DomainResult<()> {
        recalculate_unread_counts_with_conn(self.conn, feed_ids)
    }

    fn find_by_remote_id(
        &self,
        account_id: &AccountId,
        remote_id: &str,
    ) -> DomainResult<Option<Feed>> {
        let sql =
            format!("SELECT {SELECT_COLS} FROM feeds WHERE account_id = ?1 AND remote_id = ?2");
        let mut stmt = self.conn.prepare(&sql)?;
        let mut rows = stmt.query_map(params![account_id.0, remote_id], row_to_feed)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    fn find_by_url(&self, account_id: &AccountId, url: &str) -> DomainResult<Option<Feed>> {
        let sql = format!("SELECT {SELECT_COLS} FROM feeds WHERE account_id = ?1 AND url = ?2");
        let mut stmt = self.conn.prepare(&sql)?;
        let mut rows = stmt.query_map(params![account_id.0, url], row_to_feed)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    fn delete(&self, feed_id: &FeedId) -> DomainResult<()> {
        let feed = self.find_by_id(feed_id)?;
        let affected_rows = self
            .conn
            .execute("DELETE FROM feeds WHERE id = ?1", params![feed_id.0])?;
        if affected_rows == 0 {
            return Err(DomainError::Validation("feed not found".to_string()));
        }
        if let Some(feed) = feed {
            self.conn.execute(
                "DELETE FROM sync_state WHERE account_id = ?1 AND scope_key = ?2",
                params![
                    feed.account_id.0,
                    SyncStateScopeKey::local_feed(feed.url).as_string()
                ],
            )?;
        }
        Ok(())
    }

    fn rename(&self, feed_id: &FeedId, title: &str) -> DomainResult<()> {
        let affected_rows = self.conn.execute(
            "UPDATE feeds SET title = ?1 WHERE id = ?2",
            params![title, feed_id.0],
        )?;
        if affected_rows == 0 {
            return Err(DomainError::Validation("feed not found".to_string()));
        }
        Ok(())
    }

    fn update_folder(&self, feed_id: &FeedId, folder_id: Option<&FolderId>) -> DomainResult<()> {
        let affected_rows = self.conn.execute(
            "UPDATE feeds
             SET folder_id = ?1
             WHERE id = ?2
               AND (
                 ?1 IS NULL
                 OR EXISTS (
                   SELECT 1
                   FROM folders
                   WHERE folders.id = ?1
                     AND folders.account_id = feeds.account_id
                 )
               )",
            params![folder_id.map(|f| &f.0), feed_id.0],
        )?;
        if affected_rows == 0 {
            return Err(DomainError::Validation(
                "feed not found or folder does not belong to feed account".to_string(),
            ));
        }
        Ok(())
    }

    fn update_display_settings(
        &self,
        feed_id: &FeedId,
        reader_mode: &str,
        web_preview_mode: &str,
    ) -> DomainResult<()> {
        Self::validate_display_modes(reader_mode, web_preview_mode)?;

        let affected_rows = self.conn.execute(
            "UPDATE feeds SET reader_mode = ?1, web_preview_mode = ?2 WHERE id = ?3",
            params![reader_mode, web_preview_mode, feed_id.0],
        )?;
        if affected_rows == 0 {
            return Err(DomainError::Validation("feed not found".to_string()));
        }
        Ok(())
    }
}
