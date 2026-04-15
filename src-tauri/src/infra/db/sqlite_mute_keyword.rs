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

pub fn build_mute_keyword_exclusion_clause(title_expr: &str, body_expr: &str) -> String {
    format!(
        "NOT EXISTS (
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
    use crate::infra::db::connection::DbManager;

    fn test_db() -> DbManager {
        DbManager::new_in_memory().unwrap()
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
    fn create_rejects_ascii_case_insensitive_duplicates() {
        let db = test_db();
        let repo = SqliteMuteKeywordRepository::new(db.writer());

        repo.create(" Kindle Unlimited ", MuteKeywordScope::Title)
            .unwrap();
        let error = repo
            .create("kindle unlimited", MuteKeywordScope::Title)
            .unwrap_err();

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
}
