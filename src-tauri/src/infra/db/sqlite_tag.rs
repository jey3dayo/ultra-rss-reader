use rusqlite::{params, Connection};

use crate::domain::article::Article;
use crate::domain::error::DomainResult;
use crate::domain::tag::Tag;
use crate::domain::types::{ArticleId, FeedId, TagId};
use crate::repository::article::Pagination;
use crate::repository::tag::TagRepository;

pub struct SqliteTagRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SqliteTagRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }
}

fn row_to_tag(row: &rusqlite::Row) -> rusqlite::Result<Tag> {
    Ok(Tag {
        id: TagId(row.get(0)?),
        name: row.get(1)?,
        color: row.get(2)?,
    })
}

fn parse_datetime(s: &str) -> chrono::DateTime<chrono::Utc> {
    chrono::DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .unwrap_or_default()
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
        published_at: parse_datetime(&published_at_str),
        is_read: row.get(12)?,
        is_starred: row.get(13)?,
        fetched_at: parse_datetime(&fetched_at_str),
    })
}

const ARTICLE_SELECT_COLS: &str = "a.id, a.feed_id, a.remote_id, a.title, a.content_raw, a.content_sanitized, a.sanitizer_version, a.summary, a.url, a.author, a.thumbnail, a.published_at, a.is_read, a.is_starred, a.fetched_at";

impl TagRepository for SqliteTagRepository<'_> {
    fn find_all(&self) -> DomainResult<Vec<Tag>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, name, color FROM tags ORDER BY name")?;
        let tags = stmt
            .query_map([], row_to_tag)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(tags)
    }

    fn save(&self, tag: &Tag) -> DomainResult<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
            params![tag.id.0, tag.name, tag.color],
        )?;
        Ok(())
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
             WHERE at.article_id = ?1 ORDER BY t.name",
        )?;
        let tags = stmt
            .query_map(params![article_id.0], row_to_tag)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(tags)
    }

    fn tag_article(&self, article_id: &ArticleId, tag_id: &TagId) -> DomainResult<()> {
        self.conn.execute(
            "INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?1, ?2)",
            params![article_id.0, tag_id.0],
        )?;
        Ok(())
    }

    fn untag_article(&self, article_id: &ArticleId, tag_id: &TagId) -> DomainResult<()> {
        self.conn.execute(
            "DELETE FROM article_tags WHERE article_id = ?1 AND tag_id = ?2",
            params![article_id.0, tag_id.0],
        )?;
        Ok(())
    }

    fn find_articles_by_tag(
        &self,
        tag_id: &TagId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>> {
        let sql = format!(
            "SELECT {ARTICLE_SELECT_COLS} FROM articles a \
             JOIN article_tags at ON a.id = at.article_id \
             WHERE at.tag_id = ?1 \
             ORDER BY a.published_at DESC LIMIT ?2 OFFSET ?3"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let articles = stmt
            .query_map(
                params![tag_id.0, pagination.limit as i64, pagination.offset as i64],
                row_to_article,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(articles)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::types::AccountId;
    use crate::infra::db::connection::DbManager;

    fn test_db() -> DbManager {
        DbManager::new_in_memory().unwrap()
    }

    fn insert_test_data(db: &DbManager) -> (AccountId, FeedId, ArticleId) {
        let account_id = AccountId::new();
        let feed_id = FeedId::new();
        let article_id = ArticleId("art-1".to_string());

        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                params![account_id.0, "Local", "Test"],
            )
            .unwrap();

        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, title, url) VALUES (?1, ?2, ?3, ?4)",
                params![feed_id.0, account_id.0, "Feed", "http://f.com"],
            )
            .unwrap();

        let now = chrono::Utc::now().to_rfc3339();
        db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, title, content_raw, content_sanitized, sanitizer_version, published_at, is_read, is_starred, fetched_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![article_id.0, feed_id.0, "Test Article", "", "", 1, now, false, false, now],
            )
            .unwrap();

        (account_id, feed_id, article_id)
    }

    #[test]
    fn save_and_find_all() {
        let db = test_db();
        let repo = SqliteTagRepository::new(db.writer());

        let tag = Tag {
            id: TagId::new(),
            name: "important".to_string(),
            color: Some("#ff0000".to_string()),
        };
        repo.save(&tag).unwrap();

        let tags = repo.find_all().unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].name, "important");
        assert_eq!(tags[0].color, Some("#ff0000".to_string()));
    }

    #[test]
    fn delete_tag() {
        let db = test_db();
        let repo = SqliteTagRepository::new(db.writer());

        let tag = Tag {
            id: TagId::new(),
            name: "temp".to_string(),
            color: None,
        };
        repo.save(&tag).unwrap();
        repo.delete(&tag.id).unwrap();

        let tags = repo.find_all().unwrap();
        assert!(tags.is_empty());
    }

    #[test]
    fn tag_and_untag_article() {
        let db = test_db();
        let (_, _, article_id) = insert_test_data(&db);
        let repo = SqliteTagRepository::new(db.writer());

        let tag = Tag {
            id: TagId::new(),
            name: "read later".to_string(),
            color: None,
        };
        repo.save(&tag).unwrap();
        repo.tag_article(&article_id, &tag.id).unwrap();

        let tags = repo.find_tags_for_article(&article_id).unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].name, "read later");

        repo.untag_article(&article_id, &tag.id).unwrap();
        let tags = repo.find_tags_for_article(&article_id).unwrap();
        assert!(tags.is_empty());
    }

    #[test]
    fn find_articles_by_tag() {
        let db = test_db();
        let (_, _, article_id) = insert_test_data(&db);
        let repo = SqliteTagRepository::new(db.writer());

        let tag = Tag {
            id: TagId::new(),
            name: "work".to_string(),
            color: Some("#0000ff".to_string()),
        };
        repo.save(&tag).unwrap();
        repo.tag_article(&article_id, &tag.id).unwrap();

        let pagination = Pagination {
            offset: 0,
            limit: 50,
        };
        let articles = repo.find_articles_by_tag(&tag.id, &pagination).unwrap();
        assert_eq!(articles.len(), 1);
        assert_eq!(articles[0].title, "Test Article");
    }

    #[test]
    fn tag_article_idempotent() {
        let db = test_db();
        let (_, _, article_id) = insert_test_data(&db);
        let repo = SqliteTagRepository::new(db.writer());

        let tag = Tag {
            id: TagId::new(),
            name: "test".to_string(),
            color: None,
        };
        repo.save(&tag).unwrap();

        // Tagging twice should not error
        repo.tag_article(&article_id, &tag.id).unwrap();
        repo.tag_article(&article_id, &tag.id).unwrap();

        let tags = repo.find_tags_for_article(&article_id).unwrap();
        assert_eq!(tags.len(), 1);
    }

    #[test]
    fn delete_tag_cascades_article_tags() {
        let db = test_db();
        let (_, _, article_id) = insert_test_data(&db);
        let repo = SqliteTagRepository::new(db.writer());

        let tag = Tag {
            id: TagId::new(),
            name: "ephemeral".to_string(),
            color: None,
        };
        repo.save(&tag).unwrap();
        repo.tag_article(&article_id, &tag.id).unwrap();

        repo.delete(&tag.id).unwrap();
        let tags = repo.find_tags_for_article(&article_id).unwrap();
        assert!(tags.is_empty());
    }
}
