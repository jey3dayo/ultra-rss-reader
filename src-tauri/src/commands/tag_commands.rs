use std::collections::HashMap;

use rusqlite::{params, Connection, OptionalExtension, Transaction, TransactionBehavior};
use tauri::State;

use crate::commands::article_commands::{article_command_pagination, DEFAULT_ARTICLE_LIST_LIMIT};
use crate::commands::dto::{AppError, ArticleDto, TagDto};
use crate::commands::AppState;
use crate::domain::error::DomainError;
use crate::domain::tag::Tag;
use crate::domain::types::{AccountId, ArticleId, TagId};
use crate::infra::db::sqlite_tag::SqliteTagRepository;
use crate::repository::article::ArticleListMode;
use crate::repository::tag::TagRepository;

fn lock_db(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
) -> Result<std::sync::MutexGuard<'_, crate::infra::db::connection::DbManager>, AppError> {
    crate::commands::lock_db(db)
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

fn normalize_color(color: Option<String>) -> Result<Option<String>, AppError> {
    let Some(color) = color else {
        return Ok(None);
    };
    let color = color.trim();
    if color.is_empty() {
        return Ok(None);
    }
    if !validate_color(color) {
        return Err(AppError::UserVisible {
            message: "Color must be a valid hex color (e.g. #ff0000)".to_string(),
        });
    }
    Ok(Some(color.to_ascii_lowercase()))
}

fn has_duplicate_tag_name(tags: &[Tag], tag_id: &str, name: &str) -> bool {
    // Match repository find_by_name / SQLite NOCASE policy: ASCII case-insensitive only.
    tags.iter()
        .any(|tag| tag.id.0 != tag_id && tag.name.eq_ignore_ascii_case(name))
}

fn is_unique_constraint_domain_error(error: &DomainError) -> bool {
    matches!(
        error,
        DomainError::Persistence(message) if message.contains("UNIQUE constraint failed")
    )
}

fn validate_article_tag_targets(
    conn: &Connection,
    article_id: &str,
    tag_id: &str,
) -> Result<(), AppError> {
    let article_exists = conn
        .query_row(
            "SELECT 1 FROM articles WHERE id = ?1",
            params![article_id],
            |_| Ok(()),
        )
        .optional()
        .map_err(DomainError::from)?
        .is_some();
    if !article_exists {
        return Err(AppError::UserVisible {
            message: "Article not found".to_string(),
        });
    }

    let tag_exists = conn
        .query_row("SELECT 1 FROM tags WHERE id = ?1", params![tag_id], |_| {
            Ok(())
        })
        .optional()
        .map_err(DomainError::from)?
        .is_some();
    if !tag_exists {
        return Err(AppError::UserVisible {
            message: "Tag not found".to_string(),
        });
    }

    Ok(())
}

fn begin_immediate_transaction(conn: &Connection) -> Result<Transaction<'_>, AppError> {
    Transaction::new_unchecked(conn, TransactionBehavior::Immediate)
        .map_err(DomainError::from)
        .map_err(AppError::from)
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
    create_tag_impl(&state.db, name, color)
}

fn create_tag_impl(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
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
    let color = normalize_color(color)?;

    let db = lock_db(db)?;
    let tx = begin_immediate_transaction(db.writer())?;
    let tag = {
        let repo = SqliteTagRepository::new(&tx);
        if let Some(existing) = repo.find_by_name(&name)? {
            return Err(AppError::UserVisible {
                message: format!("Tag name \"{}\" already exists", existing.name),
            });
        }

        let tag = Tag {
            id: TagId::new(),
            name,
            color,
        };
        if let Err(error) = repo.save(&tag) {
            if is_unique_constraint_domain_error(&error) {
                return Err(AppError::UserVisible {
                    message: format!("Tag name \"{}\" already exists", tag.name),
                });
            }
            return Err(error.into());
        }
        tag
    };
    tx.commit().map_err(DomainError::from)?;
    Ok(TagDto::from(tag))
}

#[tauri::command]
pub fn rename_tag(
    state: State<'_, AppState>,
    tag_id: String,
    name: String,
    color: Option<String>,
) -> Result<TagDto, AppError> {
    rename_tag_impl(&state.db, tag_id, name, color)
}

fn rename_tag_impl(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
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
    let color = normalize_color(color)?;

    let db = lock_db(db)?;
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
    let tx = begin_immediate_transaction(db.writer())?;
    {
        let repo = SqliteTagRepository::new(&tx);
        repo.delete(&TagId(tag_id))?;
    }
    tx.commit().map_err(DomainError::from)?;
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
    tag_article_impl(&state.db, article_id, tag_id)
}

fn tag_article_impl(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
    article_id: String,
    tag_id: String,
) -> Result<(), AppError> {
    let db = lock_db(db)?;
    let tx = begin_immediate_transaction(db.writer())?;
    validate_article_tag_targets(&tx, &article_id, &tag_id)?;
    {
        let repo = SqliteTagRepository::new(&tx);
        repo.tag_article(&ArticleId(article_id), &TagId(tag_id))?;
    }
    tx.commit().map_err(DomainError::from)?;
    Ok(())
}

#[tauri::command]
pub fn create_tag_and_assign_article(
    state: State<'_, AppState>,
    article_id: String,
    name: String,
    color: Option<String>,
) -> Result<TagDto, AppError> {
    create_tag_and_assign_article_impl(&state.db, article_id, name, color)
}

fn create_tag_and_assign_article_impl(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
    article_id: String,
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
    let color = normalize_color(color)?;

    let db = lock_db(db)?;
    let tx = begin_immediate_transaction(db.writer())?;
    let tag = {
        let repo = SqliteTagRepository::new(&tx);
        let tag = repo.find_or_create(&Tag {
            id: TagId::new(),
            name,
            color,
        })?;
        validate_article_tag_targets(&tx, &article_id, &tag.id.0)?;
        repo.tag_article(&ArticleId(article_id), &tag.id)?;
        tag
    };
    tx.commit().map_err(DomainError::from)?;
    Ok(TagDto::from(tag))
}

#[tauri::command]
pub fn untag_article(
    state: State<'_, AppState>,
    article_id: String,
    tag_id: String,
) -> Result<(), AppError> {
    untag_article_impl(&state.db, article_id, tag_id)
}

fn untag_article_impl(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
    article_id: String,
    tag_id: String,
) -> Result<(), AppError> {
    let db = lock_db(db)?;
    let tx = begin_immediate_transaction(db.writer())?;
    validate_article_tag_targets(&tx, &article_id, &tag_id)?;
    {
        let repo = SqliteTagRepository::new(&tx);
        repo.untag_article(&ArticleId(article_id), &TagId(tag_id))?;
    }
    tx.commit().map_err(DomainError::from)?;
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
    list_articles_by_tag_impl(&state.db, tag_id, mode, offset, limit, account_id)
}

fn list_articles_by_tag_impl(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
    tag_id: String,
    mode: Option<String>,
    offset: Option<usize>,
    limit: Option<usize>,
    account_id: Option<String>,
) -> Result<Vec<ArticleDto>, AppError> {
    let db = lock_db(db)?;
    let repo = SqliteTagRepository::new(db.reader());
    let mode = parse_article_list_mode(mode.as_deref())?;
    let pagination = article_command_pagination(offset, limit, DEFAULT_ARTICLE_LIST_LIMIT)?;
    let aid = account_id.map(AccountId);
    let articles = repo.list_articles_by_tag(&TagId(tag_id), &pagination, aid.as_ref(), mode)?;
    Ok(articles
        .into_iter()
        .map(ArticleDto::list_item_from_summary)
        .collect())
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
mod tests;
