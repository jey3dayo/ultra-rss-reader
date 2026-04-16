use reqwest::header::{HeaderMap, CONTENT_SECURITY_POLICY, X_FRAME_OPTIONS};
use tauri::State;

use crate::commands::dto::{AppError, ArticleDto, FeedIntegrityIssueDto, FeedIntegrityReportDto};
use crate::commands::AppState;
use crate::domain::error::DomainError;
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
use crate::repository::article::{ArticleRepository, Pagination};
use crate::repository::feed::FeedRepository;
use crate::repository::pending_mutation::{PendingMutation, PendingMutationRepository};

#[tauri::command]
pub fn open_in_browser(url: String, background: Option<bool>) -> Result<(), AppError> {
    crate::commands::parse_browser_http_url(&url)?;
    let platform_info = crate::platform::PlatformInfo::current();

    if should_use_background_browser_open(background.unwrap_or(false), &platform_info) {
        // macOS: use `open -g` to open in background
        std::process::Command::new("open")
            .arg("-g")
            .arg(&url)
            .spawn()
            .map_err(|e| AppError::UserVisible {
                message: format!("Failed to open browser: {e}"),
            })?;
    } else {
        open::that(&url).map_err(|e| AppError::UserVisible {
            message: format!("Failed to open browser: {e}"),
        })?;
    }
    Ok(())
}

fn should_use_background_browser_open(
    background_requested: bool,
    info: &crate::platform::PlatformInfo,
) -> bool {
    background_requested && info.capabilities.supports_background_browser_open
}

fn supports_remote_mutations(account_kind: &str, feed_remote_id: Option<&str>) -> bool {
    matches!(account_kind, "FreshRss" | "Inoreader")
        && feed_remote_id.is_some_and(|remote_id| remote_id.starts_with("feed/"))
}

fn has_blocking_x_frame_options(headers: &HeaderMap) -> bool {
    headers
        .get_all(X_FRAME_OPTIONS)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .map(str::trim)
        .any(|value| !value.is_empty())
}

fn has_blocking_frame_ancestors(headers: &HeaderMap) -> bool {
    headers
        .get_all(CONTENT_SECURITY_POLICY)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .any(|policy| {
            policy
                .split(';')
                .map(str::trim)
                .find_map(|directive| {
                    directive
                        .strip_prefix("frame-ancestors")
                        .or_else(|| directive.strip_prefix("Frame-Ancestors"))
                })
                .map(|value| {
                    let sources = value.split_whitespace();
                    !sources.into_iter().any(|source| source == "*")
                })
                .unwrap_or(false)
        })
}

#[tauri::command]
pub async fn check_browser_embed_support(url: String) -> Result<bool, AppError> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(DomainError::from)?;

    let response = client.get(&url).send().await.map_err(DomainError::from)?;

    let headers = response.headers();
    Ok(!(has_blocking_x_frame_options(headers) || has_blocking_frame_ancestors(headers)))
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
pub fn list_account_articles(
    state: State<'_, AppState>,
    account_id: String,
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
    let articles = repo.find_by_account(&AccountId(account_id), &pagination)?;
    Ok(articles.into_iter().map(ArticleDto::from).collect())
}

#[tauri::command]
pub fn list_starred_articles(
    state: State<'_, AppState>,
    account_id: String,
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
    let articles = repo.find_starred_by_account(&AccountId(account_id), &pagination)?;
    Ok(articles.into_iter().map(ArticleDto::from).collect())
}

#[tauri::command]
pub fn count_account_unread_articles(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<i32, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteArticleRepository::new(db.reader());
    let unread_count = repo.count_unread_by_account(&AccountId(account_id))?;
    Ok(unread_count)
}

#[tauri::command]
pub fn count_account_starred_articles(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<i32, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteArticleRepository::new(db.reader());
    let starred_count = repo.count_starred_by_account(&AccountId(account_id))?;
    Ok(starred_count)
}

#[tauri::command]
pub fn get_feed_integrity_report(
    state: State<'_, AppState>,
) -> Result<FeedIntegrityReportDto, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteArticleRepository::new(db.reader());

    Ok(FeedIntegrityReportDto {
        orphaned_article_count: repo.count_orphaned_articles()?,
        orphaned_feeds: repo
            .list_orphaned_feed_groups()?
            .into_iter()
            .map(|group| FeedIntegrityIssueDto {
                missing_feed_id: group.missing_feed_id,
                article_count: group.article_count,
                latest_article_title: group.latest_article_title,
                latest_article_published_at: group.latest_article_published_at,
            })
            .collect(),
    })
}

#[tauri::command]
pub fn mark_article_read(
    state: State<'_, AppState>,
    article_id: String,
    read: Option<bool>,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let article_id = ArticleId(article_id);
    let repo = SqliteArticleRepository::new(db.writer());
    let read = read.unwrap_or(true);
    repo.mark_as_read(&article_id, read)?;

    // Recalculate unread count for the affected feed
    let feed_id_str: String = db
        .writer()
        .query_row(
            "SELECT feed_id FROM articles WHERE id = ?1",
            rusqlite::params![article_id.0],
            |row| row.get(0),
        )
        .map_err(DomainError::from)?;
    let feed_repo = SqliteFeedRepository::new(db.writer());
    feed_repo.recalculate_unread_count(&FeedId(feed_id_str))?;

    // Queue pending mutation for FreshRSS accounts
    let mutation_type = if read { "mark_read" } else { "mark_unread" };
    maybe_queue_mutation(db.writer(), &article_id, mutation_type)?;

    Ok(())
}

#[tauri::command]
pub fn mark_articles_read(
    state: State<'_, AppState>,
    article_ids: Vec<String>,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let ids: Vec<ArticleId> = article_ids.iter().map(|id| ArticleId(id.clone())).collect();
    let repo = SqliteArticleRepository::new(db.writer());
    repo.mark_many_as_read(&ids)?;

    // Recalculate unread counts for affected feeds
    if !ids.is_empty() {
        let placeholders: Vec<String> = ids
            .iter()
            .enumerate()
            .map(|(i, _)| format!("?{}", i + 1))
            .collect();
        let sql = format!(
            "SELECT DISTINCT feed_id FROM articles WHERE id IN ({})",
            placeholders.join(", ")
        );
        let mut stmt = db.writer().prepare(&sql).map_err(DomainError::from)?;
        let params: Vec<&dyn rusqlite::ToSql> =
            ids.iter().map(|id| &id.0 as &dyn rusqlite::ToSql).collect();
        let feed_ids: Vec<String> = stmt
            .query_map(params.as_slice(), |row| row.get::<_, String>(0))
            .map_err(DomainError::from)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(DomainError::from)?;
        let feed_repo = SqliteFeedRepository::new(db.writer());
        for fid in feed_ids {
            feed_repo.recalculate_unread_count(&FeedId(fid))?;
        }
    }

    // Queue pending mutations for FreshRSS/Inoreader articles
    for id in &ids {
        maybe_queue_mutation(db.writer(), id, "mark_read")?;
    }

    Ok(())
}

#[tauri::command]
pub fn mark_feed_read(state: State<'_, AppState>, feed_id: String) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let feed_id = FeedId(feed_id);

    // Collect unread article IDs *before* marking them read
    let newly_read_ids: Vec<String> = db
        .writer()
        .prepare(
            "SELECT a.id FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             JOIN accounts acc ON f.account_id = acc.id
             WHERE a.feed_id = ?1 AND a.is_read = 0 AND a.remote_id IS NOT NULL
             AND (acc.kind = 'FreshRss' OR acc.kind = 'Inoreader')",
        )
        .and_then(|mut stmt| {
            stmt.query_map(rusqlite::params![feed_id.0], |row| row.get::<_, String>(0))
                .and_then(|rows| rows.collect())
        })
        .map_err(DomainError::from)?;

    let repo = SqliteArticleRepository::new(db.writer());
    repo.mark_feed_as_read(&feed_id)?;

    // Recalculate unread count for the feed
    let feed_repo = SqliteFeedRepository::new(db.writer());
    feed_repo.recalculate_unread_count(&feed_id)?;

    // Queue pending mutations only for newly-marked articles
    for article_id in &newly_read_ids {
        maybe_queue_mutation(db.writer(), &ArticleId(article_id.clone()), "mark_read")?;
    }

    Ok(())
}

#[tauri::command]
pub fn mark_folder_read(state: State<'_, AppState>, folder_id: String) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let folder_id = FolderId(folder_id);

    // Collect unread article IDs *before* marking them read
    let newly_read_ids: Vec<String> = db
        .writer()
        .prepare(
            "SELECT a.id FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             JOIN accounts acc ON f.account_id = acc.id
             WHERE f.folder_id = ?1 AND a.is_read = 0 AND a.remote_id IS NOT NULL
             AND (acc.kind = 'FreshRss' OR acc.kind = 'Inoreader')",
        )
        .and_then(|mut stmt| {
            stmt.query_map(rusqlite::params![folder_id.0], |row| {
                row.get::<_, String>(0)
            })
            .and_then(|rows| rows.collect())
        })
        .map_err(DomainError::from)?;

    let repo = SqliteArticleRepository::new(db.writer());
    repo.mark_folder_as_read(&folder_id)?;

    // Recalculate unread counts for all feeds in the folder
    let mut stmt = db
        .writer()
        .prepare("SELECT id FROM feeds WHERE folder_id = ?1")
        .map_err(DomainError::from)?;
    let folder_feed_ids: Vec<String> = stmt
        .query_map(rusqlite::params![folder_id.0], |row| {
            row.get::<_, String>(0)
        })
        .map_err(DomainError::from)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DomainError::from)?;
    let feed_repo = SqliteFeedRepository::new(db.writer());
    for fid in folder_feed_ids {
        feed_repo.recalculate_unread_count(&FeedId(fid))?;
    }

    // Queue pending mutations only for newly-marked articles
    for article_id in &newly_read_ids {
        maybe_queue_mutation(db.writer(), &ArticleId(article_id.clone()), "mark_read")?;
    }

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
    let row: Option<(String, String, String, Option<String>)> = conn
        .query_row(
            "SELECT a.remote_id, acc.kind, f.account_id, f.remote_id
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
                    row.get::<_, Option<String>>(3)?,
                ))
            },
        )
        .ok();

    if let Some((remote_entry_id, account_kind, account_id, feed_remote_id)) = row {
        if supports_remote_mutations(&account_kind, feed_remote_id.as_deref()) {
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

#[cfg(test)]
mod tests {
    use super::check_browser_embed_support;
    use super::{
        has_blocking_frame_ancestors, has_blocking_x_frame_options, maybe_queue_mutation,
        should_use_background_browser_open, supports_remote_mutations,
    };
    use crate::domain::types::{AccountId, ArticleId, FeedId};
    use crate::infra::db::connection::DbManager;
    use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
    use crate::platform::{platform_info_for_kind, PlatformKind};
    use crate::repository::pending_mutation::PendingMutationRepository;
    use mockito::Server;
    use reqwest::header::{HeaderMap, HeaderValue, CONTENT_SECURITY_POLICY, X_FRAME_OPTIONS};

    #[test]
    fn x_frame_options_blocks_embedding() {
        let mut headers = HeaderMap::new();
        headers.insert(X_FRAME_OPTIONS, HeaderValue::from_static("SAMEORIGIN"));

        assert!(has_blocking_x_frame_options(&headers));
    }

    #[test]
    fn frame_ancestors_wildcard_does_not_block_embedding() {
        let mut headers = HeaderMap::new();
        headers.insert(
            CONTENT_SECURITY_POLICY,
            HeaderValue::from_static("default-src 'self'; frame-ancestors *"),
        );

        assert!(!has_blocking_frame_ancestors(&headers));
    }

    #[test]
    fn frame_ancestors_self_blocks_embedding() {
        let mut headers = HeaderMap::new();
        headers.insert(
            CONTENT_SECURITY_POLICY,
            HeaderValue::from_static(
                "default-src 'self'; frame-ancestors 'self' https://example.com",
            ),
        );

        assert!(has_blocking_frame_ancestors(&headers));
    }

    #[tokio::test]
    async fn embed_support_uses_get_response_headers() {
        let mut server = Server::new_async().await;
        let _mock = server
            .mock("GET", "/article")
            .with_status(200)
            .with_header("x-frame-options", "SAMEORIGIN")
            .create_async()
            .await;

        let supported = check_browser_embed_support(format!("{}/article", server.url()))
            .await
            .expect("embed check should succeed");

        assert!(!supported);
    }

    #[test]
    fn background_open_is_used_only_when_requested_and_supported() {
        let info = platform_info_for_kind(PlatformKind::Macos);

        assert!(should_use_background_browser_open(true, &info));
        assert!(!should_use_background_browser_open(false, &info));
    }

    #[test]
    fn unsupported_platform_falls_back_to_normal_open() {
        let info = platform_info_for_kind(PlatformKind::Windows);

        assert!(!should_use_background_browser_open(true, &info));
    }

    #[test]
    fn remote_mutations_require_provider_managed_greader_feed_ids() {
        assert!(supports_remote_mutations("FreshRss", Some("feed/1")));
        assert!(supports_remote_mutations(
            "Inoreader",
            Some("feed/http://example.com/rss")
        ));

        assert!(!supports_remote_mutations(
            "FreshRss",
            Some("https://example.com/feed.xml")
        ));
        assert!(!supports_remote_mutations("FreshRss", None));
        assert!(!supports_remote_mutations("Local", Some("feed/1")));
    }

    #[test]
    fn local_like_feeds_under_freshrss_accounts_do_not_queue_pending_mutations() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        let account_id = AccountId("acc-1".to_string());
        let feed_id = FeedId("feed-1".to_string());
        let article_id = ArticleId("article-1".to_string());

        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                rusqlite::params![account_id.0, "FreshRss", "FreshRSS"],
            )
            .expect("account insert should succeed");
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, remote_id, title, url, site_url, unread_count, reader_mode, web_preview_mode)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                rusqlite::params![
                    feed_id.0,
                    account_id.0,
                    "https://example.com/feed.xml",
                    "Example Feed",
                    "https://example.com/feed.xml",
                    "https://example.com",
                    0,
                    "inherit",
                    "inherit"
                ],
            )
            .expect("feed insert should succeed");
        db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, published_at, fetched_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                rusqlite::params![
                    article_id.0,
                    feed_id.0,
                    "local-guid-1",
                    "Example Article",
                    "",
                    "",
                    1,
                    "2026-04-01T00:00:00Z",
                    "2026-04-01T00:00:00Z"
                ],
            )
            .expect("article insert should succeed");

        maybe_queue_mutation(db.writer(), &article_id, "mark_read")
            .expect("local-like feeds should be ignored without error");

        let pending_repo = SqlitePendingMutationRepository::new(db.reader());
        let pending = pending_repo
            .find_by_account(&account_id)
            .expect("pending mutation query should succeed");
        assert!(pending.is_empty());
    }
}
