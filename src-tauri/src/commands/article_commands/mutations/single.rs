use rusqlite::OptionalExtension;
use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::domain::error::DomainError;
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::repository::article::{ArticleHistoryRepository, ArticleMutationRepository};
use crate::repository::feed::FeedRepository;
use crate::repository::pending_mutation::PendingMutationType;

use super::bulk::{
    collect_existing_article_rows_by_id, collect_feed_unread_rows, collect_folder_unread_rows,
    mark_rows_read,
};
use super::pending::maybe_queue_mutation_in_current_transaction;

pub(crate) fn mark_article_read_with_conn(
    conn: &rusqlite::Connection,
    article_id: ArticleId,
    read: bool,
) -> Result<(), AppError> {
    let tx = conn.unchecked_transaction().map_err(DomainError::from)?;
    let repo = SqliteArticleRepository::new(&tx);
    repo.mark_as_read(&article_id, read)?;

    let feed_id_str = tx
        .query_row(
            "SELECT feed_id FROM articles WHERE id = ?1",
            rusqlite::params![article_id.0],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(DomainError::from)?;

    if let Some(feed_id_str) = feed_id_str {
        let feed_repo = SqliteFeedRepository::new(&tx);
        feed_repo.recalculate_unread_count(&FeedId(feed_id_str))?;

        let mutation_type = if read {
            PendingMutationType::MarkRead
        } else {
            PendingMutationType::MarkUnread
        };
        maybe_queue_mutation_in_current_transaction(&tx, &article_id, mutation_type)?;
    }

    tx.commit().map_err(DomainError::from)?;
    Ok(())
}

pub(crate) fn mark_articles_read_with_conn(
    conn: &rusqlite::Connection,
    ids: &[ArticleId],
) -> Result<(), AppError> {
    let tx = conn.unchecked_transaction().map_err(DomainError::from)?;
    let rows = collect_existing_article_rows_by_id(&tx, ids)?;
    mark_rows_read(&tx, &rows)?;

    tx.commit().map_err(DomainError::from)?;
    Ok(())
}

pub(crate) fn toggle_article_star_with_conn(
    conn: &rusqlite::Connection,
    article_id: ArticleId,
    starred: bool,
) -> Result<(), AppError> {
    let tx = conn.unchecked_transaction().map_err(DomainError::from)?;
    let repo = SqliteArticleRepository::new(&tx);
    repo.mark_as_starred(&article_id, starred)?;

    let mutation_type = if starred {
        PendingMutationType::Star
    } else {
        PendingMutationType::Unstar
    };
    maybe_queue_mutation_in_current_transaction(&tx, &article_id, mutation_type)?;

    tx.commit().map_err(DomainError::from)?;
    Ok(())
}

pub(crate) fn mark_feed_read_with_conn(
    conn: &rusqlite::Connection,
    feed_id: FeedId,
) -> Result<Vec<String>, AppError> {
    let tx = conn.unchecked_transaction().map_err(DomainError::from)?;
    let rows = collect_feed_unread_rows(&tx, &feed_id)?;
    mark_rows_read(&tx, &rows)?;
    tx.commit().map_err(DomainError::from)?;
    Ok(rows.into_iter().map(|row| row.article_id).collect())
}

pub(crate) fn mark_folder_read_with_conn(
    conn: &rusqlite::Connection,
    folder_id: FolderId,
) -> Result<Vec<String>, AppError> {
    let tx = conn.unchecked_transaction().map_err(DomainError::from)?;
    let rows = collect_folder_unread_rows(&tx, &folder_id)?;
    mark_rows_read(&tx, &rows)?;
    tx.commit().map_err(DomainError::from)?;
    Ok(rows.into_iter().map(|row| row.article_id).collect())
}

pub(crate) fn record_article_view_with_conn(
    conn: &rusqlite::Connection,
    account_id: AccountId,
    article_id: ArticleId,
) -> Result<(), AppError> {
    let repo = SqliteArticleRepository::new(conn);
    repo.record_view(&account_id, &article_id)?;
    Ok(())
}

#[tauri::command]
pub fn mark_article_read(
    state: State<'_, AppState>,
    article_id: String,
    read: Option<bool>,
) -> Result<(), AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let article_id = ArticleId(article_id);
    let read = read.unwrap_or(true);
    mark_article_read_with_conn(db.writer(), article_id, read)
}

#[tauri::command]
pub fn record_article_view(
    state: State<'_, AppState>,
    account_id: String,
    article_id: String,
) -> Result<(), AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    record_article_view_with_conn(db.writer(), AccountId(account_id), ArticleId(article_id))
}

#[tauri::command]
pub fn clear_article_view_history(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<u64, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteArticleRepository::new(db.writer());
    Ok(repo.clear_view_history(&AccountId(account_id))?)
}

#[tauri::command]
pub fn mark_articles_read(
    state: State<'_, AppState>,
    article_ids: Vec<String>,
) -> Result<(), AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let ids: Vec<ArticleId> = article_ids.iter().map(|id| ArticleId(id.clone())).collect();
    mark_articles_read_with_conn(db.writer(), &ids)
}

#[tauri::command]
pub fn mark_feed_read(
    state: State<'_, AppState>,
    feed_id: String,
) -> Result<Vec<String>, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let feed_id = FeedId(feed_id);
    mark_feed_read_with_conn(db.writer(), feed_id)
}

#[tauri::command]
pub fn mark_folder_read(
    state: State<'_, AppState>,
    folder_id: String,
) -> Result<Vec<String>, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let folder_id = FolderId(folder_id);
    mark_folder_read_with_conn(db.writer(), folder_id)
}

#[tauri::command]
pub fn toggle_article_star(
    state: State<'_, AppState>,
    article_id: String,
    starred: bool,
) -> Result<(), AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let article_id = ArticleId(article_id);
    toggle_article_star_with_conn(db.writer(), article_id, starred)
}
