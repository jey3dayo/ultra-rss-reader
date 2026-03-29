use reqwest::header::{HeaderMap, CONTENT_SECURITY_POLICY, X_FRAME_OPTIONS};
use reqwest::StatusCode;
use tauri::State;

use crate::commands::dto::{AppError, ArticleDto};
use crate::commands::AppState;
use crate::domain::error::DomainError;
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
use crate::repository::article::{ArticleRepository, Pagination};
use crate::repository::pending_mutation::{PendingMutation, PendingMutationRepository};

#[tauri::command]
pub fn open_in_browser(url: String, background: Option<bool>) -> Result<(), AppError> {
    if background.unwrap_or(false) && cfg!(target_os = "macos") {
        // macOS: use `open -g` to open in background
        std::process::Command::new("open")
            .arg("-g")
            .arg(&url)
            .spawn()
            .map_err(|e| AppError::UserVisible {
                message: format!("Failed to open browser: {e}"),
            })?;
    } else {
        open::that(&url).map_err(|e| AppError::UserVisible {
            message: format!("Failed to open browser: {e}"),
        })?;
    }
    Ok(())
}

fn has_blocking_x_frame_options(headers: &HeaderMap) -> bool {
    headers
        .get_all(X_FRAME_OPTIONS)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .map(str::trim)
        .any(|value| !value.is_empty())
}

fn has_blocking_frame_ancestors(headers: &HeaderMap) -> bool {
    headers
        .get_all(CONTENT_SECURITY_POLICY)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .any(|policy| {
            policy
                .split(';')
                .map(str::trim)
                .find_map(|directive| {
                    directive
                        .strip_prefix("frame-ancestors")
                        .or_else(|| directive.strip_prefix("Frame-Ancestors"))
                })
                .map(|value| {
                    let sources = value.split_whitespace();
                    !sources.into_iter().any(|source| source == "*")
                })
                .unwrap_or(false)
        })
}

#[tauri::command]
pub async fn check_browser_embed_support(url: String) -> Result<bool, AppError> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(DomainError::from)?;

    let response = match client.head(&url).send().await {
        Ok(response) if response.status() != StatusCode::METHOD_NOT_ALLOWED => response,
        Ok(_) | Err(_) => client.get(&url).send().await.map_err(DomainError::from)?,
    };

    let headers = response.headers();
    Ok(!(has_blocking_x_frame_options(headers) || has_blocking_frame_ancestors(headers)))
}

#[tauri::command]
pub fn list_articles(
    state: State<'_, AppState>,
    feed_id: String,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<ArticleDto>, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteArticleRepository::new(db.reader());
    let pagination = Pagination {
        offset: offset.unwrap_or(0),
        limit: limit.unwrap_or(50),
    };
    let articles = repo.find_by_feed(&FeedId(feed_id), &pagination)?;
    Ok(articles.into_iter().map(ArticleDto::from).collect())
}

#[tauri::command]
pub fn list_account_articles(
    state: State<'_, AppState>,
    account_id: String,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<ArticleDto>, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteArticleRepository::new(db.reader());
    let pagination = Pagination {
        offset: offset.unwrap_or(0),
        limit: limit.unwrap_or(50),
    };
    let articles = repo.find_by_account(&AccountId(account_id), &pagination)?;
    Ok(articles.into_iter().map(ArticleDto::from).collect())
}

#[tauri::command]
pub fn mark_article_read(
    state: State<'_, AppState>,
    article_id: String,
    read: Option<bool>,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let article_id = ArticleId(article_id);
    let repo = SqliteArticleRepository::new(db.writer());
    let read = read.unwrap_or(true);
    repo.mark_as_read(&article_id, read)?;

    // Queue pending mutation for FreshRSS accounts
    let mutation_type = if read { "mark_read" } else { "mark_unread" };
    maybe_queue_mutation(db.writer(), &article_id, mutation_type)?;

    Ok(())
}

#[tauri::command]
pub fn mark_articles_read(
    state: State<'_, AppState>,
    article_ids: Vec<String>,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let ids: Vec<ArticleId> = article_ids.iter().map(|id| ArticleId(id.clone())).collect();
    let repo = SqliteArticleRepository::new(db.writer());
    repo.mark_many_as_read(&ids)?;

    // Queue pending mutations for FreshRSS/Inoreader articles
    for id in &ids {
        maybe_queue_mutation(db.writer(), id, "mark_read")?;
    }

    Ok(())
}

#[tauri::command]
pub fn mark_feed_read(state: State<'_, AppState>, feed_id: String) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let feed_id = FeedId(feed_id);

    // Collect unread article IDs *before* marking them read
    let newly_read_ids: Vec<String> = db
        .writer()
        .prepare(
            "SELECT a.id FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             JOIN accounts acc ON f.account_id = acc.id
             WHERE a.feed_id = ?1 AND a.is_read = 0 AND a.remote_id IS NOT NULL
             AND (acc.kind = 'FreshRss' OR acc.kind = 'Inoreader')",
        )
        .and_then(|mut stmt| {
            stmt.query_map(rusqlite::params![feed_id.0], |row| row.get::<_, String>(0))
                .and_then(|rows| rows.collect())
        })
        .map_err(DomainError::from)?;

    let repo = SqliteArticleRepository::new(db.writer());
    repo.mark_feed_as_read(&feed_id)?;

    // Queue pending mutations only for newly-marked articles
    for article_id in &newly_read_ids {
        maybe_queue_mutation(db.writer(), &ArticleId(article_id.clone()), "mark_read")?;
    }

    Ok(())
}

#[tauri::command]
pub fn mark_folder_read(state: State<'_, AppState>, folder_id: String) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let folder_id = FolderId(folder_id);

    // Collect unread article IDs *before* marking them read
    let newly_read_ids: Vec<String> = db
        .writer()
        .prepare(
            "SELECT a.id FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             JOIN accounts acc ON f.account_id = acc.id
             WHERE f.folder_id = ?1 AND a.is_read = 0 AND a.remote_id IS NOT NULL
             AND (acc.kind = 'FreshRss' OR acc.kind = 'Inoreader')",
        )
        .and_then(|mut stmt| {
            stmt.query_map(rusqlite::params![folder_id.0], |row| {
                row.get::<_, String>(0)
            })
            .and_then(|rows| rows.collect())
        })
        .map_err(DomainError::from)?;

    let repo = SqliteArticleRepository::new(db.writer());
    repo.mark_folder_as_read(&folder_id)?;

    // Queue pending mutations only for newly-marked articles
    for article_id in &newly_read_ids {
        maybe_queue_mutation(db.writer(), &ArticleId(article_id.clone()), "mark_read")?;
    }

    Ok(())
}

#[tauri::command]
pub fn toggle_article_star(
    state: State<'_, AppState>,
    article_id: String,
    starred: bool,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let article_id = ArticleId(article_id);
    let repo = SqliteArticleRepository::new(db.writer());
    repo.mark_as_starred(&article_id, starred)?;

    // Queue pending mutation for FreshRSS accounts
    let mutation_type = if starred { "star" } else { "unstar" };
    maybe_queue_mutation(db.writer(), &article_id, mutation_type)?;

    Ok(())
}

/// If the article belongs to a FreshRSS account and has a remote_id, insert a pending_mutation.
fn maybe_queue_mutation(
    conn: &rusqlite::Connection,
    article_id: &ArticleId,
    mutation_type: &str,
) -> Result<(), AppError> {
    // Single query to get remote_id, account kind, and account_id
    let row: Option<(String, String, String)> = conn
        .query_row(
            "SELECT a.remote_id, acc.kind, f.account_id
             FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             JOIN accounts acc ON f.account_id = acc.id
             WHERE a.id = ?1 AND a.remote_id IS NOT NULL",
            rusqlite::params![article_id.0],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .ok();

    if let Some((remote_entry_id, account_kind, account_id)) = row {
        if account_kind == "FreshRss" || account_kind == "Inoreader" {
            let pending_repo = SqlitePendingMutationRepository::new(conn);
            pending_repo.save(&PendingMutation {
                id: None,
                account_id: AccountId(account_id),
                mutation_type: mutation_type.to_string(),
                remote_entry_id,
                created_at: chrono::Utc::now().to_rfc3339(),
            })?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn search_articles(
    state: State<'_, AppState>,
    account_id: String,
    query: String,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<ArticleDto>, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteArticleRepository::new(db.reader());
    let pagination = Pagination {
        offset: offset.unwrap_or(0),
        limit: limit.unwrap_or(50),
    };
    let articles = repo.search(&AccountId(account_id), &query, &pagination)?;
    Ok(articles.into_iter().map(ArticleDto::from).collect())
}

#[cfg(test)]
mod tests {
    use super::{has_blocking_frame_ancestors, has_blocking_x_frame_options};
    use reqwest::header::{HeaderMap, HeaderValue, CONTENT_SECURITY_POLICY, X_FRAME_OPTIONS};

    #[test]
    fn x_frame_options_blocks_embedding() {
        let mut headers = HeaderMap::new();
        headers.insert(X_FRAME_OPTIONS, HeaderValue::from_static("SAMEORIGIN"));

        assert!(has_blocking_x_frame_options(&headers));
    }

    #[test]
    fn frame_ancestors_wildcard_does_not_block_embedding() {
        let mut headers = HeaderMap::new();
        headers.insert(
            CONTENT_SECURITY_POLICY,
            HeaderValue::from_static("default-src 'self'; frame-ancestors *"),
        );

        assert!(!has_blocking_frame_ancestors(&headers));
    }

    #[test]
    fn frame_ancestors_self_blocks_embedding() {
        let mut headers = HeaderMap::new();
        headers.insert(
            CONTENT_SECURITY_POLICY,
            HeaderValue::from_static(
                "default-src 'self'; frame-ancestors 'self' https://example.com",
            ),
        );

        assert!(has_blocking_frame_ancestors(&headers));
    }
}
