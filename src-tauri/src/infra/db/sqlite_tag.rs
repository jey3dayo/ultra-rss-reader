use rusqlite::{params, Connection};

use crate::domain::article::Article;
use crate::domain::error::{DomainError, DomainResult};
use crate::domain::tag::Tag;
use crate::domain::types::{AccountId, ArticleId, FeedId, TagId};
use crate::infra::db::sqlite_mute_keyword::{
    build_mute_keyword_exclusion_clause, SqliteMuteKeywordRepository,
};
use crate::repository::article::Pagination;
use crate::repository::mute_keyword::MuteKeywordRepository;
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
        self.conn.execute(
            "INSERT INTO tags (id, name, color) VALUES (?1, ?2, ?3) \
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color",
            params![tag.id.0, tag.name, tag.color],
        )?;
        Ok(())
    }

    fn find_or_create(&self, tag: &Tag) -> DomainResult<Tag> {
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
        account_id: Option<&AccountId>,
    ) -> DomainResult<Vec<Article>> {
        if !SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            let sql = match account_id {
                Some(_) => format!(
                    "SELECT {ARTICLE_SELECT_COLS} FROM articles a \
                     JOIN article_tags at ON a.id = at.article_id \
                     JOIN feeds f ON a.feed_id = f.id \
                     WHERE at.tag_id = ?1 AND f.account_id = ?4 \
                     ORDER BY a.published_at DESC LIMIT ?2 OFFSET ?3"
                ),
                None => format!(
                    "SELECT {ARTICLE_SELECT_COLS} FROM articles a \
                     JOIN article_tags at ON a.id = at.article_id \
                     WHERE at.tag_id = ?1 \
                     ORDER BY a.published_at DESC LIMIT ?2 OFFSET ?3"
                ),
            };
            let mut stmt = self.conn.prepare(&sql)?;
            let articles = match account_id {
                Some(aid) => stmt
                    .query_map(
                        params![
                            tag_id.0,
                            pagination.limit as i64,
                            pagination.offset as i64,
                            aid.0
                        ],
                        row_to_article,
                    )?
                    .collect::<Result<Vec<_>, _>>()?,
                None => stmt
                    .query_map(
                        params![tag_id.0, pagination.limit as i64, pagination.offset as i64],
                        row_to_article,
                    )?
                    .collect::<Result<Vec<_>, _>>()?,
            };
            return Ok(articles);
        }

        let sql = match account_id {
            Some(_) => format!(
                "SELECT {ARTICLE_SELECT_COLS} FROM articles a \
                 JOIN article_tags at ON a.id = at.article_id \
                 JOIN feeds f ON a.feed_id = f.id \
                 WHERE at.tag_id = ?1 AND f.account_id = ?2 \
                   AND {} \
                 ORDER BY a.published_at DESC LIMIT ?3 OFFSET ?4",
                build_mute_keyword_exclusion_clause(
                    "a.title",
                    "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
                )
            ),
            None => format!(
                "SELECT {ARTICLE_SELECT_COLS} FROM articles a \
                 JOIN article_tags at ON a.id = at.article_id \
                 WHERE at.tag_id = ?1 \
                   AND {} \
                 ORDER BY a.published_at DESC LIMIT ?2 OFFSET ?3",
                build_mute_keyword_exclusion_clause(
                    "a.title",
                    "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
                )
            ),
        };
        let mut stmt = self.conn.prepare(&sql)?;
        let articles = match account_id {
            Some(aid) => stmt
                .query_map(
                    params![
                        tag_id.0,
                        aid.0,
                        pagination.limit as i64,
                        pagination.offset as i64
                    ],
                    row_to_article,
                )?
                .collect::<Result<Vec<_>, _>>()?,
            None => stmt
                .query_map(
                    params![tag_id.0, pagination.limit as i64, pagination.offset as i64],
                    row_to_article,
                )?
                .collect::<Result<Vec<_>, _>>()?,
        };
        Ok(articles)
    }

    fn count_articles_per_tag(
        &self,
        account_id: Option<&AccountId>,
    ) -> DomainResult<Vec<(TagId, usize)>> {
        let (sql, use_account) = match account_id {
            Some(_) => (
                "SELECT at.tag_id, COUNT(*) FROM article_tags at \
                 JOIN articles a ON at.article_id = a.id \
                 JOIN feeds f ON a.feed_id = f.id \
                 WHERE f.account_id = ?1 \
                 GROUP BY at.tag_id",
                true,
            ),
            None => (
                "SELECT tag_id, COUNT(*) FROM article_tags GROUP BY tag_id",
                false,
            ),
        };
        let mut stmt = self.conn.prepare(sql)?;
        let counts = if use_account {
            stmt.query_map(params![account_id.unwrap().0], |row| {
                let tag_id: String = row.get(0)?;
                let count: i64 = row.get(1)?;
                Ok((TagId(tag_id), count as usize))
            })?
            .collect::<Result<Vec<_>, _>>()?
        } else {
            stmt.query_map([], |row| {
                let tag_id: String = row.get(0)?;
                let count: i64 = row.get(1)?;
                Ok((TagId(tag_id), count as usize))
            })?
            .collect::<Result<Vec<_>, _>>()?
        };
        Ok(counts)
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

    fn insert_mute_keyword(db: &DbManager, keyword: &str, scope: &str) {
        let now = chrono::Utc::now().to_rfc3339();
        db.writer()
            .execute(
                "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![uuid::Uuid::new_v4().to_string(), keyword, scope, now, now],
            )
            .unwrap();
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
    fn find_all_sorts_tags_by_name_case_insensitively() {
        let db = test_db();
        let repo = SqliteTagRepository::new(db.writer());

        for name in ["Red", "news", "Fav", "Gray"] {
            repo.save(&Tag {
                id: TagId::new(),
                name: name.to_string(),
                color: None,
            })
            .unwrap();
        }

        let names = repo
            .find_all()
            .unwrap()
            .into_iter()
            .map(|tag| tag.name)
            .collect::<Vec<_>>();

        assert_eq!(names, vec!["Fav", "Gray", "news", "Red"]);
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
    fn find_tags_for_article_sorts_by_name_case_insensitively() {
        let db = test_db();
        let (_, _, article_id) = insert_test_data(&db);
        let repo = SqliteTagRepository::new(db.writer());

        for name in ["Red", "news", "Fav", "Gray"] {
            let tag = Tag {
                id: TagId::new(),
                name: name.to_string(),
                color: None,
            };
            repo.save(&tag).unwrap();
            repo.tag_article(&article_id, &tag.id).unwrap();
        }

        let names = repo
            .find_tags_for_article(&article_id)
            .unwrap()
            .into_iter()
            .map(|tag| tag.name)
            .collect::<Vec<_>>();

        assert_eq!(names, vec!["Fav", "Gray", "news", "Red"]);
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
        let articles = repo
            .find_articles_by_tag(&tag.id, &pagination, None)
            .unwrap();
        assert_eq!(articles.len(), 1);
        assert_eq!(articles[0].title, "Test Article");
    }

    #[test]
    fn find_articles_by_tag_filters_muted_articles() {
        let db = test_db();
        let (_, _, article_id) = insert_test_data(&db);
        let repo = SqliteTagRepository::new(db.writer());

        db.writer()
            .execute(
                "UPDATE articles SET title = ?1 WHERE id = ?2",
                params!["Kindle Unlimited digest", article_id.0],
            )
            .unwrap();

        let tag = Tag {
            id: TagId::new(),
            name: "work".to_string(),
            color: None,
        };
        repo.save(&tag).unwrap();
        repo.tag_article(&article_id, &tag.id).unwrap();
        insert_mute_keyword(&db, "kindle unlimited", "title");

        let pagination = Pagination {
            offset: 0,
            limit: 50,
        };
        let articles = repo
            .find_articles_by_tag(&tag.id, &pagination, None)
            .unwrap();
        assert!(articles.is_empty());
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

    #[test]
    fn find_by_name_case_insensitive() {
        let db = test_db();
        let repo = SqliteTagRepository::new(db.writer());

        let tag = Tag {
            id: TagId::new(),
            name: "Important".to_string(),
            color: Some("#ff0000".to_string()),
        };
        repo.save(&tag).unwrap();

        // Exact match
        let found = repo.find_by_name("Important").unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().name, "Important");

        // Case-insensitive match
        let found = repo.find_by_name("important").unwrap();
        assert!(found.is_some());

        let found = repo.find_by_name("IMPORTANT").unwrap();
        assert!(found.is_some());

        // No match
        let found = repo.find_by_name("nonexistent").unwrap();
        assert!(found.is_none());
    }

    #[test]
    fn save_upsert_does_not_delete_relations() {
        let db = test_db();
        let (_, _, article_id) = insert_test_data(&db);
        let repo = SqliteTagRepository::new(db.writer());

        let tag = Tag {
            id: TagId::new(),
            name: "original".to_string(),
            color: None,
        };
        repo.save(&tag).unwrap();
        repo.tag_article(&article_id, &tag.id).unwrap();

        // Update the tag name via save (upsert)
        let updated_tag = Tag {
            id: tag.id.clone(),
            name: "updated".to_string(),
            color: Some("#00ff00".to_string()),
        };
        repo.save(&updated_tag).unwrap();

        // article_tags relation should still exist
        let tags = repo.find_tags_for_article(&article_id).unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].name, "updated");
    }

    #[test]
    fn count_articles_per_tag_filters_by_account() {
        let db = test_db();
        let (account_id, _, article_id) = insert_test_data(&db);

        // Create a second account with its own feed and article
        let account_id2 = AccountId::new();
        let feed_id2 = FeedId::new();
        let article_id2 = ArticleId("art-2".to_string());
        let now = chrono::Utc::now().to_rfc3339();

        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                params![account_id2.0, "Local", "Other"],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, title, url) VALUES (?1, ?2, ?3, ?4)",
                params![feed_id2.0, account_id2.0, "Feed2", "http://f2.com"],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, title, content_raw, content_sanitized, sanitizer_version, published_at, is_read, is_starred, fetched_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![article_id2.0, feed_id2.0, "Article 2", "", "", 1, now, false, false, now],
            )
            .unwrap();

        let repo = SqliteTagRepository::new(db.writer());

        let tag = Tag {
            id: TagId::new(),
            name: "shared".to_string(),
            color: None,
        };
        repo.save(&tag).unwrap();
        repo.tag_article(&article_id, &tag.id).unwrap();
        repo.tag_article(&article_id2, &tag.id).unwrap();

        // Without account filter: both articles counted
        let counts = repo.count_articles_per_tag(None).unwrap();
        let count = counts.iter().find(|(id, _)| id == &tag.id).unwrap().1;
        assert_eq!(count, 2);

        // With account filter: only first account's article
        let counts = repo.count_articles_per_tag(Some(&account_id)).unwrap();
        let count = counts.iter().find(|(id, _)| id == &tag.id).unwrap().1;
        assert_eq!(count, 1);

        // With second account filter: only second account's article
        let counts = repo.count_articles_per_tag(Some(&account_id2)).unwrap();
        let count = counts.iter().find(|(id, _)| id == &tag.id).unwrap().1;
        assert_eq!(count, 1);
    }

    #[test]
    fn find_articles_by_tag_filters_by_account() {
        let db = test_db();
        let (account_id, _, article_id) = insert_test_data(&db);

        // Create a second account with its own feed and article
        let account_id2 = AccountId::new();
        let feed_id2 = FeedId::new();
        let article_id2 = ArticleId("art-2".to_string());
        let now = chrono::Utc::now().to_rfc3339();

        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                params![account_id2.0, "Local", "Other"],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, title, url) VALUES (?1, ?2, ?3, ?4)",
                params![feed_id2.0, account_id2.0, "Feed2", "http://f2.com"],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, title, content_raw, content_sanitized, sanitizer_version, published_at, is_read, is_starred, fetched_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![article_id2.0, feed_id2.0, "Article 2", "", "", 1, now, false, false, now],
            )
            .unwrap();

        let repo = SqliteTagRepository::new(db.writer());

        let tag = Tag {
            id: TagId::new(),
            name: "multi".to_string(),
            color: None,
        };
        repo.save(&tag).unwrap();
        repo.tag_article(&article_id, &tag.id).unwrap();
        repo.tag_article(&article_id2, &tag.id).unwrap();

        let pagination = Pagination {
            offset: 0,
            limit: 50,
        };

        // Without account filter: both articles
        let articles = repo
            .find_articles_by_tag(&tag.id, &pagination, None)
            .unwrap();
        assert_eq!(articles.len(), 2);

        // With account filter: only first account's article
        let articles = repo
            .find_articles_by_tag(&tag.id, &pagination, Some(&account_id))
            .unwrap();
        assert_eq!(articles.len(), 1);
        assert_eq!(articles[0].title, "Test Article");

        // With second account filter: only second account's article
        let articles = repo
            .find_articles_by_tag(&tag.id, &pagination, Some(&account_id2))
            .unwrap();
        assert_eq!(articles.len(), 1);
        assert_eq!(articles[0].title, "Article 2");
    }
}
