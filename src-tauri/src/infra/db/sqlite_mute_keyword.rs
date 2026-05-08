use chrono::Utc;
use rusqlite::{params, Connection};

use crate::domain::article::Article;
use crate::domain::error::{DomainError, DomainResult};
use crate::domain::mute_keyword::{MuteKeyword, MuteKeywordScope};
use crate::infra::sanitizer;
use crate::repository::article::Pagination;
use crate::repository::mute_keyword::MuteKeywordRepository;

pub struct SqliteMuteKeywordRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SqliteMuteKeywordRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }
}

fn row_to_mute_keyword(row: &rusqlite::Row) -> rusqlite::Result<MuteKeyword> {
    let scope: String = row.get(2)?;
    Ok(MuteKeyword {
        id: row.get(0)?,
        keyword: row.get(1)?,
        scope: MuteKeywordScope::try_from(scope.as_str()).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                2,
                rusqlite::types::Type::Text,
                Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, error)),
            )
        })?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

fn normalize_ascii(value: &str) -> String {
    value.trim().to_ascii_lowercase()
}

fn matches_mute_keyword(article: &Article, rule: &MuteKeyword) -> bool {
    let normalized_keyword = normalize_ascii(&rule.keyword);
    if normalized_keyword.is_empty() {
        return false;
    }

    let title = normalize_ascii(&article.title);
    let extracted_body = if article.content_sanitized.trim().is_empty() {
        String::new()
    } else {
        sanitizer::extract_visible_text(&article.content_sanitized)
    };
    let body_source = if extracted_body.trim().is_empty() {
        article.summary.as_deref().unwrap_or("")
    } else {
        extracted_body.as_str()
    };
    let body = normalize_ascii(body_source);

    match rule.scope {
        MuteKeywordScope::Title => title.contains(&normalized_keyword),
        MuteKeywordScope::Body => body.contains(&normalized_keyword),
        MuteKeywordScope::TitleAndBody => {
            title.contains(&normalized_keyword) || body.contains(&normalized_keyword)
        }
    }
}

pub fn build_mute_keyword_match_clause(title_expr: &str, body_expr: &str) -> String {
    format!(
        "EXISTS (
            SELECT 1
            FROM mute_keywords mk
            WHERE
              (mk.scope = 'title' AND instr(lower(coalesce({title_expr}, '')), lower(mk.keyword)) > 0)
              OR
              (mk.scope = 'body' AND instr(lower(coalesce({body_expr}, '')), lower(mk.keyword)) > 0)
              OR
              (
                mk.scope = 'title_and_body'
                AND (
                  instr(lower(coalesce({title_expr}, '')), lower(mk.keyword)) > 0
                  OR instr(lower(coalesce({body_expr}, '')), lower(mk.keyword)) > 0
                )
              )
          )"
    )
}

pub fn build_mute_keyword_exclusion_clause(title_expr: &str, body_expr: &str) -> String {
    format!(
        "NOT {}",
        build_mute_keyword_match_clause(title_expr, body_expr)
    )
}

pub fn filter_articles_by_mute_keywords(
    conn: &Connection,
    articles: Vec<Article>,
    pagination: &Pagination,
) -> DomainResult<Vec<Article>> {
    let rules = SqliteMuteKeywordRepository::new(conn).find_all()?;
    if rules.is_empty() {
        let start = pagination.offset.min(articles.len());
        let end = (start + pagination.limit).min(articles.len());
        return Ok(articles[start..end].to_vec());
    }

    let filtered = articles
        .into_iter()
        .filter(|article| !rules.iter().any(|rule| matches_mute_keyword(article, rule)))
        .collect::<Vec<_>>();

    let start = pagination.offset.min(filtered.len());
    let end = (start + pagination.limit).min(filtered.len());
    Ok(filtered[start..end].to_vec())
}

impl MuteKeywordRepository for SqliteMuteKeywordRepository<'_> {
    fn find_all(&self) -> DomainResult<Vec<MuteKeyword>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, keyword, scope, created_at, updated_at
             FROM mute_keywords
             ORDER BY created_at DESC, id DESC",
        )?;
        let rows = stmt
            .query_map([], row_to_mute_keyword)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    fn create(&self, keyword: &str, scope: MuteKeywordScope) -> DomainResult<MuteKeyword> {
        let keyword = keyword.trim().to_string();
        if keyword.is_empty() {
            return Err(DomainError::Validation(
                "Mute keyword cannot be empty".to_string(),
            ));
        }
        if keyword.chars().count() < 3 {
            return Err(DomainError::Validation(
                "Mute keyword must be at least 3 characters".to_string(),
            ));
        }

        let normalized_keyword = normalize_ascii(&keyword);
        let existing = self.find_all()?;
        if existing
            .iter()
            .any(|rule| normalize_ascii(&rule.keyword) == normalized_keyword && rule.scope == scope)
        {
            return Err(DomainError::Validation(
                "Mute keyword already exists".to_string(),
            ));
        }

        let now = Utc::now().to_rfc3339();
        let mute_keyword = MuteKeyword {
            id: uuid::Uuid::new_v4().to_string(),
            keyword,
            scope,
            created_at: now.clone(),
            updated_at: now,
        };

        self.conn.execute(
            "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                mute_keyword.id,
                mute_keyword.keyword,
                mute_keyword.scope.as_str(),
                mute_keyword.created_at,
                mute_keyword.updated_at
            ],
        )?;

        Ok(mute_keyword)
    }

    fn update_scope(
        &self,
        mute_keyword_id: &str,
        scope: MuteKeywordScope,
    ) -> DomainResult<MuteKeyword> {
        let existing = self.find_all()?;
        let current = existing
            .iter()
            .find(|rule| rule.id == mute_keyword_id)
            .cloned()
            .ok_or_else(|| DomainError::Validation("Mute keyword not found".to_string()))?;

        let normalized_keyword = normalize_ascii(&current.keyword);
        if existing.iter().any(|rule| {
            rule.id != current.id
                && normalize_ascii(&rule.keyword) == normalized_keyword
                && rule.scope == scope
        }) {
            return Err(DomainError::Validation(
                "Mute keyword already exists".to_string(),
            ));
        }

        let updated_at = Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE mute_keywords SET scope = ?1, updated_at = ?2 WHERE id = ?3",
            params![scope.as_str(), updated_at, mute_keyword_id],
        )?;

        Ok(MuteKeyword {
            scope,
            updated_at,
            ..current
        })
    }

    fn delete(&self, mute_keyword_id: &str) -> DomainResult<()> {
        self.conn.execute(
            "DELETE FROM mute_keywords WHERE id = ?1",
            params![mute_keyword_id],
        )?;
        Ok(())
    }

    fn has_any(&self) -> DomainResult<bool> {
        let count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM mute_keywords", [], |row| row.get(0))?;
        Ok(count > 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::types::{AccountId, ArticleId, FeedId};
    use crate::infra::db::connection::DbManager;

    fn test_db() -> DbManager {
        DbManager::new_in_memory().unwrap()
    }

    fn article_fixture(
        title: &str,
        content_sanitized: &str,
        summary: Option<&str>,
        _content_text: Option<&str>,
    ) -> Article {
        Article {
            id: ArticleId("art-1".to_string()),
            feed_id: FeedId("feed-1".to_string()),
            remote_id: None,
            title: title.to_string(),
            content_raw: "".to_string(),
            content_sanitized: content_sanitized.to_string(),
            sanitizer_version: 1,
            summary: summary.map(str::to_string),
            url: None,
            author: None,
            published_at: Utc::now(),
            thumbnail: None,
            is_read: false,
            is_starred: false,
            fetched_at: Utc::now(),
        }
    }

    fn sql_matches_article(
        db: &DbManager,
        article: &Article,
        content_text: Option<&str>,
        rule: &MuteKeyword,
    ) -> bool {
        let content_text = content_text.unwrap_or("").to_string();
        let summary = article.summary.clone();
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, 'Local', 'Test')",
                params![AccountId("acc-1".to_string()).0],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, title, url, site_url)
                 VALUES (?1, 'acc-1', 'Feed', 'https://example.com/rss', 'https://example.com')",
                params![article.feed_id.0],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, content_text, sanitizer_version, summary, url, author, published_at, thumbnail, is_read, is_starred, fetched_at)
                 VALUES (?1, ?2, NULL, ?3, '', ?4, ?5, 1, ?6, NULL, NULL, datetime('now'), NULL, 0, 0, datetime('now'))",
                params![
                    article.id.0,
                    article.feed_id.0,
                    article.title,
                    article.content_sanitized,
                    content_text,
                    summary,
                ],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at)
                 VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))",
                params![rule.id, rule.keyword, rule.scope.as_str()],
            )
            .unwrap();

        let match_clause = build_mute_keyword_match_clause(
            "a.title",
            "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
        );
        let sql =
            format!("SELECT EXISTS(SELECT 1 FROM articles a WHERE a.id = ?1 AND {match_clause})");
        db.reader()
            .query_row(&sql, params![article.id.0], |row| row.get::<_, bool>(0))
            .unwrap()
    }

    #[test]
    fn create_and_list_mute_keywords() {
        let db = test_db();
        let repo = SqliteMuteKeywordRepository::new(db.writer());

        let created = repo
            .create("Kindle Unlimited", MuteKeywordScope::TitleAndBody)
            .unwrap();
        let rules = repo.find_all().unwrap();

        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0], created);
    }

    #[test]
    fn find_all_returns_error_for_unknown_stored_scope() {
        let db = test_db();
        let repo = SqliteMuteKeywordRepository::new(db.writer());

        db.writer()
            .execute("PRAGMA ignore_check_constraints = ON", [])
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    "mute-invalid-scope",
                    "Kindle Unlimited",
                    "title_body",
                    Utc::now().to_rfc3339(),
                    Utc::now().to_rfc3339()
                ],
            )
            .unwrap();

        let error = repo.find_all().unwrap_err();

        assert!(matches!(error, DomainError::Persistence(_)));
        assert!(error.to_string().contains("Unknown mute keyword scope"));
    }

    #[test]
    fn create_trims_keyword_and_rejects_same_scope_duplicates_ignoring_ascii_case() {
        let db = test_db();
        let repo = SqliteMuteKeywordRepository::new(db.writer());

        let created = repo
            .create(" Kindle Unlimited ", MuteKeywordScope::Title)
            .unwrap();
        assert_eq!(created.keyword, "Kindle Unlimited");

        let error = repo
            .create("  KINDLE UNLIMITED  ", MuteKeywordScope::Title)
            .unwrap_err();

        assert!(matches!(error, DomainError::Validation(_)));

        repo.create("  KINDLE UNLIMITED  ", MuteKeywordScope::Body)
            .unwrap();

        let rules = repo.find_all().unwrap();
        assert_eq!(rules.len(), 2);
        assert!(rules.iter().all(|rule| rule.keyword == rule.keyword.trim()));
    }

    #[test]
    fn create_rejects_keywords_shorter_than_three_characters() {
        let db = test_db();
        let repo = SqliteMuteKeywordRepository::new(db.writer());

        let error = repo.create("あ", MuteKeywordScope::Title).unwrap_err();
        assert!(matches!(error, DomainError::Validation(_)));

        let error = repo.create("AI", MuteKeywordScope::Title).unwrap_err();
        assert!(matches!(error, DomainError::Validation(_)));
    }

    #[test]
    fn delete_removes_rule() {
        let db = test_db();
        let repo = SqliteMuteKeywordRepository::new(db.writer());

        let created = repo
            .create("Kindle Unlimited", MuteKeywordScope::Title)
            .unwrap();
        repo.delete(&created.id).unwrap();

        assert!(repo.find_all().unwrap().is_empty());
    }

    #[test]
    fn update_scope_changes_rule() {
        let db = test_db();
        let repo = SqliteMuteKeywordRepository::new(db.writer());

        let created = repo
            .create("Kindle Unlimited", MuteKeywordScope::Title)
            .unwrap();
        let updated = repo
            .update_scope(&created.id, MuteKeywordScope::Body)
            .unwrap();

        assert_eq!(updated.scope, MuteKeywordScope::Body);
        assert_eq!(repo.find_all().unwrap()[0].scope, MuteKeywordScope::Body);
    }

    #[test]
    fn update_scope_allows_same_rule_scope_change_without_duplicate_error() {
        let db = test_db();
        let repo = SqliteMuteKeywordRepository::new(db.writer());

        let created = repo
            .create("Kindle Unlimited", MuteKeywordScope::Title)
            .unwrap();

        let updated = repo
            .update_scope(&created.id, MuteKeywordScope::Body)
            .unwrap();

        assert_eq!(updated.id, created.id);
        assert_eq!(updated.keyword, "Kindle Unlimited");
        assert_eq!(updated.scope, MuteKeywordScope::Body);
    }

    #[test]
    fn update_scope_rejects_duplicate_keyword_when_another_rule_has_target_scope() {
        let db = test_db();
        let repo = SqliteMuteKeywordRepository::new(db.writer());

        let title_rule = repo
            .create("Kindle Unlimited", MuteKeywordScope::Title)
            .unwrap();
        repo.create("kindle unlimited", MuteKeywordScope::Body)
            .unwrap();

        let error = repo
            .update_scope(&title_rule.id, MuteKeywordScope::Body)
            .unwrap_err();

        assert!(matches!(error, DomainError::Validation(_)));
        let title_rule_after_error = repo
            .find_all()
            .unwrap()
            .into_iter()
            .find(|rule| rule.id == title_rule.id)
            .unwrap();
        assert_eq!(title_rule_after_error.scope, MuteKeywordScope::Title);
    }

    #[test]
    fn body_matching_ignores_html_attributes() {
        let article = Article {
            id: crate::domain::types::ArticleId("art-1".to_string()),
            feed_id: crate::domain::types::FeedId("feed-1".to_string()),
            remote_id: None,
            title: "Visible article".to_string(),
            content_raw: "".to_string(),
            content_sanitized: r#"<p><a href="https://example.com/kindle">Visible text</a></p>"#
                .to_string(),
            sanitizer_version: 1,
            summary: None,
            url: None,
            author: None,
            published_at: Utc::now(),
            thumbnail: None,
            is_read: false,
            is_starred: false,
            fetched_at: Utc::now(),
        };
        let rule = MuteKeyword {
            id: "mute-1".to_string(),
            keyword: "kindle".to_string(),
            scope: MuteKeywordScope::Body,
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
        };

        assert!(!matches_mute_keyword(&article, &rule));
    }

    #[test]
    fn body_matching_respects_visible_text_across_inline_markup() {
        let article = Article {
            id: crate::domain::types::ArticleId("art-2".to_string()),
            feed_id: crate::domain::types::FeedId("feed-1".to_string()),
            remote_id: None,
            title: "Visible article".to_string(),
            content_raw: "".to_string(),
            content_sanitized: "<p>Kindle <strong>Unlimited</strong></p>".to_string(),
            sanitizer_version: 1,
            summary: None,
            url: None,
            author: None,
            published_at: Utc::now(),
            thumbnail: None,
            is_read: false,
            is_starred: false,
            fetched_at: Utc::now(),
        };
        let rule = MuteKeyword {
            id: "mute-2".to_string(),
            keyword: "kindle unlimited".to_string(),
            scope: MuteKeywordScope::Body,
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
        };

        assert!(matches_mute_keyword(&article, &rule));
    }

    #[test]
    fn sql_and_rust_matchers_share_title_and_body_contract() {
        let fixtures = [
            (
                article_fixture("Kindle Unlimited deal", "", Some("summary"), None),
                "kindle unlimited",
                MuteKeywordScope::Title,
                None,
            ),
            (
                article_fixture(
                    "Visible article",
                    "",
                    Some("Kindle Unlimited summary"),
                    None,
                ),
                "kindle unlimited",
                MuteKeywordScope::Body,
                None,
            ),
            (
                article_fixture(
                    "Visible article",
                    "<p>Kindle Unlimited content</p>",
                    Some("ignored summary"),
                    Some("Kindle Unlimited content"),
                ),
                "kindle unlimited",
                MuteKeywordScope::TitleAndBody,
                Some("Kindle Unlimited content"),
            ),
            (
                article_fixture("Visible article", "", Some("plain summary"), None),
                "kindle unlimited",
                MuteKeywordScope::TitleAndBody,
                None,
            ),
        ];

        for (index, (article, keyword, scope, content_text)) in fixtures.into_iter().enumerate() {
            let db = test_db();
            let rule = MuteKeyword {
                id: format!("mute-{index}"),
                keyword: keyword.to_string(),
                scope,
                created_at: Utc::now().to_rfc3339(),
                updated_at: Utc::now().to_rfc3339(),
            };

            assert_eq!(
                sql_matches_article(&db, &article, content_text, &rule),
                matches_mute_keyword(&article, &rule),
                "fixture {index} should match SQL and Rust behavior",
            );
        }
    }
}
