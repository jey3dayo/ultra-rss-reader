use rusqlite::types::Type;
use rusqlite::{params, Connection};

use crate::domain::article::Article;
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
mod tests {
    use super::*;
    use crate::domain::types::AccountId;
    use crate::infra::db::connection::DbManager;
    use crate::repository::article::ArticleListMode;

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

    fn count_article_tag_links(db: &DbManager, article_id: &ArticleId, tag_id: &TagId) -> i64 {
        db.writer()
            .query_row(
                "SELECT COUNT(*) FROM article_tags WHERE article_id = ?1 AND tag_id = ?2",
                params![article_id.0, tag_id.0],
                |row| row.get(0),
            )
            .unwrap()
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
    fn save_rejects_blank_tag_names_without_inserting_rows() {
        let db = test_db();
        let repo = SqliteTagRepository::new(db.writer());

        for name in ["", "   "] {
            let tag = Tag {
                id: TagId::new(),
                name: name.to_string(),
                color: None,
            };

            let error = repo
                .save(&tag)
                .expect_err("blank tag name should be rejected");
            assert!(
                matches!(error, DomainError::Validation(message) if message == "tag name cannot be blank")
            );
        }

        assert!(repo.find_all().unwrap().is_empty());
    }

    #[test]
    fn find_or_create_rejects_blank_tag_names_without_inserting_rows() {
        let db = test_db();
        let repo = SqliteTagRepository::new(db.writer());

        for name in ["", "   "] {
            let tag = Tag {
                id: TagId::new(),
                name: name.to_string(),
                color: None,
            };

            let error = repo
                .find_or_create(&tag)
                .expect_err("blank tag name should be rejected");
            assert!(
                matches!(error, DomainError::Validation(message) if message == "tag name cannot be blank")
            );
        }

        assert!(repo.find_all().unwrap().is_empty());
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
    fn find_or_create_returns_existing_tag_for_exact_name_conflict() {
        let db = test_db();
        let repo = SqliteTagRepository::new(db.writer());
        let existing_tag = Tag {
            id: TagId::new(),
            name: "important".to_string(),
            color: Some("#cf7868".to_string()),
        };
        let new_tag = Tag {
            id: TagId::new(),
            name: existing_tag.name.clone(),
            color: Some("#6f8eb8".to_string()),
        };
        repo.save(&existing_tag).unwrap();

        let found = repo.find_or_create(&new_tag).unwrap();
        let tags = repo.find_all().unwrap();

        assert_eq!(found.id, existing_tag.id);
        assert_eq!(found.name, existing_tag.name);
        assert_eq!(found.color, existing_tag.color);
        assert_ne!(found.id, new_tag.id);
        assert_ne!(found.color, new_tag.color);
        assert_eq!(tags.len(), 1);
    }

    #[test]
    fn find_or_create_returns_existing_tag_for_case_insensitive_name_conflict() {
        let db = test_db();
        let repo = SqliteTagRepository::new(db.writer());
        let existing_tag = Tag {
            id: TagId::new(),
            name: "Important".to_string(),
            color: Some("#cf7868".to_string()),
        };
        let new_tag = Tag {
            id: TagId::new(),
            name: "important".to_string(),
            color: Some("#6f8eb8".to_string()),
        };
        repo.save(&existing_tag).unwrap();

        let found = repo.find_or_create(&new_tag).unwrap();
        let tags = repo.find_all().unwrap();

        assert_eq!(found.id, existing_tag.id);
        assert_eq!(found.name, existing_tag.name);
        assert_eq!(found.color, existing_tag.color);
        assert_ne!(found.id, new_tag.id);
        assert_ne!(found.color, new_tag.color);
        assert_eq!(tags.len(), 1);
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
            .find_articles_by_tag(&tag.id, &pagination, None, ArticleListMode::All)
            .unwrap();
        assert_eq!(articles.len(), 1);
        assert_eq!(articles[0].title, "Test Article");

        let beyond_end = repo
            .find_articles_by_tag(
                &tag.id,
                &Pagination {
                    offset: 10_000,
                    limit: 50,
                },
                None,
                ArticleListMode::All,
            )
            .unwrap();
        assert!(beyond_end.is_empty());
    }

    #[test]
    fn find_articles_by_tag_returns_decode_error_for_malformed_fetched_at() {
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
        db.writer()
            .execute(
                "UPDATE articles SET fetched_at = ?1 WHERE id = ?2",
                params!["not-a-date", article_id.0],
            )
            .unwrap();

        let pagination = Pagination {
            offset: 0,
            limit: 50,
        };
        let result = repo.find_articles_by_tag(&tag.id, &pagination, None, ArticleListMode::All);

        assert!(result.is_err());
    }

    #[test]
    fn find_articles_by_tag_returns_decode_error_for_malformed_published_at() {
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
        db.writer()
            .execute(
                "UPDATE articles SET published_at = ?1 WHERE id = ?2",
                params!["not-a-date", article_id.0],
            )
            .unwrap();

        let pagination = Pagination {
            offset: 0,
            limit: 50,
        };
        let result = repo.find_articles_by_tag(&tag.id, &pagination, None, ArticleListMode::All);

        assert!(result.is_err());
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
            .find_articles_by_tag(&tag.id, &pagination, None, ArticleListMode::All)
            .unwrap();
        assert!(articles.is_empty());
    }

    #[test]
    fn count_articles_per_tag_filters_muted_articles_without_account_filter() {
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
            name: "muted-count".to_string(),
            color: None,
        };
        repo.save(&tag).unwrap();
        repo.tag_article(&article_id, &tag.id).unwrap();
        insert_mute_keyword(&db, "kindle unlimited", "title");

        let counts = repo.count_articles_per_tag(None).unwrap();

        assert!(counts.iter().all(|(id, _)| id != &tag.id));
    }

    #[test]
    fn count_articles_per_tag_filters_muted_articles_with_account_filter() {
        let db = test_db();
        let (account_id, _, article_id) = insert_test_data(&db);
        let repo = SqliteTagRepository::new(db.writer());

        db.writer()
            .execute(
                "UPDATE articles SET title = ?1 WHERE id = ?2",
                params!["Kindle Unlimited digest", article_id.0],
            )
            .unwrap();

        let tag = Tag {
            id: TagId::new(),
            name: "muted-account-count".to_string(),
            color: None,
        };
        repo.save(&tag).unwrap();
        repo.tag_article(&article_id, &tag.id).unwrap();
        insert_mute_keyword(&db, "kindle unlimited", "title");

        let counts = repo.count_articles_per_tag(Some(&account_id)).unwrap();

        assert!(counts.iter().all(|(id, _)| id != &tag.id));
    }

    #[test]
    fn tag_article_uses_insert_or_ignore_for_duplicate_link() {
        let db = test_db();
        let (_, _, article_id) = insert_test_data(&db);
        let repo = SqliteTagRepository::new(db.writer());

        let tag = Tag {
            id: TagId::new(),
            name: "test".to_string(),
            color: None,
        };
        repo.save(&tag).unwrap();

        repo.tag_article(&article_id, &tag.id).unwrap();
        assert_eq!(count_article_tag_links(&db, &article_id, &tag.id), 1);

        repo.tag_article(&article_id, &tag.id).unwrap();

        assert_eq!(count_article_tag_links(&db, &article_id, &tag.id), 1);
    }

    #[test]
    fn untag_article_treats_delete_zero_rows_as_successful_noop() {
        let db = test_db();
        let (_, _, article_id) = insert_test_data(&db);
        let repo = SqliteTagRepository::new(db.writer());

        let tag = Tag {
            id: TagId::new(),
            name: "test".to_string(),
            color: None,
        };
        repo.save(&tag).unwrap();

        repo.untag_article(&article_id, &tag.id).unwrap();

        assert_eq!(count_article_tag_links(&db, &article_id, &tag.id), 0);
    }

    #[test]
    fn untag_article_missing_article_is_successful_noop() {
        let db = test_db();
        let repo = SqliteTagRepository::new(db.writer());

        let tag = Tag {
            id: TagId::new(),
            name: "test".to_string(),
            color: None,
        };
        repo.save(&tag).unwrap();
        let missing_article_id = ArticleId("missing-article".to_string());

        repo.untag_article(&missing_article_id, &tag.id).unwrap();

        assert_eq!(
            count_article_tag_links(&db, &missing_article_id, &tag.id),
            0
        );
    }

    #[test]
    fn untag_article_missing_tag_is_successful_noop() {
        let db = test_db();
        let (_, _, article_id) = insert_test_data(&db);
        let repo = SqliteTagRepository::new(db.writer());
        let missing_tag_id = TagId("missing-tag".to_string());

        repo.untag_article(&article_id, &missing_tag_id).unwrap();

        assert_eq!(
            count_article_tag_links(&db, &article_id, &missing_tag_id),
            0
        );
    }

    #[test]
    fn tag_article_rejects_missing_article_with_foreign_key_error() {
        let db = test_db();
        let repo = SqliteTagRepository::new(db.writer());

        let tag = Tag {
            id: TagId::new(),
            name: "test".to_string(),
            color: None,
        };
        repo.save(&tag).unwrap();

        let error = repo
            .tag_article(&ArticleId("missing-article".to_string()), &tag.id)
            .expect_err("missing article should violate the article_tags foreign key");

        assert!(
            matches!(error, DomainError::Persistence(message) if message.contains("FOREIGN KEY constraint failed"))
        );
    }

    #[test]
    fn tag_article_rejects_missing_tag_with_foreign_key_error() {
        let db = test_db();
        let (_, _, article_id) = insert_test_data(&db);
        let repo = SqliteTagRepository::new(db.writer());

        let error = repo
            .tag_article(&article_id, &TagId("missing-tag".to_string()))
            .expect_err("missing tag should violate the article_tags foreign key");

        assert!(
            matches!(error, DomainError::Persistence(message) if message.contains("FOREIGN KEY constraint failed"))
        );
    }

    #[test]
    fn detects_orphaned_article_tags_without_cleanup() {
        let db = test_db();
        let (_, _, article_id) = insert_test_data(&db);
        let repo = SqliteTagRepository::new(db.writer());

        let healthy_tag = Tag {
            id: TagId("tag-healthy".to_string()),
            name: "healthy".to_string(),
            color: None,
        };
        repo.save(&healthy_tag).unwrap();
        repo.tag_article(&article_id, &healthy_tag.id).unwrap();

        db.writer()
            .execute_batch("PRAGMA foreign_keys = OFF;")
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO article_tags (article_id, tag_id) VALUES (?1, ?2)",
                params!["missing-article", healthy_tag.id.0],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO article_tags (article_id, tag_id) VALUES (?1, ?2)",
                params![article_id.0, "missing-tag"],
            )
            .unwrap();
        db.writer()
            .execute_batch("PRAGMA foreign_keys = ON;")
            .unwrap();

        let orphans = repo.list_orphaned_article_tags().unwrap();

        assert_eq!(repo.count_orphaned_article_tags().unwrap(), 2);
        assert_eq!(
            orphans,
            vec![
                OrphanedArticleTag {
                    article_id: ArticleId("art-1".to_string()),
                    tag_id: TagId("missing-tag".to_string()),
                },
                OrphanedArticleTag {
                    article_id: ArticleId("missing-article".to_string()),
                    tag_id: TagId("tag-healthy".to_string()),
                },
            ]
        );
        assert_eq!(repo.find_tags_for_article(&article_id).unwrap().len(), 1);
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
    fn count_articles_per_tag_ignores_orphaned_article_tag_rows() {
        let db = test_db();
        let (_, _, article_id) = insert_test_data(&db);
        let repo = SqliteTagRepository::new(db.writer());

        let tag = Tag {
            id: TagId::new(),
            name: "orphan-safe".to_string(),
            color: None,
        };
        repo.save(&tag).unwrap();
        repo.tag_article(&article_id, &tag.id).unwrap();

        db.writer()
            .execute_batch("PRAGMA foreign_keys = OFF")
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO article_tags (article_id, tag_id) VALUES (?1, ?2)",
                params!["missing-article", tag.id.0],
            )
            .unwrap();
        db.writer()
            .execute_batch("PRAGMA foreign_keys = ON")
            .unwrap();

        let counts = repo.count_articles_per_tag(None).unwrap();

        assert_eq!(counts.iter().find(|(id, _)| id == &tag.id).unwrap().1, 1);
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
            .find_articles_by_tag(&tag.id, &pagination, None, ArticleListMode::All)
            .unwrap();
        assert_eq!(articles.len(), 2);

        // With account filter: only first account's article
        let articles = repo
            .find_articles_by_tag(
                &tag.id,
                &pagination,
                Some(&account_id),
                ArticleListMode::All,
            )
            .unwrap();
        assert_eq!(articles.len(), 1);
        assert_eq!(articles[0].title, "Test Article");

        // With second account filter: only second account's article
        let articles = repo
            .find_articles_by_tag(
                &tag.id,
                &pagination,
                Some(&account_id2),
                ArticleListMode::All,
            )
            .unwrap();
        assert_eq!(articles.len(), 1);
        assert_eq!(articles[0].title, "Article 2");
    }

    #[test]
    fn find_articles_by_tag_filters_mode_before_pagination() {
        let db = test_db();
        let (account_id, feed_id, _) = insert_test_data(&db);
        let repo = SqliteTagRepository::new(db.writer());

        let tag = Tag {
            id: TagId::new(),
            name: "mode".to_string(),
            color: None,
        };
        repo.save(&tag).unwrap();

        let now = chrono::Utc::now();
        let articles = [
            (
                ArticleId("tag-newest-read".to_string()),
                "Newest read",
                now + chrono::Duration::seconds(3),
                true,
                false,
            ),
            (
                ArticleId("tag-middle-unread".to_string()),
                "Middle unread",
                now + chrono::Duration::seconds(2),
                false,
                false,
            ),
            (
                ArticleId("tag-oldest-starred".to_string()),
                "Oldest starred",
                now + chrono::Duration::seconds(1),
                false,
                true,
            ),
        ];

        for (article_id, title, published_at, is_read, is_starred) in &articles {
            let timestamp = published_at.to_rfc3339();
            db.writer()
                .execute(
                    "INSERT INTO articles (id, feed_id, title, content_raw, content_sanitized, sanitizer_version, published_at, is_read, is_starred, fetched_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    params![article_id.0, feed_id.0, title, "", "", 1, timestamp, is_read, is_starred, timestamp],
                )
                .unwrap();
            repo.tag_article(article_id, &tag.id).unwrap();
        }

        let first_page = Pagination {
            offset: 0,
            limit: 1,
        };
        let all = repo
            .find_articles_by_tag(
                &tag.id,
                &first_page,
                Some(&account_id),
                ArticleListMode::All,
            )
            .unwrap();
        let unread = repo
            .find_articles_by_tag(
                &tag.id,
                &first_page,
                Some(&account_id),
                ArticleListMode::Unread,
            )
            .unwrap();
        let starred = repo
            .find_articles_by_tag(
                &tag.id,
                &first_page,
                Some(&account_id),
                ArticleListMode::Starred,
            )
            .unwrap();

        assert_eq!(all[0].title, "Newest read");
        assert_eq!(unread[0].title, "Middle unread");
        assert_eq!(starred[0].title, "Oldest starred");
    }

    #[test]
    fn find_articles_by_tag_applies_account_mode_and_mute_filters_before_pagination() {
        let db = test_db();
        let (account_id, feed_id, _) = insert_test_data(&db);
        let other_account_id = AccountId::new();
        let other_feed_id = FeedId::new();
        let repo = SqliteTagRepository::new(db.writer());

        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                params![other_account_id.0, "Local", "Other"],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, title, url) VALUES (?1, ?2, ?3, ?4)",
                params![
                    other_feed_id.0,
                    other_account_id.0,
                    "Other Feed",
                    "http://other.example.com"
                ],
            )
            .unwrap();

        let tag = Tag {
            id: TagId::new(),
            name: "filtered-page".to_string(),
            color: None,
        };
        repo.save(&tag).unwrap();

        let articles = [
            (
                ArticleId("tag-other-account-newest".to_string()),
                other_feed_id.clone(),
                "Other account newest",
                "2026-04-05T00:00:05Z",
                false,
            ),
            (
                ArticleId("tag-muted-newest".to_string()),
                feed_id.clone(),
                "Kindle Unlimited muted newest",
                "2026-04-05T00:00:04Z",
                false,
            ),
            (
                ArticleId("tag-read-before-visible".to_string()),
                feed_id.clone(),
                "Read before visible",
                "2026-04-05T00:00:03Z",
                true,
            ),
            (
                ArticleId("tag-visible-first".to_string()),
                feed_id.clone(),
                "Visible first unread",
                "2026-04-05T00:00:02Z",
                false,
            ),
            (
                ArticleId("tag-visible-second".to_string()),
                feed_id.clone(),
                "Visible second unread",
                "2026-04-05T00:00:01Z",
                false,
            ),
        ];

        for (article_id, article_feed_id, title, published_at, is_read) in &articles {
            db.writer()
                .execute(
                    "INSERT INTO articles (id, feed_id, title, content_raw, content_sanitized, sanitizer_version, published_at, is_read, is_starred, fetched_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    params![
                        article_id.0,
                        article_feed_id.0,
                        title,
                        "",
                        "",
                        1,
                        published_at,
                        is_read,
                        false,
                        published_at
                    ],
                )
                .unwrap();
            repo.tag_article(article_id, &tag.id).unwrap();
        }
        insert_mute_keyword(&db, "kindle unlimited", "title");

        let first_page = Pagination {
            offset: 0,
            limit: 2,
        };
        let articles = repo
            .find_articles_by_tag(
                &tag.id,
                &first_page,
                Some(&account_id),
                ArticleListMode::Unread,
            )
            .unwrap();

        assert_eq!(
            articles
                .iter()
                .map(|article| article.title.as_str())
                .collect::<Vec<_>>(),
            ["Visible first unread", "Visible second unread"]
        );
    }
}
