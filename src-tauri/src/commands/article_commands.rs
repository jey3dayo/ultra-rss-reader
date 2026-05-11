use chrono::{DateTime, NaiveTime, SecondsFormat, Utc};
use reqwest::header::{HeaderMap, CONTENT_SECURITY_POLICY, X_FRAME_OPTIONS};
use rusqlite::OptionalExtension;
use std::collections::HashSet;
use std::process::Command;
use std::sync::atomic::AtomicBool;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::State;
use unicode_normalization::UnicodeNormalization;

use crate::commands::dto::{
    AppError, ArticleDto, FeedArticleSummaryDto, FeedIntegrityCleanupDto, FeedIntegrityIssueDto,
    FeedIntegrityReportDto,
};
use crate::commands::AppState;
use crate::commands::{start_database_maintenance, try_lock_db};
use crate::domain::error::DomainError;
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
use crate::domain::url_policy::validate_public_http_url;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::repository::article::{ArticleListMode, ArticleRepository, Pagination};
use crate::repository::feed::FeedRepository;
use crate::repository::pending_mutation::{PendingMutation, PendingMutationType};

pub(crate) const DEFAULT_ARTICLE_LIST_LIMIT: usize = 50;
pub(crate) const DEFAULT_RECENT_ARTICLE_LIST_LIMIT: usize = 20;
pub(crate) const MAX_ARTICLE_COMMAND_LIST_LIMIT: usize = 200;
const ARTICLE_SEARCH_QUERY_MAX_CHARS: usize = 128;
const BROWSER_EMBED_SUPPORT_REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
// Offset pagination is a best-effort UI contract: page boundaries may shift if
// articles are inserted, deleted, or reclassified between page requests.
pub(crate) const MAX_ARTICLE_COMMAND_LIST_OFFSET: usize = 10_000;
static BROWSER_OPEN_QUEUE: OnceLock<Mutex<HashSet<BrowserOpenQueueKey>>> = OnceLock::new();

fn normalize_backend_article_search_query(query: &str) -> String {
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

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct BrowserOpenQueueKey {
    url: String,
    background: bool,
}

struct BrowserOpenQueueGuard<'a> {
    queue: &'a Mutex<HashSet<BrowserOpenQueueKey>>,
    key: BrowserOpenQueueKey,
    acquired: bool,
}

impl Drop for BrowserOpenQueueGuard<'_> {
    fn drop(&mut self) {
        if !self.acquired {
            return;
        }

        match self.queue.lock() {
            Ok(mut queue) => {
                queue.remove(&self.key);
            }
            Err(error) => {
                tracing::error!("Browser open queue mutex poisoned while releasing: {error}");
            }
        }
    }
}

#[tauri::command]
pub fn open_in_browser(url: String, background: Option<bool>) -> Result<(), AppError> {
    let parsed_url = parse_public_browser_http_url(&url)?;
    let platform_info = crate::platform::PlatformInfo::current();
    let background =
        should_use_background_browser_open(background.unwrap_or(false), &platform_info);
    let normalized_url = parsed_url.to_string();
    let Some(_open_guard) = acquire_browser_open_queue_guard(&normalized_url, background)? else {
        tracing::debug!(
            url = %crate::commands::redacted_browser_url_for_display(&normalized_url),
            background,
            "skipping duplicate in-flight browser open"
        );
        return Ok(());
    };

    if background {
        open_browser_in_background(&normalized_url)?;
    } else {
        open::that(&normalized_url).map_err(|e| AppError::UserVisible {
            message: native_browser_open_failure_message(e),
        })?;
    }
    Ok(())
}

fn parse_public_browser_http_url(url: &str) -> Result<reqwest::Url, AppError> {
    let parsed_url = crate::commands::parse_browser_http_url(url)?;
    validate_public_http_url(&parsed_url).map_err(|error| match error {
        DomainError::Validation(message) => AppError::UserVisible { message },
        other => AppError::from(other),
    })?;
    Ok(parsed_url)
}

fn acquire_browser_open_queue_guard(
    url: &str,
    background: bool,
) -> Result<Option<BrowserOpenQueueGuard<'static>>, AppError> {
    acquire_browser_open_queue_guard_from(
        browser_open_queue(),
        BrowserOpenQueueKey {
            url: url.to_string(),
            background,
        },
    )
}

fn acquire_browser_open_queue_guard_from(
    queue: &'static Mutex<HashSet<BrowserOpenQueueKey>>,
    key: BrowserOpenQueueKey,
) -> Result<Option<BrowserOpenQueueGuard<'static>>, AppError> {
    let acquired = queue
        .lock()
        .map_err(|error| {
            tracing::error!("Browser open queue mutex poisoned: {error}");
            AppError::UserVisible {
                message: crate::commands::APP_STATE_POISONED_ERROR.to_string(),
            }
        })?
        .insert(key.clone());

    Ok(acquired.then_some(BrowserOpenQueueGuard {
        queue,
        key,
        acquired,
    }))
}

fn browser_open_queue() -> &'static Mutex<HashSet<BrowserOpenQueueKey>> {
    BROWSER_OPEN_QUEUE.get_or_init(|| Mutex::new(HashSet::new()))
}

fn should_use_background_browser_open(
    background_requested: bool,
    info: &crate::platform::PlatformInfo,
) -> bool {
    background_requested && info.capabilities.supports_background_browser_open
}

fn background_browser_open_failure_message(error: impl std::fmt::Display) -> String {
    native_browser_open_diagnostics_message(format_args!("background open failed: {error}"))
}

fn native_browser_open_failure_message(error: impl std::fmt::Display) -> String {
    native_browser_open_diagnostics_message(format_args!("default open failed: {error}"))
}

fn native_browser_open_diagnostics_message(error: impl std::fmt::Display) -> String {
    let diagnostics = crate::commands::redacted_browser_diagnostic_text(&error.to_string());
    format!("Failed to open browser; native opener diagnostics: {diagnostics}")
}

fn background_browser_open_status_failure_message(
    status: std::process::ExitStatus,
    stderr: &[u8],
) -> String {
    let details = String::from_utf8_lossy(stderr).trim().to_string();
    if details.is_empty() {
        background_browser_open_failure_message(format!("open exited with status {status}"))
    } else {
        background_browser_open_failure_message(format!(
            "open exited with status {status}: {details}"
        ))
    }
}

fn open_browser_in_background_with_command(command: &mut Command) -> Result<(), AppError> {
    let output = command.output().map_err(|e| AppError::UserVisible {
        message: background_browser_open_failure_message(e),
    })?;

    if output.status.success() {
        return Ok(());
    }

    Err(AppError::UserVisible {
        message: background_browser_open_status_failure_message(output.status, &output.stderr),
    })
}

fn open_browser_in_background(url: &str) -> Result<(), AppError> {
    // macOS: use `open -g` to open in background while still observing
    // LaunchServices failures from the child process.
    open_browser_in_background_with_command(Command::new("open").arg("-g").arg(url))
}

fn provider_supports_pending_article_mutations(account_kind: &str) -> bool {
    matches!(account_kind, "FreshRss")
}

fn feed_supports_pending_article_mutations(feed_remote_id: Option<&str>) -> bool {
    feed_remote_id.is_some_and(|remote_id| remote_id.starts_with("feed/"))
}

fn supports_remote_mutations(account_kind: &str, feed_remote_id: Option<&str>) -> bool {
    provider_supports_pending_article_mutations(account_kind)
        && feed_supports_pending_article_mutations(feed_remote_id)
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
                    let (name, value) = directive.split_once(char::is_whitespace)?;
                    name.eq_ignore_ascii_case("frame-ancestors")
                        .then_some(value)
                })
                .map(|value| {
                    let sources = value
                        .split_whitespace()
                        .map(|source| source.trim_matches('"').trim_matches('\''));
                    !sources.into_iter().any(|source| source == "*")
                })
                .unwrap_or(false)
        })
}

fn parse_article_list_mode(mode: Option<&str>) -> Result<ArticleListMode, AppError> {
    ArticleListMode::from_optional_str(mode).map_err(|message| AppError::UserVisible { message })
}

fn validate_feed_article_filters(
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

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum OldUnreadScope {
    Account,
    Feed,
    Folder,
}

impl OldUnreadScope {
    fn parse(scope_kind: &str) -> Result<Self, AppError> {
        match scope_kind {
            "account" => Ok(Self::Account),
            "feed" => Ok(Self::Feed),
            "folder" => Ok(Self::Folder),
            _ => Err(AppError::UserVisible {
                message: "Invalid old unread scope".to_string(),
            }),
        }
    }
}

struct BulkArticleMutationRow {
    article_id: String,
    feed_id: String,
    remote_entry_id: Option<String>,
    account_kind: String,
    account_id: String,
    feed_remote_id: Option<String>,
}

fn validate_older_than_days(older_than_days: i64) -> Result<i64, AppError> {
    match older_than_days {
        7 | 30 | 90 => Ok(older_than_days),
        _ => Err(AppError::UserVisible {
            message: "Invalid old unread period".to_string(),
        }),
    }
}

fn old_unread_before(older_than_days: i64) -> Result<DateTime<Utc>, AppError> {
    let older_than_days = validate_older_than_days(older_than_days)?;
    Ok(old_unread_before_from_now(Utc::now(), older_than_days))
}

fn old_unread_before_from_now(now: DateTime<Utc>, older_than_days: i64) -> DateTime<Utc> {
    now.date_naive().and_time(NaiveTime::MIN).and_utc() - chrono::Duration::days(older_than_days)
}

fn collect_article_mutation_rows(
    conn: &rusqlite::Connection,
    sql: &str,
    params: &[&dyn rusqlite::ToSql],
) -> Result<Vec<BulkArticleMutationRow>, AppError> {
    let mut stmt = conn.prepare(sql).map_err(DomainError::from)?;
    let rows = stmt
        .query_map(params, |row| {
            Ok(BulkArticleMutationRow {
                article_id: row.get(0)?,
                feed_id: row.get(1)?,
                remote_entry_id: row.get(2)?,
                account_kind: row.get(3)?,
                account_id: row.get(4)?,
                feed_remote_id: row.get(5)?,
            })
        })
        .map_err(DomainError::from)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DomainError::from)?;
    Ok(rows)
}

fn collect_account_unread_rows(
    conn: &rusqlite::Connection,
    account_id: &AccountId,
) -> Result<Vec<BulkArticleMutationRow>, AppError> {
    collect_article_mutation_rows(
        conn,
        "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         JOIN accounts acc ON f.account_id = acc.id
         WHERE f.account_id = ?1 AND a.is_read = 0",
        &[&account_id.0],
    )
}

fn collect_account_starred_rows(
    conn: &rusqlite::Connection,
    account_id: &AccountId,
) -> Result<Vec<BulkArticleMutationRow>, AppError> {
    collect_article_mutation_rows(
        conn,
        "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         JOIN accounts acc ON f.account_id = acc.id
         WHERE f.account_id = ?1 AND a.is_starred = 1",
        &[&account_id.0],
    )
}

fn collect_account_starred_unread_rows(
    conn: &rusqlite::Connection,
    account_id: &AccountId,
) -> Result<Vec<BulkArticleMutationRow>, AppError> {
    collect_article_mutation_rows(
        conn,
        "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         JOIN accounts acc ON f.account_id = acc.id
         WHERE f.account_id = ?1 AND a.is_starred = 1 AND a.is_read = 0",
        &[&account_id.0],
    )
}

fn collect_feed_unread_rows(
    conn: &rusqlite::Connection,
    feed_id: &FeedId,
) -> Result<Vec<BulkArticleMutationRow>, AppError> {
    collect_article_mutation_rows(
        conn,
        "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         JOIN accounts acc ON f.account_id = acc.id
         WHERE a.feed_id = ?1 AND a.is_read = 0",
        &[&feed_id.0],
    )
}

fn collect_folder_unread_rows(
    conn: &rusqlite::Connection,
    folder_id: &FolderId,
) -> Result<Vec<BulkArticleMutationRow>, AppError> {
    collect_article_mutation_rows(
        conn,
        "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         JOIN accounts acc ON f.account_id = acc.id
         WHERE f.folder_id = ?1 AND a.is_read = 0",
        &[&folder_id.0],
    )
}

fn collect_old_unread_rows(
    conn: &rusqlite::Connection,
    scope: OldUnreadScope,
    target_id: &str,
    before: DateTime<Utc>,
) -> Result<Vec<BulkArticleMutationRow>, AppError> {
    let before = before.to_rfc3339_opts(SecondsFormat::Secs, true);
    match scope {
        OldUnreadScope::Account => collect_article_mutation_rows(
            conn,
            "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
             FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             JOIN accounts acc ON f.account_id = acc.id
             WHERE f.account_id = ?1
               AND a.is_read = 0
               AND datetime(a.published_at) IS NOT NULL
               AND datetime(a.published_at) < datetime(?2)",
            &[&target_id, &before],
        ),
        OldUnreadScope::Feed => collect_article_mutation_rows(
            conn,
            "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
             FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             JOIN accounts acc ON f.account_id = acc.id
             WHERE a.feed_id = ?1
               AND a.is_read = 0
               AND datetime(a.published_at) IS NOT NULL
               AND datetime(a.published_at) < datetime(?2)",
            &[&target_id, &before],
        ),
        OldUnreadScope::Folder => collect_article_mutation_rows(
            conn,
            "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
             FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             JOIN accounts acc ON f.account_id = acc.id
             WHERE f.folder_id = ?1
               AND a.is_read = 0
               AND datetime(a.published_at) IS NOT NULL
               AND datetime(a.published_at) < datetime(?2)",
            &[&target_id, &before],
        ),
    }
}

fn collect_existing_article_rows_by_id(
    conn: &rusqlite::Connection,
    ids: &[ArticleId],
) -> Result<Vec<BulkArticleMutationRow>, AppError> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }

    let placeholders = std::iter::repeat_n("?", ids.len())
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         JOIN accounts acc ON f.account_id = acc.id
         WHERE a.id IN ({placeholders})"
    );
    let params = ids
        .iter()
        .map(|id| &id.0 as &dyn rusqlite::ToSql)
        .collect::<Vec<_>>();
    collect_article_mutation_rows(conn, &sql, params.as_slice())
}

fn queue_bulk_pending_mutations(
    conn: &rusqlite::Connection,
    rows: &[BulkArticleMutationRow],
    mutation_type: PendingMutationType,
) -> Result<(), AppError> {
    for row in rows {
        if let Some(remote_entry_id) = &row.remote_entry_id {
            if supports_remote_mutations(&row.account_kind, row.feed_remote_id.as_deref()) {
                save_pending_mutation(
                    conn,
                    &PendingMutation {
                        id: None,
                        account_id: AccountId(row.account_id.clone()),
                        mutation_type,
                        remote_entry_id: remote_entry_id.clone(),
                        created_at: Utc::now().to_rfc3339(),
                    },
                )?;
            }
        }
    }
    Ok(())
}

fn save_pending_mutation(
    conn: &rusqlite::Connection,
    mutation: &PendingMutation,
) -> Result<(), AppError> {
    if mutation.remote_entry_id.trim().is_empty() {
        return Err(DomainError::Validation(
            "pending mutation remote_entry_id cannot be blank".to_string(),
        )
        .into());
    }

    let replacement_types = mutation.mutation_type.replacement_type_values();
    let placeholders = std::iter::repeat_n("?", replacement_types.len())
        .collect::<Vec<_>>()
        .join(", ");
    let delete_sql = format!(
        "DELETE FROM pending_mutations
         WHERE account_id = ?1 AND remote_entry_id = ?2 AND mutation_type IN ({placeholders})"
    );
    let mut delete_params: Vec<&dyn rusqlite::types::ToSql> =
        Vec::with_capacity(2 + replacement_types.len());
    delete_params.push(&mutation.account_id.0);
    delete_params.push(&mutation.remote_entry_id);
    for mutation_type in replacement_types {
        delete_params.push(mutation_type);
    }
    conn.execute(&delete_sql, rusqlite::params_from_iter(delete_params))
        .map_err(DomainError::from)?;
    conn.execute(
        "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            mutation.account_id.0,
            mutation.mutation_type.as_str(),
            mutation.remote_entry_id,
            mutation.created_at
        ],
    )
    .map_err(DomainError::from)?;
    Ok(())
}

fn recalculate_bulk_feed_unread_counts(
    conn: &rusqlite::Connection,
    rows: &[BulkArticleMutationRow],
) -> Result<(), AppError> {
    let mut feed_ids = rows
        .iter()
        .map(|row| row.feed_id.as_str())
        .collect::<Vec<_>>();
    feed_ids.sort_unstable();
    feed_ids.dedup();

    let feed_repo = SqliteFeedRepository::new(conn);
    for feed_id in feed_ids {
        feed_repo.recalculate_unread_count(&FeedId(feed_id.to_string()))?;
    }
    Ok(())
}

fn mark_rows_read(
    conn: &rusqlite::Connection,
    rows: &[BulkArticleMutationRow],
) -> Result<(), AppError> {
    for row in rows {
        conn.execute(
            "UPDATE articles SET is_read = 1 WHERE id = ?1",
            rusqlite::params![row.article_id],
        )
        .map_err(DomainError::from)?;
    }
    recalculate_bulk_feed_unread_counts(conn, rows)?;
    queue_bulk_pending_mutations(conn, rows, PendingMutationType::MarkRead)
}

fn bulk_mark_account_read(
    conn: &rusqlite::Connection,
    account_id: &AccountId,
) -> Result<u64, AppError> {
    let tx = conn.unchecked_transaction().map_err(DomainError::from)?;
    let rows = collect_account_unread_rows(&tx, account_id)?;
    let count = rows.len() as u64;
    mark_rows_read(&tx, &rows)?;
    tx.commit().map_err(DomainError::from)?;
    Ok(count)
}

fn bulk_mark_account_starred_read(
    conn: &rusqlite::Connection,
    account_id: &AccountId,
) -> Result<u64, AppError> {
    let tx = conn.unchecked_transaction().map_err(DomainError::from)?;
    let rows = collect_account_starred_unread_rows(&tx, account_id)?;
    let count = rows.len() as u64;
    mark_rows_read(&tx, &rows)?;
    tx.commit().map_err(DomainError::from)?;
    Ok(count)
}

fn bulk_mark_old_unread_read(
    conn: &rusqlite::Connection,
    scope: OldUnreadScope,
    target_id: &str,
    before: DateTime<Utc>,
) -> Result<u64, AppError> {
    let tx = conn.unchecked_transaction().map_err(DomainError::from)?;
    let rows = collect_old_unread_rows(&tx, scope, target_id, before)?;
    let count = rows.len() as u64;
    mark_rows_read(&tx, &rows)?;
    tx.commit().map_err(DomainError::from)?;
    Ok(count)
}

fn bulk_unstar_account_articles(
    conn: &rusqlite::Connection,
    account_id: &AccountId,
) -> Result<u64, AppError> {
    let tx = conn.unchecked_transaction().map_err(DomainError::from)?;
    let rows = collect_account_starred_rows(&tx, account_id)?;
    let count = rows.len() as u64;
    for row in &rows {
        tx.execute(
            "UPDATE articles SET is_starred = 0 WHERE id = ?1",
            rusqlite::params![row.article_id],
        )
        .map_err(DomainError::from)?;
    }
    queue_bulk_pending_mutations(&tx, &rows, PendingMutationType::Unstar)?;
    tx.commit().map_err(DomainError::from)?;
    Ok(count)
}

fn mark_article_read_with_conn(
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

fn mark_articles_read_with_conn(
    conn: &rusqlite::Connection,
    ids: &[ArticleId],
) -> Result<(), AppError> {
    let tx = conn.unchecked_transaction().map_err(DomainError::from)?;
    let rows = collect_existing_article_rows_by_id(&tx, ids)?;
    mark_rows_read(&tx, &rows)?;

    tx.commit().map_err(DomainError::from)?;
    Ok(())
}

fn toggle_article_star_with_conn(
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

fn mark_feed_read_with_conn(conn: &rusqlite::Connection, feed_id: FeedId) -> Result<(), AppError> {
    let tx = conn.unchecked_transaction().map_err(DomainError::from)?;
    let rows = collect_feed_unread_rows(&tx, &feed_id)?;
    mark_rows_read(&tx, &rows)?;
    tx.commit().map_err(DomainError::from)?;
    Ok(())
}

fn mark_folder_read_with_conn(
    conn: &rusqlite::Connection,
    folder_id: FolderId,
) -> Result<(), AppError> {
    let tx = conn.unchecked_transaction().map_err(DomainError::from)?;
    let rows = collect_folder_unread_rows(&tx, &folder_id)?;
    mark_rows_read(&tx, &rows)?;
    tx.commit().map_err(DomainError::from)?;
    Ok(())
}

fn record_article_view_with_conn(
    conn: &rusqlite::Connection,
    account_id: AccountId,
    article_id: ArticleId,
) -> Result<(), AppError> {
    let repo = SqliteArticleRepository::new(conn);
    repo.record_view(&account_id, &article_id)?;
    Ok(())
}

#[tauri::command]
pub async fn check_browser_embed_support(url: String) -> Result<bool, AppError> {
    check_browser_embed_support_with_timeout(url, BROWSER_EMBED_SUPPORT_REQUEST_TIMEOUT).await
}

async fn check_browser_embed_support_with_timeout(
    url: String,
    timeout: Duration,
) -> Result<bool, AppError> {
    let url = parse_public_browser_http_url(&url)?;
    check_browser_embed_support_for_url(url, timeout).await
}

async fn check_browser_embed_support_for_url(
    url: reqwest::Url,
    timeout: Duration,
) -> Result<bool, AppError> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(5))
        .timeout(timeout)
        .build()
        .map_err(DomainError::from)?;

    let response = match client
        .head(url.as_str())
        .send()
        .await
        .map_err(DomainError::from)?
    {
        head_response if head_response.status().is_success() => head_response,
        _ => client
            .get(url.as_str())
            .send()
            .await
            .map_err(DomainError::from)?,
    };

    if !response.status().is_success() {
        return Ok(false);
    }

    let headers = response.headers();
    Ok(!(has_blocking_x_frame_options(headers) || has_blocking_frame_ancestors(headers)))
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
    let repo = SqliteArticleRepository::new(db.reader());
    let pagination = article_command_pagination(offset, limit, DEFAULT_ARTICLE_LIST_LIMIT)?;
    let articles = if starred_only.unwrap_or(false) {
        repo.find_starred_by_feed(&FeedId(feed_id), &pagination)?
    } else if unread_only.unwrap_or(false) {
        repo.find_unread_by_feed(&FeedId(feed_id), &pagination)?
    } else {
        repo.find_by_feed(&FeedId(feed_id), &pagination)?
    };
    Ok(articles.into_iter().map(ArticleDto::from).collect())
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
    let repo = SqliteArticleRepository::new(db.reader());
    let pagination = article_command_pagination(offset, limit, DEFAULT_ARTICLE_LIST_LIMIT)?;
    let articles = if unread_only.unwrap_or(false) {
        repo.find_unread_by_account(&AccountId(account_id), &pagination)?
    } else {
        repo.find_by_account(&AccountId(account_id), &pagination)?
    };
    Ok(articles.into_iter().map(ArticleDto::from).collect())
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
    let repo = SqliteArticleRepository::new(db.reader());
    let pagination = article_command_pagination(offset, limit, DEFAULT_ARTICLE_LIST_LIMIT)?;
    let mode = parse_article_list_mode(mode.as_deref())?;
    let folder_id = FolderId(folder_id);
    let articles = match mode {
        ArticleListMode::All => repo.find_by_folder(&folder_id, &pagination)?,
        ArticleListMode::Unread => repo.find_unread_by_folder(&folder_id, &pagination)?,
        ArticleListMode::Starred => repo.find_starred_by_folder(&folder_id, &pagination)?,
    };
    Ok(articles.into_iter().map(ArticleDto::from).collect())
}

#[tauri::command]
pub fn list_starred_articles(
    state: State<'_, AppState>,
    account_id: String,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<ArticleDto>, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteArticleRepository::new(db.reader());
    let pagination = article_command_pagination(offset, limit, DEFAULT_ARTICLE_LIST_LIMIT)?;
    let articles = repo.find_starred_by_account(&AccountId(account_id), &pagination)?;
    Ok(articles.into_iter().map(ArticleDto::from).collect())
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
    let repo = SqliteArticleRepository::new(db.reader());
    let pagination = article_command_pagination(offset, limit, DEFAULT_RECENT_ARTICLE_LIST_LIMIT)?;
    let mode = parse_article_list_mode(mode.as_deref())?;
    let articles =
        repo.find_recently_viewed_by_account(&AccountId(account_id), &pagination, mode)?;
    Ok(articles.into_iter().map(ArticleDto::from).collect())
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
pub fn mark_account_read(state: State<'_, AppState>, account_id: String) -> Result<(), AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    bulk_mark_account_read(db.writer(), &AccountId(account_id))?;
    Ok(())
}

#[tauri::command]
pub fn mark_account_starred_read(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<(), AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    bulk_mark_account_starred_read(db.writer(), &AccountId(account_id))?;
    Ok(())
}

#[tauri::command]
pub fn count_old_unread_articles(
    state: State<'_, AppState>,
    scope_kind: String,
    target_id: String,
    older_than_days: i64,
) -> Result<i64, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let scope = OldUnreadScope::parse(&scope_kind)?;
    let before = old_unread_before(older_than_days)?;
    let count = collect_old_unread_rows(db.reader(), scope, &target_id, before)?.len();
    i64::try_from(count).map_err(|_| AppError::UserVisible {
        message: "Old unread count is too large".to_string(),
    })
}

#[tauri::command]
pub fn mark_old_unread_read(
    state: State<'_, AppState>,
    scope_kind: String,
    target_id: String,
    older_than_days: i64,
) -> Result<(), AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let scope = OldUnreadScope::parse(&scope_kind)?;
    let before = old_unread_before(older_than_days)?;
    bulk_mark_old_unread_read(db.writer(), scope, &target_id, before)?;
    Ok(())
}

#[tauri::command]
pub fn unstar_account_articles(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<(), AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    bulk_unstar_account_articles(db.writer(), &AccountId(account_id))?;
    Ok(())
}

#[tauri::command]
pub fn get_feed_integrity_report(
    state: State<'_, AppState>,
) -> Result<FeedIntegrityReportDto, AppError> {
    get_feed_integrity_report_inner(&state.db, &state.syncing)
}

fn get_feed_integrity_report_inner(
    db: &Mutex<crate::infra::db::connection::DbManager>,
    syncing: &AtomicBool,
) -> Result<FeedIntegrityReportDto, AppError> {
    let _report_guard = start_database_maintenance(syncing)?;
    let db = crate::commands::lock_db(db)?;
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
pub fn cleanup_feed_integrity_orphans(
    state: State<'_, AppState>,
    dry_run: bool,
) -> Result<FeedIntegrityCleanupDto, AppError> {
    cleanup_feed_integrity_orphans_inner(&state.db, &state.syncing, dry_run)
}

fn cleanup_feed_integrity_orphans_inner(
    db: &Mutex<crate::infra::db::connection::DbManager>,
    syncing: &AtomicBool,
    dry_run: bool,
) -> Result<FeedIntegrityCleanupDto, AppError> {
    let _maintenance_guard = start_database_maintenance(syncing)?;
    let db = try_lock_db(db)?;
    let repo = SqliteArticleRepository::new(db.writer());
    let orphaned_article_count = repo.count_orphaned_articles()?;
    let deleted_article_count = if dry_run {
        0
    } else {
        repo.delete_orphaned_articles()?
    };
    if deleted_article_count > 0 {
        db.refresh_query_statistics()?;
    }

    Ok(FeedIntegrityCleanupDto {
        dry_run,
        orphaned_article_count,
        deleted_article_count,
    })
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
pub fn mark_feed_read(state: State<'_, AppState>, feed_id: String) -> Result<(), AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let feed_id = FeedId(feed_id);
    mark_feed_read_with_conn(db.writer(), feed_id)
}

#[tauri::command]
pub fn mark_folder_read(state: State<'_, AppState>, folder_id: String) -> Result<(), AppError> {
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

/// If the article belongs to a FreshRSS account and has a remote_id, insert a pending_mutation.
#[cfg(test)]
fn maybe_queue_mutation(
    conn: &rusqlite::Connection,
    article_id: &ArticleId,
    mutation_type: PendingMutationType,
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
        .optional()
        .map_err(DomainError::from)?;

    if let Some((remote_entry_id, account_kind, account_id, feed_remote_id)) = row {
        if supports_remote_mutations(&account_kind, feed_remote_id.as_deref()) {
            save_pending_mutation(
                conn,
                &PendingMutation {
                    id: None,
                    account_id: AccountId(account_id),
                    mutation_type,
                    remote_entry_id,
                    created_at: chrono::Utc::now().to_rfc3339(),
                },
            )?;
        }
    }

    Ok(())
}

fn maybe_queue_mutation_in_current_transaction(
    conn: &rusqlite::Connection,
    article_id: &ArticleId,
    mutation_type: PendingMutationType,
) -> Result<(), AppError> {
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
        .optional()
        .map_err(DomainError::from)?;

    if let Some((remote_entry_id, account_kind, account_id, feed_remote_id)) = row {
        if supports_remote_mutations(&account_kind, feed_remote_id.as_deref()) {
            save_pending_mutation(
                conn,
                &PendingMutation {
                    id: None,
                    account_id: AccountId(account_id),
                    mutation_type,
                    remote_entry_id,
                    created_at: chrono::Utc::now().to_rfc3339(),
                },
            )?;
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
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteArticleRepository::new(db.reader());
    let pagination = article_command_pagination(offset, limit, DEFAULT_ARTICLE_LIST_LIMIT)?;
    let normalized_query = normalize_backend_article_search_query(&query);
    let articles = repo.search(&AccountId(account_id), &normalized_query, &pagination)?;
    Ok(articles.into_iter().map(ArticleDto::from).collect())
}

#[cfg(test)]
mod tests {
    use crate::domain::url_policy::PRIVATE_URL_VALIDATION_MESSAGE;

    use super::check_browser_embed_support;
    use super::check_browser_embed_support_for_url;
    use super::{
        acquire_browser_open_queue_guard_from, article_command_pagination,
        background_browser_open_failure_message, background_browser_open_status_failure_message,
        bulk_mark_account_read, bulk_mark_account_starred_read, bulk_mark_old_unread_read,
        bulk_unstar_account_articles, collect_old_unread_rows, has_blocking_frame_ancestors,
        has_blocking_x_frame_options, mark_article_read_with_conn, mark_articles_read_with_conn,
        mark_feed_read_with_conn, mark_folder_read_with_conn, maybe_queue_mutation,
        native_browser_open_failure_message, old_unread_before_from_now,
        open_browser_in_background_with_command, parse_article_list_mode,
        provider_supports_pending_article_mutations, recalculate_bulk_feed_unread_counts,
        record_article_view_with_conn, should_use_background_browser_open,
        supports_remote_mutations, toggle_article_star_with_conn, validate_feed_article_filters,
        validate_older_than_days, BrowserOpenQueueKey, BulkArticleMutationRow, OldUnreadScope,
        ARTICLE_SEARCH_QUERY_MAX_CHARS, BROWSER_EMBED_SUPPORT_REQUEST_TIMEOUT,
        DEFAULT_ARTICLE_LIST_LIMIT, DEFAULT_RECENT_ARTICLE_LIST_LIMIT,
        MAX_ARTICLE_COMMAND_LIST_LIMIT, MAX_ARTICLE_COMMAND_LIST_OFFSET,
    };
    use super::{cleanup_feed_integrity_orphans_inner, get_feed_integrity_report_inner};
    use crate::commands::dto::AppError;
    use crate::commands::DATABASE_MAINTENANCE_BUSY_ERROR;
    use crate::domain::constants::ARTICLE_MUTATION_TRANSACTION_CHUNK_SIZE;
    use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
    use crate::infra::db::connection::DbManager;
    use crate::infra::db::sqlite_article::SqliteArticleRepository;
    use crate::infra::db::sqlite_feed::SqliteFeedRepository;
    use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
    use crate::platform::{platform_info_for_kind, PlatformKind};
    use crate::repository::article::{ArticleListMode, ArticleRepository, Pagination};
    use crate::repository::feed::FeedRepository;
    use crate::repository::pending_mutation::{PendingMutationRepository, PendingMutationType};
    use mockito::Server;
    use reqwest::header::{
        HeaderMap, HeaderName, HeaderValue, CONTENT_SECURITY_POLICY, X_FRAME_OPTIONS,
    };
    use std::sync::atomic::AtomicBool;
    use std::sync::Mutex;
    use std::time::Duration;
    use tokio::io::AsyncWriteExt;
    use tokio::net::TcpListener;

    fn test_http_url(url: String) -> reqwest::Url {
        reqwest::Url::parse(&url).expect("test server URL should parse")
    }

    async fn stalled_http_url(path: &str) -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("stalled server should bind");
        let addr = listener
            .local_addr()
            .expect("stalled server should expose local address");
        tokio::spawn(async move {
            if let Ok((socket, _)) = listener.accept().await {
                let mut request_buffer = [0_u8; 1024];
                let _ = socket.readable().await;
                let _ = socket.try_read(&mut request_buffer);
                tokio::time::sleep(Duration::from_millis(200)).await;
            }
        });

        format!("http://{addr}{path}")
    }

    #[test]
    fn backend_article_search_query_normalization_collapses_whitespace_and_caps_length() {
        let query = format!("　Ｒｕｓｔ\t\t検索\nemoji😀  が {}", "長".repeat(150));
        let normalized = super::normalize_backend_article_search_query(&query);

        assert_eq!(normalized.chars().count(), ARTICLE_SEARCH_QUERY_MAX_CHARS);
        assert!(normalized.starts_with("Rust 検索 emoji😀 が 長"));
        assert!(!normalized.contains('　'));
        assert!(!normalized.contains('\n'));
        assert!(!normalized.contains('\t'));
        assert!(!normalized.contains("が"));
    }

    async fn head_rejected_then_stalled_get_url(path: &str) -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("fallback server should bind");
        let addr = listener
            .local_addr()
            .expect("fallback server should expose local address");
        tokio::spawn(async move {
            if let Ok((mut head_socket, _)) = listener.accept().await {
                let mut request_buffer = [0_u8; 1024];
                let _ = head_socket.readable().await;
                let _ = head_socket.try_read(&mut request_buffer);
                let _ = head_socket
                    .write_all(b"HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\nContent-Length: 0\r\n\r\n")
                    .await;
            }

            if let Ok((get_socket, _)) = listener.accept().await {
                let mut request_buffer = [0_u8; 1024];
                let _ = get_socket.readable().await;
                let _ = get_socket.try_read(&mut request_buffer);
                tokio::time::sleep(Duration::from_millis(200)).await;
            }
        });

        format!("http://{addr}{path}")
    }

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

    #[test]
    fn frame_ancestors_parser_handles_case_quotes_and_header_policy_fixtures() {
        struct FrameAncestorsFixture {
            name: &'static str,
            enforced_policies: &'static [&'static str],
            report_only_policies: &'static [&'static str],
            blocks_embedding: bool,
        }

        let report_only_header = HeaderName::from_static("content-security-policy-report-only");
        let fixtures = [
            FrameAncestorsFixture {
                name: "mixed-case directive blocks like lowercase frame-ancestors",
                enforced_policies: &["default-src 'self'; FRAME-ANCESTORS 'self'"],
                report_only_policies: &[],
                blocks_embedding: true,
            },
            FrameAncestorsFixture {
                name: "double-quoted wildcard keeps embedding available",
                enforced_policies: &["default-src 'self'; frame-ancestors \"*\""],
                report_only_policies: &[],
                blocks_embedding: false,
            },
            FrameAncestorsFixture {
                name: "single-quoted wildcard keeps embedding available",
                enforced_policies: &["default-src 'self'; frame-ancestors '*'"],
                report_only_policies: &[],
                blocks_embedding: false,
            },
            FrameAncestorsFixture {
                name: "blocking policy wins across multiple enforced CSP headers",
                enforced_policies: &["default-src 'self'", "frame-ancestors https://example.com"],
                report_only_policies: &[],
                blocks_embedding: true,
            },
            FrameAncestorsFixture {
                name: "report-only frame-ancestors does not block embedding",
                enforced_policies: &["default-src 'self'"],
                report_only_policies: &["frame-ancestors 'none'"],
                blocks_embedding: false,
            },
        ];

        for fixture in fixtures {
            let mut headers = HeaderMap::new();
            for policy in fixture.enforced_policies {
                headers.append(CONTENT_SECURITY_POLICY, HeaderValue::from_static(policy));
            }
            for policy in fixture.report_only_policies {
                headers.append(report_only_header.clone(), HeaderValue::from_static(policy));
            }

            assert_eq!(
                has_blocking_frame_ancestors(&headers),
                fixture.blocks_embedding,
                "{}",
                fixture.name
            );
        }
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

        let supported = check_browser_embed_support_for_url(
            test_http_url(format!("{}/article", server.url())),
            BROWSER_EMBED_SUPPORT_REQUEST_TIMEOUT,
        )
        .await
        .expect("embed check should succeed");

        assert!(!supported);
    }

    #[tokio::test]
    async fn embed_support_falls_back_to_get_when_head_is_rejected() {
        let mut server = Server::new_async().await;
        let head_mock = server
            .mock("HEAD", "/article")
            .with_status(405)
            .with_header("x-frame-options", "SAMEORIGIN")
            .create_async()
            .await;
        let get_mock = server
            .mock("GET", "/article")
            .with_status(200)
            .create_async()
            .await;

        let supported = check_browser_embed_support_for_url(
            test_http_url(format!("{}/article", server.url())),
            BROWSER_EMBED_SUPPORT_REQUEST_TIMEOUT,
        )
        .await
        .expect("embed check should fall back to GET");

        assert!(supported);
        head_mock.assert_async().await;
        get_mock.assert_async().await;
    }

    #[tokio::test]
    async fn embed_support_rejects_non_success_get_responses_after_head_fallback() {
        for status in [403, 404, 500] {
            let mut server = Server::new_async().await;
            let head_mock = server
                .mock("HEAD", "/article")
                .with_status(405)
                .create_async()
                .await;
            let get_mock = server
                .mock("GET", "/article")
                .with_status(status)
                .create_async()
                .await;

            let supported = check_browser_embed_support_for_url(
                test_http_url(format!("{}/article", server.url())),
                BROWSER_EMBED_SUPPORT_REQUEST_TIMEOUT,
            )
            .await
            .expect("embed check should resolve non-success GET responses");

            assert!(!supported, "GET {status} should not be embeddable");
            head_mock.assert_async().await;
            get_mock.assert_async().await;
        }
    }

    #[tokio::test]
    async fn embed_support_keeps_success_get_response_policy_after_head_fallback() {
        let mut server = Server::new_async().await;
        let head_mock = server
            .mock("HEAD", "/article")
            .with_status(405)
            .with_header("x-frame-options", "SAMEORIGIN")
            .create_async()
            .await;
        let get_mock = server
            .mock("GET", "/article")
            .with_status(204)
            .create_async()
            .await;

        let supported = check_browser_embed_support_for_url(
            test_http_url(format!("{}/article", server.url())),
            BROWSER_EMBED_SUPPORT_REQUEST_TIMEOUT,
        )
        .await
        .expect("embed check should accept success GET responses");

        assert!(supported);
        head_mock.assert_async().await;
        get_mock.assert_async().await;
    }

    #[tokio::test]
    async fn embed_support_surfaces_head_request_timeout() {
        let error = check_browser_embed_support_for_url(
            test_http_url(stalled_http_url("/article").await),
            Duration::from_millis(20),
        )
        .await
        .expect_err("stalled HEAD response should time out");

        assert!(matches!(
            error,
            AppError::Retryable { ref message }
                | AppError::RetryableWithMetadata { ref message, .. }
                if message == "Network error: Request timed out. Check the server URL or your network connection."
        ));
    }

    #[tokio::test]
    async fn embed_support_surfaces_get_fallback_timeout() {
        let error = check_browser_embed_support_for_url(
            test_http_url(head_rejected_then_stalled_get_url("/article").await),
            Duration::from_millis(20),
        )
        .await
        .expect_err("stalled GET fallback response should time out");

        assert!(matches!(
            error,
            AppError::Retryable { ref message }
                | AppError::RetryableWithMetadata { ref message, .. }
                if message == "Network error: Request timed out. Check the server URL or your network connection."
        ));
    }

    #[tokio::test]
    async fn embed_support_rejects_non_http_urls_before_requesting() {
        for url in [
            "mailto:hello@example.com",
            "file:///tmp/article.html",
            "javascript:alert(1)",
            "localhost:1420",
        ] {
            let error = check_browser_embed_support(url.to_string())
                .await
                .expect_err("non-http URLs should use the browser URL validation contract");

            assert!(matches!(
                error,
                AppError::UserVisible { ref message }
                    if message == "Only http:// and https:// URLs are supported"
            ));
        }
    }

    #[tokio::test]
    async fn embed_support_rejects_private_hosts_before_requesting() {
        for url in [
            "http://LOCALHOST./article",
            "http://127.0.0.1/article",
            "http://[fe80::1]/article",
            "http://[::ffff:7f00:1]/article",
        ] {
            let error = check_browser_embed_support(url.to_string())
                .await
                .expect_err("private browser embed URL should be rejected before request");

            assert!(matches!(
                error,
                AppError::UserVisible { ref message }
                    if message == PRIVATE_URL_VALIDATION_MESSAGE
            ));
        }
    }

    #[test]
    fn open_in_browser_rejects_non_http_urls_before_native_opener() {
        for url in [
            "mailto:hello@example.com",
            "file:///tmp/article.html",
            "javascript:alert(1)",
            "localhost:1420",
            "https://user:pass@example.com/article",
        ] {
            let error = super::open_in_browser(url.to_string(), Some(true))
                .expect_err("browser open should validate URL scheme before native opener");

            assert!(matches!(
                error,
                AppError::UserVisible { ref message }
                    if message == "Only http:// and https:// URLs are supported"
            ));
        }
    }

    #[test]
    fn open_in_browser_rejects_private_hosts_before_native_opener() {
        for url in [
            "http://LOCALHOST./article",
            "http://127.0.0.1/article",
            "http://[fe80::1]/article",
            "http://[::ffff:7f00:1]/article",
        ] {
            let error = super::open_in_browser(url.to_string(), Some(true))
                .expect_err("private browser open URL should be rejected before native opener");

            assert!(matches!(
                error,
                AppError::UserVisible { ref message }
                    if message == PRIVATE_URL_VALIDATION_MESSAGE
            ));
        }
    }

    #[test]
    fn browser_open_queue_deduplicates_same_target_until_guard_drops() {
        let queue = Box::leak(Box::new(Mutex::new(std::collections::HashSet::new())));
        let key = BrowserOpenQueueKey {
            url: "https://example.com/article".to_string(),
            background: true,
        };

        let first = acquire_browser_open_queue_guard_from(queue, key.clone())
            .expect("queue lock should be available")
            .expect("first open should acquire queue slot");
        let duplicate = acquire_browser_open_queue_guard_from(queue, key.clone())
            .expect("queue lock should be available");

        assert!(duplicate.is_none());

        let distinct_background = acquire_browser_open_queue_guard_from(
            queue,
            BrowserOpenQueueKey {
                url: key.url.clone(),
                background: false,
            },
        )
        .expect("queue lock should be available");

        assert!(distinct_background.is_some());
        drop(first);

        let after_release = acquire_browser_open_queue_guard_from(queue, key)
            .expect("queue lock should be available");

        assert!(after_release.is_some());
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
    fn background_open_contract_follows_platform_info_capability() {
        let cases = [
            (PlatformKind::Macos, true),
            (PlatformKind::Windows, false),
            (PlatformKind::Linux, false),
            (PlatformKind::Unknown, false),
        ];

        for (kind, supports_background_open) in cases {
            let info = platform_info_for_kind(kind);

            assert_eq!(
                info.capabilities.supports_background_browser_open, supports_background_open,
                "{kind:?}"
            );
            assert_eq!(
                should_use_background_browser_open(true, &info),
                supports_background_open,
                "{kind:?}"
            );
            assert!(
                !should_use_background_browser_open(false, &info),
                "{kind:?}"
            );
        }
    }

    #[test]
    fn background_open_reports_child_process_spawn_failure_as_user_visible() {
        let message = background_browser_open_failure_message("No such file or directory");

        assert_eq!(
            message,
            "Failed to open browser; native opener diagnostics: background open failed: No such file or directory"
        );
    }

    #[test]
    fn default_open_platform_failure_is_diagnostics_classified_after_url_schema() {
        let message = native_browser_open_failure_message("permission denied");

        assert_eq!(
            message,
            "Failed to open browser; native opener diagnostics: default open failed: permission denied"
        );
    }

    #[test]
    fn native_open_diagnostics_redact_url_credentials_query_and_fragment() {
        let message = native_browser_open_failure_message(
            "default app rejected https://user:pass@example.com/private?token=raw#frag.",
        );

        assert!(message.contains("https://example.com/..."));
        assert!(!message.contains("user"));
        assert!(!message.contains("pass"));
        assert!(!message.contains("/private"));
        assert!(!message.contains("token=raw"));
        assert!(!message.contains("#frag"));
    }

    #[test]
    fn background_open_reports_child_process_exit_failure_as_user_visible() {
        let mut command = std::process::Command::new("sh");
        command
            .arg("-c")
            .arg("printf 'LaunchServices denied' >&2; exit 7");

        match open_browser_in_background_with_command(&mut command) {
            Err(AppError::UserVisible { message }) => {
                assert!(message.contains("Failed to open browser"));
                assert!(message.contains("native opener diagnostics"));
                assert!(message.contains("LaunchServices denied"));
            }
            other => panic!("expected user-visible background open failure, got {other:?}"),
        }
    }

    #[test]
    fn background_open_exit_failure_includes_status_without_stderr() {
        let mut command = std::process::Command::new("sh");
        command.arg("-c").arg("exit 9");

        match open_browser_in_background_with_command(&mut command) {
            Err(AppError::UserVisible { message }) => {
                assert!(message.contains("Failed to open browser"));
                assert!(message.contains("native opener diagnostics"));
                assert!(message.contains("open exited with status"));
            }
            other => panic!("expected user-visible background open failure, got {other:?}"),
        }
    }

    #[test]
    fn background_open_exit_failure_message_trims_stderr() {
        let mut command = std::process::Command::new("sh");
        command
            .arg("-c")
            .arg("printf '\\nLaunchServices denied\\n' >&2; exit 7");
        let output = command.output().expect("test shell should run");

        let message = background_browser_open_status_failure_message(output.status, &output.stderr);

        assert!(message.ends_with("LaunchServices denied"));
        assert!(!message.ends_with('\n'));
    }

    #[test]
    fn remote_mutations_require_provider_managed_greader_feed_ids() {
        assert!(provider_supports_pending_article_mutations("FreshRss"));
        assert!(!provider_supports_pending_article_mutations("Local"));
        assert!(!provider_supports_pending_article_mutations(
            "FutureProvider"
        ));

        assert!(supports_remote_mutations("FreshRss", Some("feed/1")));

        assert!(!supports_remote_mutations(
            "FreshRss",
            Some("https://example.com/feed.xml")
        ));
        assert!(!supports_remote_mutations("FreshRss", None));
        assert!(!supports_remote_mutations("Local", Some("feed/1")));
        assert!(!supports_remote_mutations("FutureProvider", Some("feed/1")));
    }

    #[test]
    fn folder_article_list_mode_rejects_unknown_values() {
        assert_eq!(
            parse_article_list_mode(None).expect("missing mode should default to all"),
            ArticleListMode::All
        );

        let error = parse_article_list_mode(Some("archived"))
            .expect_err("unknown folder article mode should be rejected");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Invalid article list mode: archived"
        ));
    }

    #[test]
    fn feed_article_filters_reject_mutually_exclusive_flags() {
        let error = validate_feed_article_filters(Some(true), Some(true))
            .expect_err("unread and starred filters should not be combined");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Article list filters are mutually exclusive"
        ));
        validate_feed_article_filters(Some(true), Some(false))
            .expect("unread-only filter should be accepted");
        validate_feed_article_filters(Some(false), Some(true))
            .expect("starred-only filter should be accepted");
        validate_feed_article_filters(None, None).expect("missing filters should be accepted");
    }

    #[test]
    fn article_command_pagination_uses_list_default_limit() {
        let pagination = article_command_pagination(Some(7), None, DEFAULT_ARTICLE_LIST_LIMIT)
            .expect("default list pagination should be accepted");

        assert_eq!(pagination.offset, 7);
        assert_eq!(pagination.limit, 50);
    }

    #[test]
    fn article_command_pagination_uses_recent_default_limit() {
        let pagination = article_command_pagination(None, None, DEFAULT_RECENT_ARTICLE_LIST_LIMIT)
            .expect("default recent pagination should be accepted");

        assert_eq!(pagination.offset, 0);
        assert_eq!(pagination.limit, 20);
    }

    #[test]
    fn article_command_pagination_accepts_boundary_limit() {
        let pagination = article_command_pagination(
            Some(3),
            Some(MAX_ARTICLE_COMMAND_LIST_LIMIT),
            DEFAULT_ARTICLE_LIST_LIMIT,
        )
        .expect("max article command list limit should be accepted");

        assert_eq!(pagination.offset, 3);
        assert_eq!(pagination.limit, 200);
    }

    #[test]
    fn article_command_pagination_accepts_boundary_offset() {
        let pagination = article_command_pagination(
            Some(MAX_ARTICLE_COMMAND_LIST_OFFSET),
            Some(1),
            DEFAULT_ARTICLE_LIST_LIMIT,
        )
        .expect("max article command list offset should be accepted");

        assert_eq!(pagination.offset, MAX_ARTICLE_COMMAND_LIST_OFFSET);
        assert_eq!(pagination.limit, 1);
    }

    #[test]
    fn article_command_pagination_rejects_offset_over_boundary() {
        let result = article_command_pagination(
            Some(MAX_ARTICLE_COMMAND_LIST_OFFSET + 1),
            Some(1),
            DEFAULT_ARTICLE_LIST_LIMIT,
        );
        let Err(error) = result else {
            panic!("article command list offset over max should be rejected");
        };

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Article list offset must be 10000 or less"
        ));
    }

    #[test]
    fn article_command_pagination_rejects_limit_over_boundary() {
        let result = article_command_pagination(
            None,
            Some(MAX_ARTICLE_COMMAND_LIST_LIMIT + 1),
            DEFAULT_ARTICLE_LIST_LIMIT,
        );
        let Err(error) = result else {
            panic!("article command list limit over max should be rejected");
        };

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Article list limit must be 200 or less"
        ));
    }

    #[test]
    fn article_command_pagination_rejects_load_more_values_with_stable_messages() {
        let cases = [
            (
                Some(MAX_ARTICLE_COMMAND_LIST_OFFSET + 1),
                Some(1),
                "Article list offset must be 10000 or less",
            ),
            (
                Some(MAX_ARTICLE_COMMAND_LIST_OFFSET),
                Some(MAX_ARTICLE_COMMAND_LIST_LIMIT + 1),
                "Article list limit must be 200 or less",
            ),
        ];

        for (offset, limit, expected_message) in cases {
            let Err(error) = article_command_pagination(offset, limit, DEFAULT_ARTICLE_LIST_LIMIT)
            else {
                panic!("invalid pagination should be rejected before repository access");
            };

            assert!(
                matches!(error, AppError::UserVisible { message } if message == expected_message)
            );
        }
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

        maybe_queue_mutation(db.writer(), &article_id, PendingMutationType::MarkRead)
            .expect("local-like feeds should be ignored without error");

        let pending_repo = SqlitePendingMutationRepository::new(db.reader());
        let pending = pending_repo
            .find_by_account(&account_id)
            .expect("pending mutation query should succeed");
        assert!(pending.is_empty());
    }

    #[test]
    fn article_mutation_missing_id_contract_is_command_noop() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");

        mark_article_read_with_conn(db.writer(), ArticleId("missing-read".to_string()), true)
            .expect("missing article read mutation should be a no-op");
        mark_articles_read_with_conn(
            db.writer(),
            &[
                ArticleId("missing-bulk-1".to_string()),
                ArticleId("missing-bulk-2".to_string()),
            ],
        )
        .expect("missing bulk article read mutation should be a no-op");
        toggle_article_star_with_conn(db.writer(), ArticleId("missing-star".to_string()), true)
            .expect("missing article star mutation should be a no-op");

        let pending_count: i64 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM pending_mutations", [], |row| {
                row.get(0)
            })
            .expect("pending mutation count should succeed");
        assert_eq!(pending_count, 0);
    }

    #[test]
    fn bulk_article_read_ignores_missing_ids_and_allows_mixed_accounts() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "FreshRss");
        insert_bulk_account(&db, "acc-b", "FreshRss");
        insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
        insert_bulk_feed(&db, "feed-b", "acc-b", None, Some("feed/b"));
        insert_bulk_article(
            &db,
            "article-a",
            "feed-a",
            Some("remote-a"),
            "2026-04-01T00:00:00Z",
            false,
            false,
        );
        insert_bulk_article(
            &db,
            "article-b",
            "feed-b",
            Some("remote-b"),
            "2026-04-01T00:00:00Z",
            false,
            false,
        );
        db.writer()
            .execute(
                "UPDATE feeds SET unread_count = 1 WHERE id IN ('feed-a', 'feed-b')",
                [],
            )
            .expect("feed unread count setup should succeed");

        mark_articles_read_with_conn(
            db.writer(),
            &[
                ArticleId("article-a".to_string()),
                ArticleId("missing-article".to_string()),
                ArticleId("article-b".to_string()),
            ],
        )
        .expect("mixed-account bulk read with missing id should succeed");

        let pending_a = SqlitePendingMutationRepository::new(db.reader())
            .find_by_account(&AccountId("acc-a".to_string()))
            .expect("account a pending query should succeed");
        let pending_b = SqlitePendingMutationRepository::new(db.reader())
            .find_by_account(&AccountId("acc-b".to_string()))
            .expect("account b pending query should succeed");

        assert!(article_is_read(&db, "article-a"));
        assert!(article_is_read(&db, "article-b"));
        assert_eq!(feed_unread_count(&db, "feed-a"), 0);
        assert_eq!(feed_unread_count(&db, "feed-b"), 0);
        assert_eq!(pending_a.len(), 1);
        assert_eq!(pending_a[0].remote_entry_id, "remote-a");
        assert_eq!(pending_b.len(), 1);
        assert_eq!(pending_b[0].remote_entry_id, "remote-b");
    }

    #[test]
    fn article_mutation_transaction_policy_bulk_article_read_handles_large_batch() {
        assert_eq!(ARTICLE_MUTATION_TRANSACTION_CHUNK_SIZE, None);

        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "FreshRss");
        insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
        let ids = (0..250)
            .map(|index| {
                let article_id = format!("article-{index}");
                insert_bulk_article(
                    &db,
                    &article_id,
                    "feed-a",
                    Some(&format!("remote-{index}")),
                    "2026-04-01T00:00:00Z",
                    false,
                    false,
                );
                ArticleId(article_id)
            })
            .collect::<Vec<_>>();
        db.writer()
            .execute(
                "UPDATE feeds SET unread_count = 250 WHERE id = 'feed-a'",
                [],
            )
            .expect("feed unread count setup should succeed");

        mark_articles_read_with_conn(db.writer(), &ids)
            .expect("large bulk read should succeed in one transaction");

        let unread_count: i64 = db
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM articles WHERE is_read = 0",
                [],
                |row| row.get(0),
            )
            .expect("unread count query should succeed");
        assert_eq!(unread_count, 0);
        assert_eq!(feed_unread_count(&db, "feed-a"), 0);
        assert_eq!(pending_mutation_count(&db), ids.len() as i64);
    }

    #[test]
    fn article_mutation_transaction_policy_bulk_article_read_rolls_back_on_mid_batch_update_failure(
    ) {
        assert_eq!(ARTICLE_MUTATION_TRANSACTION_CHUNK_SIZE, None);

        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "FreshRss");
        insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
        insert_bulk_article(
            &db,
            "article-a",
            "feed-a",
            Some("remote-a"),
            "2026-04-01T00:00:00Z",
            false,
            false,
        );
        insert_bulk_article(
            &db,
            "article-b",
            "feed-a",
            Some("remote-b"),
            "2026-04-02T00:00:00Z",
            false,
            false,
        );
        db.writer()
            .execute("UPDATE feeds SET unread_count = 2 WHERE id = 'feed-a'", [])
            .expect("feed unread count setup should succeed");
        db.writer()
            .execute(
                "CREATE TEMP TRIGGER fail_article_b_mark_read
                 BEFORE UPDATE OF is_read ON articles
                 WHEN NEW.id = 'article-b'
                 BEGIN
                   SELECT RAISE(ABORT, 'forced bulk read failure');
                 END",
                [],
            )
            .expect("failure trigger should install");

        let error = mark_articles_read_with_conn(
            db.writer(),
            &[
                ArticleId("article-a".to_string()),
                ArticleId("article-b".to_string()),
            ],
        )
        .expect_err("mid-batch update failure should reject the bulk read mutation");

        assert!(matches!(
            error,
            AppError::UserVisible { ref message } if message.contains("forced bulk read failure")
        ));
        assert!(!article_is_read(&db, "article-a"));
        assert!(!article_is_read(&db, "article-b"));
        assert_eq!(feed_unread_count(&db, "feed-a"), 2);
        assert_eq!(pending_mutation_count(&db), 0);
    }

    #[test]
    fn record_article_view_missing_id_contract_is_command_noop() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "FreshRss");

        record_article_view_with_conn(
            db.writer(),
            AccountId("acc-a".to_string()),
            ArticleId("missing-article".to_string()),
        )
        .expect("missing article view should be a no-op");

        let history_count: i64 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM article_view_history", [], |row| {
                row.get(0)
            })
            .expect("history count should succeed");
        assert_eq!(history_count, 0);
    }

    #[test]
    fn record_article_view_persistence_failure_is_user_visible_not_retryable() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "FreshRss");
        db.writer()
            .execute("DROP TABLE article_view_history", [])
            .expect("history table drop should succeed");

        let error = record_article_view_with_conn(
            db.writer(),
            AccountId("acc-a".to_string()),
            ArticleId("article-a".to_string()),
        )
        .expect_err("history persistence failure should reject once");

        assert!(matches!(
            error,
            AppError::UserVisible { message }
                if message.contains("Persistence error:")
                    && message.contains("article_view_history")
        ));
    }

    #[test]
    fn article_pending_mutation_query_errors_are_reported() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        db.writer()
            .execute("DROP TABLE articles", [])
            .expect("articles table drop should succeed");

        let error = maybe_queue_mutation(
            db.writer(),
            &ArticleId("article-1".to_string()),
            PendingMutationType::MarkRead,
        )
        .expect_err("pending mutation query DB errors should be reported");

        assert!(matches!(
            error,
            AppError::UserVisible { ref message } if message.contains("no such table: articles")
        ));
    }

    #[test]
    fn cleanup_feed_integrity_orphans_dry_run_does_not_delete_orphans() {
        let db = Mutex::new(DbManager::new_in_memory().expect("in-memory DB should initialize"));
        let syncing = AtomicBool::new(false);
        {
            let db_guard = db.lock().expect("test DB lock should succeed");
            insert_orphaned_article(&db_guard, "orphan-dry-run", "missing-feed");
        }

        let result = cleanup_feed_integrity_orphans_inner(&db, &syncing, true)
            .expect("dry-run cleanup should succeed");
        let remaining = {
            let db_guard = db.lock().expect("test DB lock should succeed");
            SqliteArticleRepository::new(db_guard.reader())
                .count_orphaned_articles()
                .expect("orphan count should succeed")
        };

        assert!(result.dry_run);
        assert_eq!(result.orphaned_article_count, 1);
        assert_eq!(result.deleted_article_count, 0);
        assert_eq!(remaining, 1);
    }

    #[test]
    fn cleanup_feed_integrity_orphans_deletes_counted_orphans() {
        let db = Mutex::new(DbManager::new_in_memory().expect("in-memory DB should initialize"));
        let syncing = AtomicBool::new(false);
        {
            let db_guard = db.lock().expect("test DB lock should succeed");
            insert_bulk_account(&db_guard, "acc-cleanup", "Local");
            insert_bulk_feed(&db_guard, "feed-cleanup", "acc-cleanup", None, None);
            insert_bulk_article(
                &db_guard,
                "healthy-cleanup",
                "feed-cleanup",
                None,
                "2026-04-01T00:00:00Z",
                false,
                false,
            );
            insert_orphaned_article(&db_guard, "orphan-cleanup", "missing-feed");
        }

        let result = cleanup_feed_integrity_orphans_inner(&db, &syncing, false)
            .expect("destructive cleanup should succeed");
        let (remaining_orphans, healthy_articles) = {
            let db_guard = db.lock().expect("test DB lock should succeed");
            let repo = SqliteArticleRepository::new(db_guard.reader());
            (
                repo.count_orphaned_articles()
                    .expect("orphan count should succeed"),
                repo.find_by_feed(&FeedId("feed-cleanup".to_string()), &Pagination::default())
                    .expect("healthy feed query should succeed")
                    .len(),
            )
        };

        assert!(!result.dry_run);
        assert_eq!(result.orphaned_article_count, 1);
        assert_eq!(result.deleted_article_count, 1);
        assert_eq!(remaining_orphans, 0);
        assert_eq!(healthy_articles, 1);
        let article_stats_rows: i64 = {
            let db_guard = db.lock().expect("test DB lock should succeed");
            db_guard
                .reader()
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_stat1 WHERE tbl = 'articles'",
                    [],
                    |row| row.get(0),
                )
                .expect("article stats query should succeed")
        };
        assert!(article_stats_rows > 0);
    }

    #[test]
    fn cleanup_feed_integrity_orphans_treats_feed_delete_cascade_as_already_clean() {
        let db = Mutex::new(DbManager::new_in_memory().expect("in-memory DB should initialize"));
        let syncing = AtomicBool::new(false);
        {
            let db_guard = db.lock().expect("test DB lock should succeed");
            insert_bulk_account(&db_guard, "acc-cascade", "Local");
            insert_bulk_feed(&db_guard, "feed-cascade", "acc-cascade", None, None);
            insert_bulk_article(
                &db_guard,
                "article-cascade",
                "feed-cascade",
                None,
                "2026-04-01T00:00:00Z",
                false,
                false,
            );
            SqliteFeedRepository::new(db_guard.writer())
                .delete(&FeedId("feed-cascade".to_string()))
                .expect("feed delete should cascade article rows");
        }

        let result = cleanup_feed_integrity_orphans_inner(&db, &syncing, false)
            .expect("cleanup after cascade should succeed");

        assert!(!result.dry_run);
        assert_eq!(result.orphaned_article_count, 0);
        assert_eq!(result.deleted_article_count, 0);
    }

    #[test]
    fn cleanup_feed_integrity_orphans_rejects_while_syncing() {
        let db = Mutex::new(DbManager::new_in_memory().expect("in-memory DB should initialize"));
        let syncing = AtomicBool::new(true);

        let error = cleanup_feed_integrity_orphans_inner(&db, &syncing, false)
            .expect_err("syncing should block cleanup");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == DATABASE_MAINTENANCE_BUSY_ERROR
        ));
    }

    #[test]
    fn get_feed_integrity_report_rejects_while_syncing_or_maintenance_is_reserved() {
        let db = Mutex::new(DbManager::new_in_memory().expect("in-memory DB should initialize"));
        let syncing = AtomicBool::new(true);

        let error = get_feed_integrity_report_inner(&db, &syncing)
            .expect_err("syncing should block feed integrity report reads");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == DATABASE_MAINTENANCE_BUSY_ERROR
        ));
    }

    #[test]
    fn get_feed_integrity_report_reads_orphans_only_when_idle() {
        let db = Mutex::new(DbManager::new_in_memory().expect("in-memory DB should initialize"));
        let syncing = AtomicBool::new(false);
        {
            let db_guard = db.lock().expect("test DB lock should succeed");
            insert_orphaned_article(&db_guard, "orphan-report", "missing-feed-report");
        }

        let result = get_feed_integrity_report_inner(&db, &syncing)
            .expect("idle feed integrity report should succeed");

        assert_eq!(result.orphaned_article_count, 1);
        assert_eq!(result.orphaned_feeds.len(), 1);
        assert_eq!(
            result.orphaned_feeds[0].missing_feed_id,
            "missing-feed-report"
        );
    }

    fn insert_bulk_account(db: &DbManager, id: &str, kind: &str) {
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                rusqlite::params![id, kind, id],
            )
            .expect("account insert should succeed");
    }

    fn insert_bulk_feed(
        db: &DbManager,
        id: &str,
        account_id: &str,
        folder_id: Option<&str>,
        remote_id: Option<&str>,
    ) {
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, folder_id, remote_id, title, url, site_url, unread_count, reader_mode, web_preview_mode)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 'inherit', 'inherit')",
                rusqlite::params![
                    id,
                    account_id,
                    folder_id,
                    remote_id,
                    id,
                    format!("https://example.com/{id}.xml"),
                    "https://example.com"
                ],
            )
            .expect("feed insert should succeed");
    }

    fn insert_bulk_article(
        db: &DbManager,
        id: &str,
        feed_id: &str,
        remote_id: Option<&str>,
        published_at: &str,
        is_read: bool,
        is_starred: bool,
    ) {
        db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, published_at, fetched_at, is_read, is_starred)
                 VALUES (?1, ?2, ?3, ?4, '', '', 1, ?5, ?5, ?6, ?7)",
                rusqlite::params![id, feed_id, remote_id, id, published_at, is_read, is_starred],
            )
            .expect("article insert should succeed");
    }

    fn insert_orphaned_article(db: &DbManager, id: &str, missing_feed_id: &str) {
        db.writer()
            .execute_batch("PRAGMA foreign_keys = OFF;")
            .expect("foreign key disable should succeed");
        db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, published_at, fetched_at)
                 VALUES (?1, ?2, ?3, ?4, '', '', 1, ?5, ?5)",
                rusqlite::params![
                    id,
                    missing_feed_id,
                    Option::<String>::None,
                    id,
                    "2026-04-01T00:00:00Z",
                ],
            )
            .expect("orphaned article insert should succeed");
        db.writer()
            .execute_batch("PRAGMA foreign_keys = ON;")
            .expect("foreign key enable should succeed");
    }

    fn feed_unread_count(db: &DbManager, feed_id: &str) -> i64 {
        db.reader()
            .query_row(
                "SELECT unread_count FROM feeds WHERE id = ?1",
                rusqlite::params![feed_id],
                |row| row.get(0),
            )
            .expect("feed unread count query should succeed")
    }

    fn pending_mutation_count(db: &DbManager) -> i64 {
        db.reader()
            .query_row("SELECT COUNT(*) FROM pending_mutations", [], |row| {
                row.get(0)
            })
            .expect("pending mutation count query should succeed")
    }

    fn article_is_read(db: &DbManager, article_id: &str) -> bool {
        db.reader()
            .query_row(
                "SELECT is_read FROM articles WHERE id = ?1",
                rusqlite::params![article_id],
                |row| row.get(0),
            )
            .expect("article read state query should succeed")
    }

    fn article_is_starred(db: &DbManager, article_id: &str) -> bool {
        db.reader()
            .query_row(
                "SELECT is_starred FROM articles WHERE id = ?1",
                rusqlite::params![article_id],
                |row| row.get(0),
            )
            .expect("article starred state query should succeed")
    }

    fn install_pending_mutation_insert_failure_trigger(db: &DbManager) {
        db.writer()
            .execute_batch(
                "CREATE TEMP TRIGGER fail_pending_mutation_insert
                 BEFORE INSERT ON pending_mutations
                 BEGIN
                   SELECT RAISE(FAIL, 'pending mutation insert failed');
                 END;",
            )
            .expect("pending mutation failure trigger should install");
    }

    #[test]
    fn article_read_and_star_commands_queue_pending_mutations_for_remote_feeds() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "FreshRss");
        insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
        insert_bulk_article(
            &db,
            "article-a",
            "feed-a",
            Some("remote-a"),
            "2026-04-01T00:00:00Z",
            false,
            false,
        );

        mark_article_read_with_conn(db.writer(), ArticleId("article-a".to_string()), true)
            .expect("read mutation should succeed");
        toggle_article_star_with_conn(db.writer(), ArticleId("article-a".to_string()), true)
            .expect("star mutation should succeed");

        let pending_repo = SqlitePendingMutationRepository::new(db.reader());
        let pending = pending_repo
            .find_by_account(&AccountId("acc-a".to_string()))
            .expect("pending mutation query should succeed");
        let pending_types = pending
            .iter()
            .map(|mutation| mutation.mutation_type)
            .collect::<Vec<_>>();

        assert_eq!(
            pending_types,
            vec![PendingMutationType::MarkRead, PendingMutationType::Star]
        );
        assert!(pending
            .iter()
            .all(|mutation| mutation.remote_entry_id == "remote-a"));
    }

    #[test]
    fn article_read_and_star_commands_do_not_queue_pending_mutations_for_local_feeds() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "Local");
        insert_bulk_feed(&db, "feed-a", "acc-a", None, None);
        insert_bulk_article(
            &db,
            "article-a",
            "feed-a",
            None,
            "2026-04-01T00:00:00Z",
            false,
            false,
        );

        mark_article_read_with_conn(db.writer(), ArticleId("article-a".to_string()), true)
            .expect("local read mutation should succeed");
        toggle_article_star_with_conn(db.writer(), ArticleId("article-a".to_string()), true)
            .expect("local star mutation should succeed");

        assert_eq!(pending_mutation_count(&db), 0);
    }

    #[test]
    fn mark_article_read_rolls_back_local_state_when_pending_mutation_queue_fails() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "FreshRss");
        insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
        insert_bulk_article(
            &db,
            "article-a",
            "feed-a",
            Some("remote-a"),
            "2026-04-01T00:00:00Z",
            false,
            false,
        );
        db.writer()
            .execute("UPDATE feeds SET unread_count = 1 WHERE id = 'feed-a'", [])
            .expect("feed unread count setup should succeed");
        install_pending_mutation_insert_failure_trigger(&db);

        let error =
            mark_article_read_with_conn(db.writer(), ArticleId("article-a".to_string()), true)
                .expect_err("pending mutation queue failure should reject the read mutation");

        assert!(matches!(
            error,
            AppError::UserVisible { ref message }
                if message.contains("pending mutation insert failed")
        ));
        assert!(!article_is_read(&db, "article-a"));
        assert_eq!(feed_unread_count(&db, "feed-a"), 1);
        assert_eq!(pending_mutation_count(&db), 0);
    }

    #[test]
    fn mark_articles_read_rolls_back_local_state_when_pending_mutation_queue_fails() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "FreshRss");
        insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
        insert_bulk_article(
            &db,
            "article-a",
            "feed-a",
            Some("remote-a"),
            "2026-04-01T00:00:00Z",
            false,
            false,
        );
        insert_bulk_article(
            &db,
            "article-b",
            "feed-a",
            Some("remote-b"),
            "2026-04-02T00:00:00Z",
            false,
            false,
        );
        db.writer()
            .execute("UPDATE feeds SET unread_count = 2 WHERE id = 'feed-a'", [])
            .expect("feed unread count setup should succeed");
        install_pending_mutation_insert_failure_trigger(&db);

        let error = mark_articles_read_with_conn(
            db.writer(),
            &[
                ArticleId("article-a".to_string()),
                ArticleId("article-b".to_string()),
            ],
        )
        .expect_err("pending mutation queue failure should reject the bulk read mutation");

        assert!(matches!(
            error,
            AppError::UserVisible { ref message }
                if message.contains("pending mutation insert failed")
        ));
        assert!(!article_is_read(&db, "article-a"));
        assert!(!article_is_read(&db, "article-b"));
        assert_eq!(feed_unread_count(&db, "feed-a"), 2);
        assert_eq!(pending_mutation_count(&db), 0);
    }

    #[test]
    fn mark_feed_read_rolls_back_local_state_when_pending_mutation_queue_fails() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "FreshRss");
        insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
        insert_bulk_article(
            &db,
            "article-a",
            "feed-a",
            Some("remote-a"),
            "2026-04-01T00:00:00Z",
            false,
            false,
        );
        db.writer()
            .execute("UPDATE feeds SET unread_count = 1 WHERE id = 'feed-a'", [])
            .expect("feed unread count setup should succeed");
        install_pending_mutation_insert_failure_trigger(&db);

        let error = mark_feed_read_with_conn(db.writer(), FeedId("feed-a".to_string()))
            .expect_err("pending mutation queue failure should reject feed mark read");

        assert!(matches!(
            error,
            AppError::UserVisible { ref message }
                if message.contains("pending mutation insert failed")
        ));
        assert!(!article_is_read(&db, "article-a"));
        assert_eq!(feed_unread_count(&db, "feed-a"), 1);
        assert_eq!(pending_mutation_count(&db), 0);
    }

    #[test]
    fn mark_folder_read_rolls_back_local_state_when_pending_mutation_queue_fails() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "FreshRss");
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES ('folder-a', 'acc-a', 'Folder', 0)",
                [],
            )
            .expect("folder insert should succeed");
        insert_bulk_feed(&db, "feed-a", "acc-a", Some("folder-a"), Some("feed/a"));
        insert_bulk_article(
            &db,
            "article-a",
            "feed-a",
            Some("remote-a"),
            "2026-04-01T00:00:00Z",
            false,
            false,
        );
        db.writer()
            .execute("UPDATE feeds SET unread_count = 1 WHERE id = 'feed-a'", [])
            .expect("feed unread count setup should succeed");
        install_pending_mutation_insert_failure_trigger(&db);

        let error = mark_folder_read_with_conn(db.writer(), FolderId("folder-a".to_string()))
            .expect_err("pending mutation queue failure should reject folder mark read");

        assert!(matches!(
            error,
            AppError::UserVisible { ref message }
                if message.contains("pending mutation insert failed")
        ));
        assert!(!article_is_read(&db, "article-a"));
        assert_eq!(feed_unread_count(&db, "feed-a"), 1);
        assert_eq!(pending_mutation_count(&db), 0);
    }

    #[test]
    fn bulk_account_and_old_unread_operations_roll_back_when_pending_mutation_queue_fails() {
        let cases: [(&str, Box<dyn Fn(&DbManager) -> Result<u64, AppError>>); 4] = [
            (
                "account read",
                Box::new(|db| bulk_mark_account_read(db.writer(), &AccountId("acc-a".to_string()))),
            ),
            (
                "account starred read",
                Box::new(|db| {
                    bulk_mark_account_starred_read(db.writer(), &AccountId("acc-a".to_string()))
                }),
            ),
            (
                "old unread",
                Box::new(|db| {
                    let before = chrono::DateTime::parse_from_rfc3339("2026-04-02T00:00:00Z")
                        .expect("timestamp should parse")
                        .with_timezone(&chrono::Utc);
                    bulk_mark_old_unread_read(db.writer(), OldUnreadScope::Account, "acc-a", before)
                }),
            ),
            (
                "account unstar",
                Box::new(|db| {
                    bulk_unstar_account_articles(db.writer(), &AccountId("acc-a".to_string()))
                }),
            ),
        ];

        for (name, run) in cases {
            let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
            insert_bulk_account(&db, "acc-a", "FreshRss");
            insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
            insert_bulk_article(
                &db,
                "article-a",
                "feed-a",
                Some("remote-a"),
                "2026-04-01T00:00:00Z",
                false,
                true,
            );
            db.writer()
                .execute("UPDATE feeds SET unread_count = 1 WHERE id = 'feed-a'", [])
                .expect("feed unread count setup should succeed");
            install_pending_mutation_insert_failure_trigger(&db);

            let error = run(&db).expect_err("bulk operation should reject queue failure");

            assert!(matches!(
                error,
                AppError::UserVisible { ref message }
                    if message.contains("pending mutation insert failed")
            ));
            assert!(!article_is_read(&db, "article-a"), "{name}");
            assert!(article_is_starred(&db, "article-a"), "{name}");
            assert_eq!(feed_unread_count(&db, "feed-a"), 1, "{name}");
            assert_eq!(pending_mutation_count(&db), 0, "{name}");
        }
    }

    #[test]
    fn article_mutation_transaction_policy_bulk_unstar_rolls_back_on_mid_batch_update_failure() {
        assert_eq!(ARTICLE_MUTATION_TRANSACTION_CHUNK_SIZE, None);

        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "FreshRss");
        insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
        insert_bulk_article(
            &db,
            "article-a",
            "feed-a",
            Some("remote-a"),
            "2026-04-01T00:00:00Z",
            true,
            true,
        );
        insert_bulk_article(
            &db,
            "article-b",
            "feed-a",
            Some("remote-b"),
            "2026-04-02T00:00:00Z",
            true,
            true,
        );
        db.writer()
            .execute(
                "CREATE TEMP TRIGGER fail_article_b_unstar
                 BEFORE UPDATE OF is_starred ON articles
                 WHEN NEW.id = 'article-b'
                 BEGIN
                   SELECT RAISE(ABORT, 'forced bulk unstar failure');
                 END",
                [],
            )
            .expect("failure trigger should install");

        let error = bulk_unstar_account_articles(db.writer(), &AccountId("acc-a".to_string()))
            .expect_err("mid-batch update failure should reject the bulk unstar mutation");

        assert!(matches!(
            error,
            AppError::UserVisible { ref message }
                if message.contains("forced bulk unstar failure")
        ));
        assert!(article_is_starred(&db, "article-a"));
        assert!(article_is_starred(&db, "article-b"));
        assert_eq!(pending_mutation_count(&db), 0);
    }

    #[test]
    fn toggle_article_star_rolls_back_local_state_when_pending_mutation_queue_fails() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "FreshRss");
        insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
        insert_bulk_article(
            &db,
            "article-a",
            "feed-a",
            Some("remote-a"),
            "2026-04-01T00:00:00Z",
            true,
            false,
        );
        install_pending_mutation_insert_failure_trigger(&db);

        let error =
            toggle_article_star_with_conn(db.writer(), ArticleId("article-a".to_string()), true)
                .expect_err("pending mutation queue failure should reject star toggle");

        assert!(matches!(
            error,
            AppError::UserVisible { ref message }
                if message.contains("pending mutation insert failed")
        ));
        assert!(!article_is_starred(&db, "article-a"));
        assert_eq!(pending_mutation_count(&db), 0);
    }

    #[test]
    fn bulk_mark_account_read_marks_only_account_and_queues_remote_mutations() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "FreshRss");
        insert_bulk_account(&db, "acc-b", "FreshRss");
        insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
        insert_bulk_feed(&db, "feed-b", "acc-b", None, Some("feed/b"));
        insert_bulk_article(
            &db,
            "article-a",
            "feed-a",
            Some("remote-a"),
            "2026-04-01T00:00:00Z",
            false,
            false,
        );
        insert_bulk_article(
            &db,
            "article-b",
            "feed-b",
            Some("remote-b"),
            "2026-04-01T00:00:00Z",
            false,
            false,
        );

        bulk_mark_account_read(db.writer(), &AccountId("acc-a".to_string()))
            .expect("bulk mark read should succeed");

        let account_a_unread: i64 = db
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM articles a JOIN feeds f ON a.feed_id = f.id WHERE f.account_id = 'acc-a' AND a.is_read = 0",
                [],
                |row| row.get(0),
            )
            .expect("count should succeed");
        let account_b_unread: i64 = db
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM articles a JOIN feeds f ON a.feed_id = f.id WHERE f.account_id = 'acc-b' AND a.is_read = 0",
                [],
                |row| row.get(0),
            )
            .expect("count should succeed");
        let pending_repo = SqlitePendingMutationRepository::new(db.reader());
        let pending = pending_repo
            .find_by_account(&AccountId("acc-a".to_string()))
            .expect("pending query should succeed");

        assert_eq!(account_a_unread, 0);
        assert_eq!(account_b_unread, 1);
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].mutation_type, PendingMutationType::MarkRead);
        assert_eq!(pending[0].remote_entry_id, "remote-a");
    }

    #[test]
    fn bulk_feed_unread_recalculation_handles_duplicate_rows_once_per_feed() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "Local");
        insert_bulk_feed(&db, "feed-a", "acc-a", None, None);
        insert_bulk_feed(&db, "feed-b", "acc-a", None, None);
        insert_bulk_article(
            &db,
            "article-a1",
            "feed-a",
            None,
            "2026-04-01T00:00:00Z",
            false,
            false,
        );
        insert_bulk_article(
            &db,
            "article-a2",
            "feed-a",
            None,
            "2026-04-02T00:00:00Z",
            false,
            false,
        );
        insert_bulk_article(
            &db,
            "article-b1",
            "feed-b",
            None,
            "2026-04-03T00:00:00Z",
            false,
            false,
        );
        db.writer()
            .execute("UPDATE feeds SET unread_count = 99 WHERE id = 'feed-a'", [])
            .expect("feed-a stale count update should succeed");
        db.writer()
            .execute("UPDATE feeds SET unread_count = 77 WHERE id = 'feed-b'", [])
            .expect("feed-b stale count update should succeed");

        let duplicate_rows = vec![
            BulkArticleMutationRow {
                article_id: "article-a1".to_string(),
                feed_id: "feed-a".to_string(),
                remote_entry_id: None,
                account_kind: "Local".to_string(),
                account_id: "acc-a".to_string(),
                feed_remote_id: None,
            },
            BulkArticleMutationRow {
                article_id: "article-a2".to_string(),
                feed_id: "feed-a".to_string(),
                remote_entry_id: None,
                account_kind: "Local".to_string(),
                account_id: "acc-a".to_string(),
                feed_remote_id: None,
            },
            BulkArticleMutationRow {
                article_id: "article-a1-duplicate".to_string(),
                feed_id: "feed-a".to_string(),
                remote_entry_id: None,
                account_kind: "Local".to_string(),
                account_id: "acc-a".to_string(),
                feed_remote_id: None,
            },
        ];

        recalculate_bulk_feed_unread_counts(db.writer(), &duplicate_rows)
            .expect("bulk feed unread recalculation should succeed");

        let feed_a_unread: i64 = db
            .reader()
            .query_row(
                "SELECT unread_count FROM feeds WHERE id = 'feed-a'",
                [],
                |row| row.get(0),
            )
            .expect("feed-a unread count query should succeed");
        let feed_b_unread: i64 = db
            .reader()
            .query_row(
                "SELECT unread_count FROM feeds WHERE id = 'feed-b'",
                [],
                |row| row.get(0),
            )
            .expect("feed-b unread count query should succeed");

        assert_eq!(feed_a_unread, 2);
        assert_eq!(feed_b_unread, 77);
    }

    #[test]
    fn old_unread_missing_targets_are_zero_count_success() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "Local");
        insert_bulk_feed(&db, "feed-a", "acc-a", None, None);
        insert_bulk_article(
            &db,
            "article-a",
            "feed-a",
            None,
            "2026-03-01T00:00:00Z",
            false,
            false,
        );
        let before = chrono::DateTime::parse_from_rfc3339("2026-04-01T00:00:00Z")
            .expect("timestamp should parse")
            .with_timezone(&chrono::Utc);

        let cases = [
            (OldUnreadScope::Account, "missing-account"),
            (OldUnreadScope::Feed, "missing-feed"),
            (OldUnreadScope::Folder, "missing-folder"),
        ];

        for (scope, target_id) in cases {
            let rows = collect_old_unread_rows(db.reader(), scope, target_id, before)
                .expect("missing old unread target count should succeed");
            let marked = bulk_mark_old_unread_read(db.writer(), scope, target_id, before)
                .expect("missing old unread target mark should succeed");

            assert!(rows.is_empty(), "{target_id} should count as zero");
            assert_eq!(marked, 0, "{target_id} should mark zero articles");
        }
        assert!(!article_is_read(&db, "article-a"));
        assert_eq!(feed_unread_count(&db, "feed-a"), 0);
        assert_eq!(pending_mutation_count(&db), 0);
    }

    #[test]
    fn bulk_mark_old_unread_read_respects_scope_and_published_threshold() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "Local");
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES ('folder-a', 'acc-a', 'Folder', 0)",
                [],
            )
            .expect("folder insert should succeed");
        insert_bulk_feed(&db, "feed-in-folder", "acc-a", Some("folder-a"), None);
        insert_bulk_feed(&db, "feed-outside", "acc-a", None, None);
        insert_bulk_article(
            &db,
            "old-in-folder",
            "feed-in-folder",
            None,
            "2026-03-01T00:00:00Z",
            false,
            false,
        );
        insert_bulk_article(
            &db,
            "new-in-folder",
            "feed-in-folder",
            None,
            "2026-05-01T00:00:00Z",
            false,
            false,
        );
        insert_bulk_article(
            &db,
            "old-outside",
            "feed-outside",
            None,
            "2026-03-01T00:00:00Z",
            false,
            false,
        );
        let before = chrono::DateTime::parse_from_rfc3339("2026-04-01T00:00:00Z")
            .expect("timestamp should parse")
            .with_timezone(&chrono::Utc);

        let count =
            bulk_mark_old_unread_read(db.writer(), OldUnreadScope::Folder, "folder-a", before)
                .expect("old unread mark should succeed");

        let read_ids: Vec<String> = db
            .reader()
            .prepare("SELECT id FROM articles WHERE is_read = 1 ORDER BY id")
            .and_then(|mut stmt| {
                stmt.query_map([], |row| row.get::<_, String>(0))
                    .and_then(|rows| rows.collect())
            })
            .expect("read id query should succeed");

        assert_eq!(count, 1);
        assert_eq!(read_ids, vec!["old-in-folder"]);
    }

    #[test]
    fn old_unread_cutoff_is_stable_for_the_same_utc_day() {
        let before_midnight = chrono::DateTime::parse_from_rfc3339("2026-05-10T00:00:01Z")
            .expect("timestamp should parse")
            .with_timezone(&chrono::Utc);
        let before_next_midnight = chrono::DateTime::parse_from_rfc3339("2026-05-10T23:59:59Z")
            .expect("timestamp should parse")
            .with_timezone(&chrono::Utc);

        assert_eq!(
            old_unread_before_from_now(before_midnight, 7),
            old_unread_before_from_now(before_next_midnight, 7)
        );
        assert_eq!(
            old_unread_before_from_now(before_midnight, 7).to_rfc3339(),
            "2026-05-03T00:00:00+00:00"
        );
    }

    #[test]
    fn old_unread_uses_normalized_timestamp_comparison() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "Local");
        insert_bulk_feed(&db, "feed-a", "acc-a", None, None);
        insert_bulk_article(
            &db,
            "fractional-old",
            "feed-a",
            None,
            "2026-03-31T23:59:59.999Z",
            false,
            false,
        );
        insert_bulk_article(
            &db,
            "offset-equal-cutoff",
            "feed-a",
            None,
            "2026-04-01T09:00:00+09:00",
            false,
            false,
        );
        insert_bulk_article(
            &db,
            "invalid-legacy",
            "feed-a",
            None,
            "not-a-timestamp",
            false,
            false,
        );
        let before = chrono::DateTime::parse_from_rfc3339("2026-04-01T00:00:00Z")
            .expect("timestamp should parse")
            .with_timezone(&chrono::Utc);

        let count =
            bulk_mark_old_unread_read(db.writer(), OldUnreadScope::Account, "acc-a", before)
                .expect("old unread mark should succeed");

        assert_eq!(count, 1);
        assert!(article_is_read(&db, "fractional-old"));
        assert!(!article_is_read(&db, "offset-equal-cutoff"));
        assert!(!article_is_read(&db, "invalid-legacy"));
    }

    #[test]
    fn bulk_mark_old_unread_read_queues_only_provider_supported_pending_mutations() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "FreshRss");
        insert_bulk_account(&db, "acc-local", "Local");
        insert_bulk_account(&db, "acc-future", "FutureProvider");
        insert_bulk_feed(&db, "feed-remote", "acc-a", None, Some("feed/a"));
        insert_bulk_feed(
            &db,
            "feed-local-like",
            "acc-a",
            None,
            Some("https://example.com/feed.xml"),
        );
        insert_bulk_feed(&db, "feed-local", "acc-local", None, None);
        insert_bulk_feed(&db, "feed-future", "acc-future", None, Some("feed/future"));
        insert_bulk_article(
            &db,
            "remote-a",
            "feed-remote",
            Some("remote-shared"),
            "2026-03-01T00:00:00Z",
            false,
            false,
        );
        insert_bulk_article(
            &db,
            "remote-b",
            "feed-remote",
            Some("remote-shared"),
            "2026-03-02T00:00:00Z",
            false,
            false,
        );
        insert_bulk_article(
            &db,
            "local-like",
            "feed-local-like",
            Some("local-guid"),
            "2026-03-01T00:00:00Z",
            false,
            false,
        );
        insert_bulk_article(
            &db,
            "local",
            "feed-local",
            None,
            "2026-03-01T00:00:00Z",
            false,
            false,
        );
        insert_bulk_article(
            &db,
            "future",
            "feed-future",
            Some("future-remote"),
            "2026-03-01T00:00:00Z",
            false,
            false,
        );
        let before = chrono::DateTime::parse_from_rfc3339("2026-04-01T00:00:00Z")
            .expect("timestamp should parse")
            .with_timezone(&chrono::Utc);

        let count =
            bulk_mark_old_unread_read(db.writer(), OldUnreadScope::Account, "acc-a", before)
                .expect("old unread mark should succeed");

        let pending_repo = SqlitePendingMutationRepository::new(db.reader());
        let pending = pending_repo
            .find_by_account(&AccountId("acc-a".to_string()))
            .expect("pending mutation query should succeed");

        assert_eq!(count, 3);
        assert!(article_is_read(&db, "remote-a"));
        assert!(article_is_read(&db, "remote-b"));
        assert!(article_is_read(&db, "local-like"));
        assert!(!article_is_read(&db, "local"));
        assert!(!article_is_read(&db, "future"));
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].mutation_type, PendingMutationType::MarkRead);
        assert_eq!(pending[0].remote_entry_id, "remote-shared");
        assert_eq!(pending_mutation_count(&db), 1);
    }

    #[test]
    fn old_unread_scope_parse_accepts_command_scope_values() {
        assert_eq!(
            OldUnreadScope::parse("account").unwrap(),
            OldUnreadScope::Account
        );
        assert_eq!(OldUnreadScope::parse("feed").unwrap(), OldUnreadScope::Feed);
        assert_eq!(
            OldUnreadScope::parse("folder").unwrap(),
            OldUnreadScope::Folder
        );
    }

    #[test]
    fn old_unread_scope_parse_rejects_invalid_scope_with_user_visible_error() {
        let error = OldUnreadScope::parse("tag").expect_err("unknown scope should be rejected");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Invalid old unread scope"
        ));
    }

    #[test]
    fn validate_older_than_days_accepts_supported_command_values() {
        assert_eq!(validate_older_than_days(7).unwrap(), 7);
        assert_eq!(validate_older_than_days(30).unwrap(), 30);
        assert_eq!(validate_older_than_days(90).unwrap(), 90);
    }

    #[test]
    fn validate_older_than_days_rejects_invalid_values_with_user_visible_error() {
        for value in [0, -7, 1, 365] {
            let error =
                validate_older_than_days(value).expect_err("invalid period should be rejected");

            assert!(matches!(
                error,
                AppError::UserVisible { message } if message == "Invalid old unread period"
            ));
        }
    }

    #[test]
    fn bulk_unstar_account_articles_scopes_and_queues_remote_mutations() {
        let db = DbManager::new_in_memory().expect("in-memory DB should initialize");
        insert_bulk_account(&db, "acc-a", "FreshRss");
        insert_bulk_account(&db, "acc-b", "FreshRss");
        insert_bulk_feed(&db, "feed-a", "acc-a", None, Some("feed/a"));
        insert_bulk_feed(&db, "feed-b", "acc-b", None, Some("feed/b"));
        insert_bulk_article(
            &db,
            "article-a",
            "feed-a",
            Some("remote-a"),
            "2026-04-01T00:00:00Z",
            true,
            true,
        );
        insert_bulk_article(
            &db,
            "article-b",
            "feed-b",
            Some("remote-b"),
            "2026-04-01T00:00:00Z",
            true,
            true,
        );

        let count = bulk_unstar_account_articles(db.writer(), &AccountId("acc-a".to_string()))
            .expect("unstar should succeed");

        let account_a_starred: i64 = db
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM articles a JOIN feeds f ON a.feed_id = f.id WHERE f.account_id = 'acc-a' AND a.is_starred = 1",
                [],
                |row| row.get(0),
            )
            .expect("count should succeed");
        let account_b_starred: i64 = db
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM articles a JOIN feeds f ON a.feed_id = f.id WHERE f.account_id = 'acc-b' AND a.is_starred = 1",
                [],
                |row| row.get(0),
            )
            .expect("count should succeed");
        let pending_repo = SqlitePendingMutationRepository::new(db.reader());
        let pending = pending_repo
            .find_by_account(&AccountId("acc-a".to_string()))
            .expect("pending query should succeed");

        assert_eq!(count, 1);
        assert_eq!(account_a_starred, 0);
        assert_eq!(account_b_starred, 1);
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].mutation_type, PendingMutationType::Unstar);
        assert_eq!(pending[0].remote_entry_id, "remote-a");
    }
}
