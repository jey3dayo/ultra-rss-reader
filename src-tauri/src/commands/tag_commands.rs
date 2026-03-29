use std::collections::HashMap;

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
    if name.chars().count() > 50 {
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

    let tag = Tag {
        id: TagId::new(),
        name,
        color,
    };
    let result = repo.find_or_create(&tag)?;
    Ok(TagDto::from(result))
}

#[tauri::command]
pub fn rename_tag(
    state: State<'_, AppState>,
    tag_id: String,
    name: String,
    color: Option<String>,
) -> Result<TagDto, AppError> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::UserVisible {
            message: "Tag name cannot be empty".to_string(),
        });
    }
    if name.chars().count() > 50 {
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

    // Find current tag
    let tags = repo.find_all()?;
    let current = tags
        .iter()
        .find(|t| t.id.0 == tag_id)
        .ok_or_else(|| AppError::UserVisible {
            message: "Tag not found".to_string(),
        })?;

    // Check for duplicate tag name (case-sensitive)
    if tags.iter().any(|t| t.name == name && t.id.0 != tag_id) {
        return Err(AppError::UserVisible {
            message: format!("Tag name \"{name}\" already exists"),
        });
    }

    let updated = Tag {
        id: current.id.clone(),
        name,
        color,
    };
    repo.save(&updated)?;
    Ok(TagDto::from(updated))
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

#[tauri::command]
pub fn get_tag_article_counts(
    state: State<'_, AppState>,
) -> Result<HashMap<String, usize>, AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteTagRepository::new(db.reader());
    let counts = repo.count_articles_per_tag()?;
    Ok(counts.into_iter().map(|(id, c)| (id.0, c)).collect())
}
