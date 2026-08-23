use rusqlite::types::Type;
use rusqlite::{params, Connection};

use crate::domain::article::{Article, ArticleListItem};
use crate::domain::error::{DomainError, DomainResult};
use crate::domain::tag::Tag;
use crate::domain::types::{AccountId, ArticleId, FeedId, TagId};
use crate::infra::db::sqlite_mute_keyword::{
    build_mute_keyword_exclusion_clause, SqliteMuteKeywordRepository,
};
use crate::repository::article::{ArticleListMode, Pagination};
use crate::repository::mute_keyword::MuteKeywordRepository;
use crate::repository::tag::TagRepository;

pub struct SqliteTagRepository<'a> {
    conn: &'a Connection,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OrphanedArticleTag {
    pub article_id: ArticleId,
    pub tag_id: TagId,
}

impl<'a> SqliteTagRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn list_orphaned_article_tags(&self) -> DomainResult<Vec<OrphanedArticleTag>> {
        let mut stmt = self.conn.prepare(
            "SELECT at.article_id, at.tag_id
             FROM article_tags at
             LEFT JOIN articles a ON a.id = at.article_id
             LEFT JOIN tags t ON t.id = at.tag_id
             WHERE a.id IS NULL OR t.id IS NULL
             ORDER BY at.article_id ASC, at.tag_id ASC",
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok(OrphanedArticleTag {
                    article_id: ArticleId(row.get(0)?),
                    tag_id: TagId(row.get(1)?),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn count_orphaned_article_tags(&self) -> DomainResult<i64> {
        let count = self.conn.query_row(
            "SELECT COUNT(*)
             FROM article_tags at
             LEFT JOIN articles a ON a.id = at.article_id
             LEFT JOIN tags t ON t.id = at.tag_id
             WHERE a.id IS NULL OR t.id IS NULL",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }
}

fn row_to_tag(row: &rusqlite::Row) -> rusqlite::Result<Tag> {
    Ok(Tag {
        id: TagId(row.get(0)?),
        name: row.get(1)?,
        color: row.get(2)?,
    })
}

fn parse_datetime(s: &str) -> rusqlite::Result<chrono::DateTime<chrono::Utc>> {
    chrono::DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .map_err(|err| rusqlite::Error::FromSqlConversionFailure(0, Type::Text, Box::new(err)))
}

fn row_to_article(row: &rusqlite::Row) -> rusqlite::Result<Article> {
    let published_at_str: String = row.get(11)?;
    let fetched_at_str: String = row.get(14)?;
    Ok(Article {
        id: ArticleId(row.get(0)?),
        feed_id: FeedId(row.get(1)?),
        remote_id: row.get(2)?,
        title: row.get(3)?,
        content_raw: row.get(4)?,
        content_sanitized: row.get(5)?,
        sanitizer_version: row.get(6)?,
        summary: row.get(7)?,
        url: row.get(8)?,
        author: row.get(9)?,
        thumbnail: row.get(10)?,
        published_at: parse_datetime(&published_at_str)?,
        is_read: row.get(12)?,
        is_starred: row.get(13)?,
        fetched_at: parse_datetime(&fetched_at_str)?,
    })
}

const ARTICLE_SELECT_COLS: &str = "a.id, a.feed_id, a.remote_id, a.title, a.content_raw, a.content_sanitized, a.sanitizer_version, a.summary, a.url, a.author, a.thumbnail, a.published_at, a.is_read, a.is_starred, a.fetched_at";
const ARTICLE_LIST_SELECT_COLS: &str = "a.id, a.feed_id, a.title, a.summary, a.url, a.author, a.published_at, a.thumbnail, a.is_read, a.is_starred";

fn row_to_article_list_item(row: &rusqlite::Row) -> rusqlite::Result<ArticleListItem> {
    let published_at_str: String = row.get(6)?;
    Ok(ArticleListItem {
        id: ArticleId(row.get(0)?),
        feed_id: FeedId(row.get(1)?),
        title: row.get(2)?,
        summary: row.get(3)?,
        url: row.get(4)?,
        author: row.get(5)?,
        published_at: parse_datetime(&published_at_str)?,
        thumbnail: row.get(7)?,
        is_read: row.get(8)?,
        is_starred: row.get(9)?,
    })
}

fn validate_tag_name(name: &str) -> DomainResult<()> {
    if name.trim().is_empty() {
        return Err(DomainError::Validation(
            "tag name cannot be blank".to_string(),
        ));
    }
    Ok(())
}

impl TagRepository for SqliteTagRepository<'_> {
    fn find_all(&self) -> DomainResult<Vec<Tag>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, name, color FROM tags ORDER BY name COLLATE NOCASE")?;
        let tags = stmt
            .query_map([], row_to_tag)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(tags)
    }

    fn find_by_name(&self, name: &str) -> DomainResult<Option<Tag>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, name, color FROM tags WHERE name = ?1 COLLATE NOCASE")?;
        let mut rows = stmt.query_map(params![name], row_to_tag)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    fn save(&self, tag: &Tag) -> DomainResult<()> {
        validate_tag_name(&tag.name)?;

        self.conn.execute(
            "INSERT INTO tags (id, name, color) VALUES (?1, ?2, ?3) \
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color",
            params![tag.id.0, tag.name, tag.color],
        )?;
        Ok(())
    }

    fn find_or_create(&self, tag: &Tag) -> DomainResult<Tag> {
        validate_tag_name(&tag.name)?;

        if let Some(existing) = self.find_by_name(&tag.name)? {
            return Ok(existing);
        }

        self.conn.execute(
            "INSERT OR IGNORE INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
            params![tag.id.0, tag.name, tag.color],
        )?;
        self.find_by_name(&tag.name)?
            .ok_or_else(|| DomainError::Persistence("Failed to find or create tag".into()))
    }

    fn delete(&self, tag_id: &TagId) -> DomainResult<()> {
        self.conn
            .execute("DELETE FROM tags WHERE id = ?1", params![tag_id.0])?;
        Ok(())
    }

    fn find_tags_for_article(&self, article_id: &ArticleId) -> DomainResult<Vec<Tag>> {
        let mut stmt = self.conn.prepare(
            "SELECT t.id, t.name, t.color FROM tags t \
             JOIN article_tags at ON t.id = at.tag_id \
             WHERE at.article_id = ?1 ORDER BY t.name COLLATE NOCASE",
        )?;
        let tags = stmt
            .query_map(params![article_id.0], row_to_tag)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(tags)
    }

    fn tag_article(&self, article_id: &ArticleId, tag_id: &TagId) -> DomainResult<()> {
        let affected_rows = self.conn.execute(
            "INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?1, ?2)",
            params![article_id.0, tag_id.0],
        )?;
        debug_assert!(affected_rows <= 1);
        Ok(())
    }

    fn untag_article(&self, article_id: &ArticleId, tag_id: &TagId) -> DomainResult<()> {
        let affected_rows = self.conn.execute(
            "DELETE FROM article_tags WHERE article_id = ?1 AND tag_id = ?2",
            params![article_id.0, tag_id.0],
        )?;
        debug_assert!(affected_rows <= 1);
        Ok(())
    }

    fn find_articles_by_tag(
        &self,
        tag_id: &TagId,
        pagination: &Pagination,
        account_id: Option<&AccountId>,
        mode: ArticleListMode,
    ) -> DomainResult<Vec<Article>> {
        let mut filters = vec![
            "at.tag_id = ?1".to_string(),
            "(?4 IS NULL OR f.account_id = ?4)".to_string(),
        ];

        if let Some(mode_filter) = mode.sql_filter("a") {
            filters.push(mode_filter);
        }

        if SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            filters.push(build_mute_keyword_exclusion_clause(
                "a.title",
                "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
            ));
        }

        let where_clause = filters.join(" AND ");
        let sql = format!(
            "SELECT {ARTICLE_SELECT_COLS} FROM articles a \
             JOIN article_tags at ON a.id = at.article_id \
             JOIN feeds f ON a.feed_id = f.id \
             WHERE {where_clause} \
             ORDER BY a.published_at DESC, a.fetched_at DESC, a.id DESC LIMIT ?2 OFFSET ?3"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let account_id_param = account_id.map(|aid| aid.0.as_str());
        let articles = stmt
            .query_map(
                params![
                    tag_id.0,
                    pagination.limit as i64,
                    pagination.offset as i64,
                    account_id_param
                ],
                row_to_article,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(articles)
    }

    fn list_articles_by_tag(
        &self,
        tag_id: &TagId,
        pagination: &Pagination,
        account_id: Option<&AccountId>,
        mode: ArticleListMode,
    ) -> DomainResult<Vec<ArticleListItem>> {
        let mut filters = vec![
            "at.tag_id = ?1".to_string(),
            "(?4 IS NULL OR f.account_id = ?4)".to_string(),
        ];

        if let Some(mode_filter) = mode.sql_filter("a") {
            filters.push(mode_filter);
        }

        if SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            filters.push(build_mute_keyword_exclusion_clause(
                "a.title",
                "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
            ));
        }

        let where_clause = filters.join(" AND ");
        let sql = format!(
            "SELECT {ARTICLE_LIST_SELECT_COLS} FROM articles a \
             JOIN article_tags at ON a.id = at.article_id \
             JOIN feeds f ON a.feed_id = f.id \
             WHERE {where_clause} \
             ORDER BY a.published_at DESC, a.fetched_at DESC, a.id DESC LIMIT ?2 OFFSET ?3"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let account_id_param = account_id.map(|aid| aid.0.as_str());
        let articles = stmt
            .query_map(
                params![
                    tag_id.0,
                    pagination.limit as i64,
                    pagination.offset as i64,
                    account_id_param
                ],
                row_to_article_list_item,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(articles)
    }

    fn count_articles_per_tag(
        &self,
        account_id: Option<&AccountId>,
    ) -> DomainResult<Vec<(TagId, usize)>> {
        let mut filters = vec!["(?1 IS NULL OR f.account_id = ?1)".to_string()];

        if SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            filters.push(build_mute_keyword_exclusion_clause(
                "a.title",
                "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
            ));
        }

        let where_clause = filters.join(" AND ");
        let sql = format!(
            "SELECT at.tag_id, COUNT(*) FROM article_tags at \
             JOIN articles a ON at.article_id = a.id \
             JOIN feeds f ON a.feed_id = f.id \
             WHERE {where_clause} \
             GROUP BY at.tag_id"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let account_id_param = account_id.map(|aid| aid.0.as_str());
        let counts = stmt
            .query_map(params![account_id_param], |row| {
                let tag_id: String = row.get(0)?;
                let count: i64 = row.get(1)?;
                Ok((TagId(tag_id), count as usize))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(counts)
    }
}

#[cfg(test)]
mod tests;
