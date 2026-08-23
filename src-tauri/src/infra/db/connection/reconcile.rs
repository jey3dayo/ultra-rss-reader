use std::time::Instant;

use crate::domain::error::DomainResult;
use crate::infra::db::sqlite_mute_keyword::build_mute_keyword_exclusion_clause;
use crate::infra::sanitizer;

use super::{
    DbManager, ARTICLES_FTS_TRIGGER_COUNT, ARTICLES_FTS_TRIGGER_SQL_MARKER,
    STARTUP_SANITIZER_REPAIR_BATCH_LIMIT,
};

impl DbManager {
    pub(super) fn reconcile_startup_migration_cost(&self) -> DomainResult<()> {
        let started_at = Instant::now();
        let repaired_article_sanitizer_rows = self.reconcile_article_sanitizer_version()?;
        let repaired_article_content_rows = self.reconcile_article_content_text()?;
        let rebuilt_articles_fts = self.reconcile_articles_fts_contract()?;
        let repaired_feed_unread_count_rows = self.reconcile_feed_unread_counts()?;
        let elapsed_ms = started_at.elapsed().as_millis() as u64;

        tracing::info!(
            repaired_article_sanitizer_rows,
            repaired_article_content_rows,
            rebuilt_articles_fts,
            repaired_feed_unread_count_rows,
            elapsed_ms,
            "Measured startup migration repair cost"
        );

        Ok(())
    }

    fn reconcile_article_sanitizer_version(&self) -> DomainResult<usize> {
        let has_sanitizer_version: bool = self.writer.query_row(
            "SELECT EXISTS(
                 SELECT 1
                 FROM pragma_table_info('articles')
                 WHERE name = 'sanitizer_version'
             )",
            [],
            |row| row.get(0),
        )?;
        let has_content_text: bool = self.writer.query_row(
            "SELECT EXISTS(
                 SELECT 1
                 FROM pragma_table_info('articles')
                 WHERE name = 'content_text'
             )",
            [],
            |row| row.get(0),
        )?;
        if !has_sanitizer_version || !has_content_text {
            return Ok(0);
        }

        let mut stmt = self.writer.prepare(
            "SELECT id, content_raw, content_sanitized, summary
             FROM articles
             WHERE sanitizer_version < ?1
             ORDER BY sanitizer_version ASC, fetched_at ASC, id ASC
             LIMIT ?2",
        )?;
        let pending = stmt
            .query_map(
                rusqlite::params![
                    sanitizer::SANITIZER_VERSION,
                    STARTUP_SANITIZER_REPAIR_BATCH_LIMIT as i64
                ],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, Option<String>>(3)?,
                    ))
                },
            )?
            .collect::<Result<Vec<_>, _>>()?;
        let repaired_rows = pending.len();

        if pending.is_empty() {
            return Ok(0);
        }

        let tx = self.writer.unchecked_transaction()?;
        {
            let mut update = tx.prepare(
                "UPDATE articles
                 SET content_sanitized = ?1,
                     content_text = ?2,
                     sanitizer_version = ?3
                 WHERE id = ?4",
            )?;
            for (id, content_raw, existing_sanitized, summary) in pending {
                let content_source = if content_raw.trim().is_empty() {
                    existing_sanitized.as_str()
                } else {
                    content_raw.as_str()
                };
                let content_sanitized = sanitizer::sanitize_html(content_source);
                let content_text = super::super::sqlite_article::article_body_text(
                    &content_sanitized,
                    summary.as_deref(),
                );
                update.execute(rusqlite::params![
                    content_sanitized,
                    content_text,
                    sanitizer::SANITIZER_VERSION,
                    id
                ])?;
            }
        }
        tx.commit()?;
        Ok(repaired_rows)
    }

    pub(super) fn reconcile_feed_unread_counts(&self) -> DomainResult<usize> {
        let has_mute_keywords_table: bool = self.writer.query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'mute_keywords')",
            [],
            |row| row.get(0),
        )?;
        let visible_unread_clause = if has_mute_keywords_table {
            build_mute_keyword_exclusion_clause(
                "articles.title",
                "CASE WHEN trim(coalesce(articles.content_text, '')) = '' THEN coalesce(articles.summary, '') ELSE articles.content_text END",
            )
        } else {
            "1 = 1".to_string()
        };
        let count_visible_unread = format!(
            "SELECT COUNT(*)
             FROM articles
             WHERE articles.feed_id = feeds.id
               AND articles.is_read = 0
               AND {visible_unread_clause}"
        );
        let sql = format!(
            "UPDATE feeds
             SET unread_count = ({count_visible_unread})
             WHERE unread_count != ({count_visible_unread})"
        );
        let updated_rows = self.writer.execute(&sql, [])?;

        if updated_rows > 0 {
            tracing::info!("Reconciled unread counts for {updated_rows} feed(s) on startup");
        }

        Ok(updated_rows)
    }

    pub(super) fn reconcile_article_content_text(&self) -> DomainResult<usize> {
        let has_content_text: i32 = self.writer.query_row(
            "SELECT COUNT(*)
             FROM pragma_table_info('articles')
             WHERE name = 'content_text'",
            [],
            |row| row.get(0),
        )?;
        if has_content_text == 0 {
            return Ok(0);
        }

        let mut stmt = self.writer.prepare(
            "SELECT id, content_sanitized, summary
             FROM articles
             WHERE trim(coalesce(content_text, '')) = ''",
        )?;

        let pending = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        let repaired_rows = pending.len();

        if pending.is_empty() {
            return Ok(0);
        }

        let tx = self.writer.unchecked_transaction()?;
        {
            let mut update = tx.prepare("UPDATE articles SET content_text = ?1 WHERE id = ?2")?;
            for (id, content_sanitized, summary) in pending {
                let content_text = super::super::sqlite_article::article_body_text(
                    &content_sanitized,
                    summary.as_deref(),
                );
                update.execute(rusqlite::params![content_text, id])?;
            }
        }
        tx.commit()?;
        Ok(repaired_rows)
    }

    fn reconcile_articles_fts_contract(&self) -> DomainResult<bool> {
        let has_articles_fts: bool = self.writer.query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'articles_fts')",
            [],
            |row| row.get(0),
        )?;
        let has_content_text: bool = self.writer.query_row(
            "SELECT EXISTS(
                 SELECT 1
                 FROM pragma_table_info('articles')
                 WHERE name = 'content_text'
             )",
            [],
            |row| row.get(0),
        )?;
        if !has_articles_fts || !has_content_text {
            return Ok(false);
        }

        let trigger_contract_ok: bool = self.writer.query_row(
            "SELECT COUNT(*) = ?1
             FROM sqlite_master
             WHERE type = 'trigger'
               AND name IN ('articles_ai', 'articles_ad', 'articles_au')
               AND sql LIKE '%' || ?2 || '%'",
            rusqlite::params![ARTICLES_FTS_TRIGGER_COUNT, ARTICLES_FTS_TRIGGER_SQL_MARKER],
            |row| row.get(0),
        )?;

        if trigger_contract_ok {
            return Ok(false);
        }

        self.writer.execute_batch(
            "DROP TRIGGER IF EXISTS articles_ai;
             DROP TRIGGER IF EXISTS articles_ad;
             DROP TRIGGER IF EXISTS articles_au;

             CREATE TRIGGER articles_ai AFTER INSERT ON articles BEGIN
               INSERT INTO articles_fts(rowid, title, content_sanitized)
                 VALUES (new.rowid, new.title, new.content_text);
             END;

             CREATE TRIGGER articles_ad AFTER DELETE ON articles BEGIN
               INSERT INTO articles_fts(articles_fts, rowid, title, content_sanitized)
                 VALUES ('delete', old.rowid, old.title, old.content_text);
             END;

             CREATE TRIGGER articles_au AFTER UPDATE OF title, content_text ON articles BEGIN
               INSERT INTO articles_fts(articles_fts, rowid, title, content_sanitized)
                 VALUES ('delete', old.rowid, old.title, old.content_text);
               INSERT INTO articles_fts(rowid, title, content_sanitized)
                 VALUES (new.rowid, new.title, new.content_text);
             END;

             INSERT INTO articles_fts(articles_fts) VALUES ('delete-all');
             INSERT INTO articles_fts(rowid, title, content_sanitized)
               SELECT rowid, title, content_text FROM articles;",
        )?;
        Ok(true)
    }
}
