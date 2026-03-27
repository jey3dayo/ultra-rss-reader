use tauri::State;

use crate::commands::dto::{AppError, ArticleDto, TagDto};
use crate::commands::AppState;
use crate::domain::tag::Tag;
use crate::domain::types::{ArticleId, TagId};
use crate::infra::db::sqlite_tag::SqliteTagRepository;
use crate::repository::article::Pagination;
use crate::repository::tag::TagRepository;

fn lock_db(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
) -> Result<std::sync::MutexGuard<'_, crate::infra::db::connection::DbManager>, AppError> {
    db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })
}

#[tauri::command]
pub fn list_tags(state: State<'_, AppState>) -> Result<Vec<TagDto>, AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteTagRepository::new(db.reader());
    let tags = repo.find_all()?;
    Ok(tags.into_iter().map(TagDto::from).collect())
}

#[tauri::command]
pub fn create_tag(
    state: State<'_, AppState>,
    name: String,
    color: Option<String>,
) -> Result<TagDto, AppError> {
    let tag = Tag {
        id: TagId::new(),
        name,
        color,
    };
    let db = lock_db(&state.db)?;
    let repo = SqliteTagRepository::new(db.writer());
    repo.save(&tag)?;
    Ok(TagDto::from(tag))
}

#[tauri::command]
pub fn delete_tag(state: State<'_, AppState>, tag_id: String) -> Result<(), AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteTagRepository::new(db.writer());
    repo.delete(&TagId(tag_id))?;
    Ok(())
}

#[tauri::command]
pub fn tag_article(
    state: State<'_, AppState>,
    article_id: String,
    tag_id: String,
) -> Result<(), AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteTagRepository::new(db.writer());
    repo.tag_article(&ArticleId(article_id), &TagId(tag_id))?;
    Ok(())
}

#[tauri::command]
pub fn untag_article(
    state: State<'_, AppState>,
    article_id: String,
    tag_id: String,
) -> Result<(), AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteTagRepository::new(db.writer());
    repo.untag_article(&ArticleId(article_id), &TagId(tag_id))?;
    Ok(())
}

#[tauri::command]
pub fn get_article_tags(
    state: State<'_, AppState>,
    article_id: String,
) -> Result<Vec<TagDto>, AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteTagRepository::new(db.reader());
    let tags = repo.find_tags_for_article(&ArticleId(article_id))?;
    Ok(tags.into_iter().map(TagDto::from).collect())
}

#[tauri::command]
pub fn list_articles_by_tag(
    state: State<'_, AppState>,
    tag_id: String,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<ArticleDto>, AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteTagRepository::new(db.reader());
    let pagination = Pagination {
        offset: offset.unwrap_or(0),
        limit: limit.unwrap_or(50),
    };
    let articles = repo.find_articles_by_tag(&TagId(tag_id), &pagination)?;
    Ok(articles.into_iter().map(ArticleDto::from).collect())
}
