use chrono::{DateTime, Utc};
use rusqlite::{params, OptionalExtension};

use super::{article_body_text, row_to_article, SqliteArticleRepository, SELECT_COLS};
use crate::domain::article::Article;
use crate::domain::error::DomainResult;
use crate::domain::types::{AccountId, ArticleId};
use crate::repository::article::ArticleMaintenanceRepository;

impl ArticleMaintenanceRepository for SqliteArticleRepository<'_> {
    fn purge_old_read(&self, account_id: &AccountId, before: DateTime<Utc>) -> DomainResult<u64> {
        let deleted = self.conn.execute(
            "DELETE FROM articles
             WHERE is_read = 1
               AND is_starred = 0
               AND fetched_at < ?1
               AND feed_id IN (SELECT id FROM feeds WHERE account_id = ?2)
               AND NOT EXISTS (
                 SELECT 1 FROM article_tags at WHERE at.article_id = articles.id
               )
               AND NOT EXISTS (
                 SELECT 1
                 FROM article_view_history h
                 WHERE h.account_id = ?2
                   AND h.article_id = articles.id
               )
               AND EXISTS (
                 SELECT 1
                 FROM articles newer
                 WHERE newer.feed_id = articles.feed_id
                   AND (
                     newer.published_at > articles.published_at
                     OR (
                       newer.published_at = articles.published_at
                       AND newer.fetched_at > articles.fetched_at
                     )
                     OR (
                       newer.published_at = articles.published_at
                       AND newer.fetched_at = articles.fetched_at
                       AND newer.id > articles.id
                     )
                   )
               )",
            params![before.to_rfc3339(), account_id.0],
        )?;
        Ok(deleted as u64)
    }

    fn update_sanitized(&self, id: &ArticleId, sanitized: &str, version: u32) -> DomainResult<()> {
        let summary = self
            .conn
            .query_row(
                "SELECT summary FROM articles WHERE id = ?1",
                params![id.0],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()?
            .flatten();
        self.conn.execute(
            "UPDATE articles
             SET content_sanitized = ?1,
                 content_text = ?2,
                 sanitizer_version = ?3
             WHERE id = ?4",
            params![
                sanitized,
                article_body_text(sanitized, summary.as_deref()),
                version,
                id.0
            ],
        )?;
        Ok(())
    }

    fn find_by_sanitizer_version_below(
        &self,
        version: u32,
        limit: usize,
    ) -> DomainResult<Vec<Article>> {
        let sql = format!(
            "SELECT {SELECT_COLS} FROM articles
             WHERE sanitizer_version < ?1
             ORDER BY sanitizer_version ASC, fetched_at ASC, id ASC
             LIMIT ?2"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let articles = stmt
            .query_map(params![version, limit as i64], row_to_article)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(articles)
    }
}
