use std::collections::HashMap;

use tauri::State;

use crate::commands::dto::{AppError, ArticleDto, TagDto};
use crate::commands::AppState;
use crate::domain::tag::Tag;
use crate::domain::types::{AccountId, ArticleId, TagId};
use crate::infra::db::sqlite_tag::SqliteTagRepository;
use crate::repository::article::{ArticleListMode, Pagination};
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

fn has_duplicate_tag_name(tags: &[Tag], tag_id: &str, name: &str) -> bool {
    tags.iter()
        .any(|tag| tag.id.0 != tag_id && tag.name.eq_ignore_ascii_case(name))
}

fn parse_article_list_mode(mode: Option<&str>) -> Result<ArticleListMode, AppError> {
    ArticleListMode::from_optional_str(mode).map_err(|message| AppError::UserVisible { message })
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

    if has_duplicate_tag_name(&tags, &tag_id, &name) {
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

fn delete_tag_impl(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
    tag_id: String,
) -> Result<(), AppError> {
    let db = lock_db(db)?;
    let repo = SqliteTagRepository::new(db.writer());
    repo.delete(&TagId(tag_id))?;
    Ok(())
}

#[tauri::command]
pub fn delete_tag(state: State<'_, AppState>, tag_id: String) -> Result<(), AppError> {
    delete_tag_impl(&state.db, tag_id)
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
    mode: Option<String>,
    offset: Option<usize>,
    limit: Option<usize>,
    account_id: Option<String>,
) -> Result<Vec<ArticleDto>, AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteTagRepository::new(db.reader());
    let pagination = Pagination {
        offset: offset.unwrap_or(0),
        limit: limit.unwrap_or(50),
    };
    let aid = account_id.map(AccountId);
    let mode = parse_article_list_mode(mode.as_deref())?;
    let articles = repo.find_articles_by_tag(&TagId(tag_id), &pagination, aid.as_ref(), mode)?;
    Ok(articles.into_iter().map(ArticleDto::from).collect())
}

#[tauri::command]
pub fn get_tag_article_counts(
    state: State<'_, AppState>,
    account_id: Option<String>,
) -> Result<HashMap<String, usize>, AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteTagRepository::new(db.reader());
    let aid = account_id.map(AccountId);
    let counts = repo.count_articles_per_tag(aid.as_ref())?;
    Ok(counts.into_iter().map(|(id, c)| (id.0, c)).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::db::connection::DbManager;

    fn test_db() -> std::sync::Mutex<DbManager> {
        std::sync::Mutex::new(DbManager::new_in_memory().unwrap())
    }

    #[test]
    fn validate_color_accepts_full_hex_and_rejects_empty_short_or_invalid_values() {
        assert!(validate_color("#ff0000"));
        assert!(validate_color("#FF0000"));
        assert!(validate_color("#Cf7868"));

        assert!(!validate_color(""));
        assert!(!validate_color("#fff"));
        assert!(!validate_color("ff0000"));
        assert!(!validate_color("#gg0000"));
    }

    #[test]
    fn duplicate_tag_name_check_rejects_other_tags_case_insensitively() {
        let current = Tag {
            id: TagId("tag-current".to_string()),
            name: "Inbox".to_string(),
            color: None,
        };
        let other = Tag {
            id: TagId("tag-other".to_string()),
            name: "Read Later".to_string(),
            color: None,
        };
        let tags = vec![current, other];

        assert!(has_duplicate_tag_name(&tags, "tag-current", "read later"));
        assert!(has_duplicate_tag_name(&tags, "tag-current", "READ LATER"));
        assert!(!has_duplicate_tag_name(&tags, "tag-current", "Inbox"));
        assert!(!has_duplicate_tag_name(&tags, "tag-current", "inbox"));
    }

    #[test]
    fn delete_missing_tag_is_successful_noop() {
        let db = test_db();

        delete_tag_impl(&db, "missing-tag".to_string()).unwrap();
    }
}
