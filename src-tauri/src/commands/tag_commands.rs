use std::collections::HashMap;

use tauri::State;

use crate::commands::dto::{AppError, ArticleDto, TagDto};
use crate::commands::AppState;
use crate::domain::tag::Tag;
use crate::domain::types::{AccountId, ArticleId, TagId};
use crate::infra::db::sqlite_tag::SqliteTagRepository;
use crate::repository::article::{ArticleListMode, Pagination};
use crate::repository::tag::TagRepository;

const DEFAULT_TAG_ARTICLE_LIST_LIMIT: usize = 50;
const MAX_TAG_ARTICLE_LIST_LIMIT: usize = 200;

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
    tags.iter()
        .any(|tag| tag.id.0 != tag_id && tag.name.eq_ignore_ascii_case(name))
}

fn parse_article_list_mode(mode: Option<&str>) -> Result<ArticleListMode, AppError> {
    ArticleListMode::from_optional_str(mode).map_err(|message| AppError::UserVisible { message })
}

fn normalize_tag_article_list_limit(limit: Option<usize>) -> Result<usize, AppError> {
    let limit = limit.unwrap_or(DEFAULT_TAG_ARTICLE_LIST_LIMIT);
    if limit > MAX_TAG_ARTICLE_LIST_LIMIT {
        return Err(AppError::UserVisible {
            message: format!("Tag article list limit must be {MAX_TAG_ARTICLE_LIST_LIMIT} or less"),
        });
    }
    Ok(limit)
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
    let color = normalize_color(color)?;

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
    tag_article_impl(&state.db, article_id, tag_id)
}

fn tag_article_impl(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
    article_id: String,
    tag_id: String,
) -> Result<(), AppError> {
    let db = lock_db(db)?;
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
    untag_article_impl(&state.db, article_id, tag_id)
}

fn untag_article_impl(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
    article_id: String,
    tag_id: String,
) -> Result<(), AppError> {
    let db = lock_db(db)?;
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
    let limit = normalize_tag_article_list_limit(limit)?;
    let pagination = Pagination {
        offset: offset.unwrap_or(0),
        limit,
    };
    let aid = account_id.map(AccountId);
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
    fn normalize_color_lowercases_full_hex_and_treats_empty_as_none() {
        assert_eq!(normalize_color(None).unwrap(), None);
        assert_eq!(normalize_color(Some(String::new())).unwrap(), None);
        assert_eq!(normalize_color(Some("   ".to_string())).unwrap(), None);
        assert_eq!(
            normalize_color(Some("#FF0000".to_string())).unwrap(),
            Some("#ff0000".to_string())
        );
        assert_eq!(
            normalize_color(Some("#Cf7868".to_string())).unwrap(),
            Some("#cf7868".to_string())
        );
    }

    #[test]
    fn normalize_color_rejects_short_hex_and_invalid_values() {
        assert!(matches!(
            normalize_color(Some("#fff".to_string())),
            Err(AppError::UserVisible { message }) if message == "Color must be a valid hex color (e.g. #ff0000)"
        ));
        assert!(matches!(
            normalize_color(Some("ff0000".to_string())),
            Err(AppError::UserVisible { message }) if message == "Color must be a valid hex color (e.g. #ff0000)"
        ));
        assert!(matches!(
            normalize_color(Some("#gg0000".to_string())),
            Err(AppError::UserVisible { message }) if message == "Color must be a valid hex color (e.g. #ff0000)"
        ));
    }

    #[test]
    fn create_tag_trims_name_before_saving() {
        let db = test_db();

        let tag = create_tag_impl(&db, "  Read Later  ".to_string(), None).unwrap();

        assert_eq!(tag.name, "Read Later");
    }

    #[test]
    fn create_tag_rejects_names_over_50_characters_after_trim() {
        let db = test_db();

        create_tag_impl(&db, format!(" {} ", "a".repeat(50)), None)
            .expect("50 character tag name should be accepted after trimming");

        let error = create_tag_impl(&db, "a".repeat(51), None)
            .expect_err("51 character tag name should be rejected");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Tag name must be 50 characters or less"
        ));
    }

    #[test]
    fn create_tag_lowercases_color_before_saving() {
        let db = test_db();

        let tag = create_tag_impl(&db, "Accent".to_string(), Some("#Cf7868".to_string())).unwrap();

        assert_eq!(tag.color.as_deref(), Some("#cf7868"));
    }

    #[test]
    fn list_articles_by_tag_rejects_unknown_mode_with_user_visible_error() {
        let db = test_db();

        let error = list_articles_by_tag_impl(
            &db,
            "tag-1".to_string(),
            Some("archived".to_string()),
            None,
            None,
            None,
        )
        .expect_err("unknown tag article mode should be rejected");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Invalid article list mode: archived"
        ));
    }

    #[test]
    fn list_articles_by_tag_accepts_boundary_limit() {
        let db = test_db();

        let articles = list_articles_by_tag_impl(
            &db,
            "tag-1".to_string(),
            None,
            None,
            Some(MAX_TAG_ARTICLE_LIST_LIMIT),
            None,
        )
        .expect("max tag article list limit should be accepted");

        assert!(articles.is_empty());
    }

    #[test]
    fn list_articles_by_tag_rejects_limit_over_boundary() {
        let db = test_db();

        let error = list_articles_by_tag_impl(
            &db,
            "tag-1".to_string(),
            None,
            None,
            Some(MAX_TAG_ARTICLE_LIST_LIMIT + 1),
            None,
        )
        .expect_err("tag article list limit over max should be rejected");

        assert!(matches!(
            error,
            AppError::UserVisible { message }
                if message == "Tag article list limit must be 200 or less"
        ));
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

    #[test]
    fn tag_article_missing_article_or_tag_is_user_visible_error() {
        let db = test_db();

        let article_error = tag_article_impl(
            &db,
            "missing-article".to_string(),
            "missing-tag".to_string(),
        )
        .expect_err("missing article and tag should surface as a command error");

        assert!(matches!(
            article_error,
            AppError::UserVisible { message } if message.contains("FOREIGN KEY constraint failed")
        ));
    }

    #[test]
    fn untag_article_missing_link_is_successful_noop() {
        let db = test_db();

        untag_article_impl(
            &db,
            "missing-article".to_string(),
            "missing-tag".to_string(),
        )
        .unwrap();
    }
}
