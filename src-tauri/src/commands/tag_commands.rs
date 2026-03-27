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

fn validate_color(color: &str) -> bool {
    if color.len() != 7 {
        return false;
    }
    let bytes = color.as_bytes();
    if bytes[0] != b'#' {
        return false;
    }
    bytes[1..].iter().all(|b| b.is_ascii_hexdigit())
}

#[tauri::command]
pub fn create_tag(
    state: State<'_, AppState>,
    name: String,
    color: Option<String>,
) -> Result<TagDto, AppError> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::UserVisible {
            message: "Tag name cannot be empty".to_string(),
        });
    }
    if name.len() > 50 {
        return Err(AppError::UserVisible {
            message: "Tag name must be 50 characters or less".to_string(),
        });
    }
    if let Some(ref c) = color {
        if !validate_color(c) {
            return Err(AppError::UserVisible {
                message: "Color must be a valid hex color (e.g. #ff0000)".to_string(),
            });
        }
    }

    let db = lock_db(&state.db)?;
    let repo = SqliteTagRepository::new(db.writer());

    // Return existing tag if one with the same name exists (case-insensitive)
    if let Some(existing) = repo.find_by_name(&name)? {
        return Ok(TagDto::from(existing));
    }

    let tag = Tag {
        id: TagId::new(),
        name,
        color,
    };
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
