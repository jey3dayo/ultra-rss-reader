use tauri::State;
use unicode_normalization::UnicodeNormalization;

use crate::commands::dto::{AppError, ArticleDto, FeedArticleSummaryDto};
use crate::commands::AppState;
use crate::domain::article::Article;
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::sanitizer;
use crate::repository::article::{ArticleListMode, ArticleRepository, Pagination};

pub(crate) const DEFAULT_ARTICLE_LIST_LIMIT: usize = 50;
pub(crate) const DEFAULT_RECENT_ARTICLE_LIST_LIMIT: usize = 20;
pub(crate) const MAX_ARTICLE_COMMAND_LIST_LIMIT: usize = 200;
// Offset pagination is a best-effort UI contract: page boundaries may shift if
// articles are inserted, deleted, or reclassified between page requests.
pub(crate) const MAX_ARTICLE_COMMAND_LIST_OFFSET: usize = 10_000;
pub(crate) const ARTICLE_SEARCH_QUERY_MAX_CHARS: usize = 128;

pub(crate) fn normalize_backend_article_search_query(query: &str) -> String {
    query
        .nfkc()
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(ARTICLE_SEARCH_QUERY_MAX_CHARS)
        .collect()
}

pub(crate) fn article_command_pagination(
    offset: Option<usize>,
    limit: Option<usize>,
    default_limit: usize,
) -> Result<Pagination, AppError> {
    let offset = offset.unwrap_or(0);
    if offset > MAX_ARTICLE_COMMAND_LIST_OFFSET {
        return Err(AppError::UserVisible {
            message: format!(
                "Article list offset must be {MAX_ARTICLE_COMMAND_LIST_OFFSET} or less"
            ),
        });
    }

    let limit = limit.unwrap_or(default_limit);
    if limit > MAX_ARTICLE_COMMAND_LIST_LIMIT {
        return Err(AppError::UserVisible {
            message: format!("Article list limit must be {MAX_ARTICLE_COMMAND_LIST_LIMIT} or less"),
        });
    }

    Ok(Pagination { offset, limit })
}

pub(crate) fn parse_article_list_mode(mode: Option<&str>) -> Result<ArticleListMode, AppError> {
    ArticleListMode::from_optional_str(mode).map_err(|message| AppError::UserVisible { message })
}

pub(crate) fn validate_feed_article_filters(
    unread_only: Option<bool>,
    starred_only: Option<bool>,
) -> Result<(), AppError> {
    if unread_only.unwrap_or(false) && starred_only.unwrap_or(false) {
        return Err(AppError::UserVisible {
            message: "Article list filters are mutually exclusive".to_string(),
        });
    }

    Ok(())
}

pub(crate) fn resolve_feed_article_list_mode(
    unread_only: Option<bool>,
    starred_only: Option<bool>,
) -> ArticleListMode {
    if starred_only.unwrap_or(false) {
        ArticleListMode::Starred
    } else if unread_only.unwrap_or(false) {
        ArticleListMode::Unread
    } else {
        ArticleListMode::All
    }
}

pub(crate) fn repair_outdated_articles_for_render(
    repo: &SqliteArticleRepository<'_>,
    articles: Vec<Article>,
) -> Result<Vec<Article>, AppError> {
    articles
        .into_iter()
        .map(|mut article| {
            if article.sanitizer_version < sanitizer::SANITIZER_VERSION {
                let sanitized = sanitizer::sanitize_html(&article.content_raw);
                repo.update_sanitized(&article.id, &sanitized, sanitizer::SANITIZER_VERSION)?;
                article.content_sanitized = sanitized;
                article.sanitizer_version = sanitizer::SANITIZER_VERSION;
            }
            Ok(article)
        })
        .collect()
}

pub(crate) fn article_summary_list_dtos(
    articles: Vec<crate::domain::article::ArticleListItem>,
) -> Vec<ArticleDto> {
    articles
        .into_iter()
        .map(ArticleDto::list_item_from_summary)
        .collect()
}

#[tauri::command]
pub fn get_article(state: State<'_, AppState>, article_id: String) -> Result<ArticleDto, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteArticleRepository::new(db.writer());
    let article =
        repo.find_by_id(&ArticleId(article_id))?
            .ok_or_else(|| AppError::UserVisible {
                message: "Article not found".to_string(),
            })?;
    let mut articles = repair_outdated_articles_for_render(&repo, vec![article])?;
    let article = articles.pop().ok_or_else(|| AppError::UserVisible {
        message: "Article not found".to_string(),
    })?;
    Ok(ArticleDto::from(article))
}

#[tauri::command]
pub fn list_articles(
    state: State<'_, AppState>,
    feed_id: String,
    unread_only: Option<bool>,
    starred_only: Option<bool>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<ArticleDto>, AppError> {
    validate_feed_article_filters(unread_only, starred_only)?;
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteArticleRepository::new(db.writer());
    let pagination = article_command_pagination(offset, limit, DEFAULT_ARTICLE_LIST_LIMIT)?;
    let mode = resolve_feed_article_list_mode(unread_only, starred_only);
    let articles = repo.list_by_feed(&FeedId(feed_id), &pagination, mode)?;
    Ok(article_summary_list_dtos(articles))
}

#[tauri::command]
pub fn list_account_articles(
    state: State<'_, AppState>,
    account_id: String,
    unread_only: Option<bool>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<ArticleDto>, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteArticleRepository::new(db.writer());
    let pagination = article_command_pagination(offset, limit, DEFAULT_ARTICLE_LIST_LIMIT)?;
    let mode = if unread_only.unwrap_or(false) {
        ArticleListMode::Unread
    } else {
        ArticleListMode::All
    };
    let articles = repo.list_by_account(&AccountId(account_id), &pagination, mode)?;
    Ok(article_summary_list_dtos(articles))
}

#[tauri::command]
pub fn list_feed_article_summaries(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<Vec<FeedArticleSummaryDto>, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteArticleRepository::new(db.reader());
    let summaries = repo.list_feed_article_summaries_by_account(&AccountId(account_id))?;
    Ok(summaries
        .into_iter()
        .map(|summary| FeedArticleSummaryDto {
            feed_id: summary.feed_id.0,
            latest_article_at: summary.latest_article_at,
            starred_count: summary.starred_count,
            recent_article_count: summary.recent_article_count,
        })
        .collect())
}

#[tauri::command]
pub fn list_folder_articles(
    state: State<'_, AppState>,
    folder_id: String,
    mode: Option<String>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<ArticleDto>, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteArticleRepository::new(db.writer());
    let pagination = article_command_pagination(offset, limit, DEFAULT_ARTICLE_LIST_LIMIT)?;
    let mode = parse_article_list_mode(mode.as_deref())?;
    let folder_id = FolderId(folder_id);
    let articles = repo.list_by_folder(&folder_id, &pagination, mode)?;
    Ok(article_summary_list_dtos(articles))
}

#[tauri::command]
pub fn list_starred_articles(
    state: State<'_, AppState>,
    account_id: String,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<ArticleDto>, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteArticleRepository::new(db.writer());
    let pagination = article_command_pagination(offset, limit, DEFAULT_ARTICLE_LIST_LIMIT)?;
    let articles = repo.list_by_account(
        &AccountId(account_id),
        &pagination,
        ArticleListMode::Starred,
    )?;
    Ok(article_summary_list_dtos(articles))
}

#[tauri::command]
pub fn list_recent_articles(
    state: State<'_, AppState>,
    account_id: String,
    mode: Option<String>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<ArticleDto>, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteArticleRepository::new(db.writer());
    let pagination = article_command_pagination(offset, limit, DEFAULT_RECENT_ARTICLE_LIST_LIMIT)?;
    let mode = parse_article_list_mode(mode.as_deref())?;
    let articles =
        repo.list_recently_viewed_by_account(&AccountId(account_id), &pagination, mode)?;
    Ok(articles
        .into_iter()
        .map(ArticleDto::list_item_from_summary_view_history)
        .collect())
}

#[tauri::command]
pub fn count_account_unread_articles(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<i32, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteArticleRepository::new(db.reader());
    let unread_count = repo.count_unread_by_account(&AccountId(account_id))?;
    Ok(unread_count)
}

#[tauri::command]
pub fn count_account_starred_articles(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<i32, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteArticleRepository::new(db.reader());
    let starred_count = repo.count_starred_by_account(&AccountId(account_id))?;
    Ok(starred_count)
}

#[tauri::command]
pub fn search_articles(
    state: State<'_, AppState>,
    account_id: String,
    query: String,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<ArticleDto>, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteArticleRepository::new(db.writer());
    let pagination = article_command_pagination(offset, limit, DEFAULT_ARTICLE_LIST_LIMIT)?;
    let normalized_query = normalize_backend_article_search_query(&query);
    let articles = repo.search_list(&AccountId(account_id), &normalized_query, &pagination)?;
    Ok(article_summary_list_dtos(articles))
}
