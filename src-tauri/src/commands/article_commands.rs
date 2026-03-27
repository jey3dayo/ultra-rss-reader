use tauri::State;

use crate::commands::dto::{AppError, ArticleDto};
use crate::commands::AppState;
use crate::domain::types::{AccountId, ArticleId, FeedId};
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
use crate::repository::article::{ArticleRepository, Pagination};
use crate::repository::pending_mutation::{PendingMutation, PendingMutationRepository};

#[tauri::command]
pub fn open_in_browser(url: String) -> Result<(), AppError> {
    open::that(&url).map_err(|e| AppError::UserVisible {
        message: format!("Failed to open browser: {e}"),
    })?;
    Ok(())
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
pub fn mark_article_read(state: State<'_, AppState>, article_id: String) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let article_id = ArticleId(article_id);
    let repo = SqliteArticleRepository::new(db.writer());
    repo.mark_as_read(&article_id)?;

    // Queue pending mutation for FreshRSS accounts
    maybe_queue_mutation(db.writer(), &article_id, "mark_read")?;

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
        if account_kind == "FreshRss" {
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
