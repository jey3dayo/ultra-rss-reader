use tauri::State;

use crate::commands::dto::{AppError, ArticleDto};
use crate::commands::AppState;
use crate::domain::types::{AccountId, ArticleId, FeedId};
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::repository::article::{ArticleRepository, Pagination};

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
    let repo = SqliteArticleRepository::new(db.writer());
    repo.mark_as_read(&ArticleId(article_id))?;
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
    let repo = SqliteArticleRepository::new(db.writer());
    repo.mark_as_starred(&ArticleId(article_id), starred)?;
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
