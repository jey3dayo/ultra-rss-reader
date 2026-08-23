use chrono::{DateTime, NaiveTime, SecondsFormat, Utc};
use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::domain::error::DomainError;
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::pending_mutation::PendingMutationType;

use super::pending::{
    collect_article_mutation_rows, queue_bulk_pending_mutations, BulkArticleMutationRow,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum OldUnreadScope {
    Account,
    Feed,
    Folder,
}

impl OldUnreadScope {
    pub(crate) fn parse(scope_kind: &str) -> Result<Self, AppError> {
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

pub(crate) fn validate_older_than_days(older_than_days: i64) -> Result<i64, AppError> {
    match older_than_days {
        7 | 30 | 90 => Ok(older_than_days),
        _ => Err(AppError::UserVisible {
            message: "Invalid old unread period".to_string(),
        }),
    }
}

pub(crate) fn old_unread_before(older_than_days: i64) -> Result<DateTime<Utc>, AppError> {
    let older_than_days = validate_older_than_days(older_than_days)?;
    Ok(old_unread_before_from_now(Utc::now(), older_than_days))
}

pub(crate) fn old_unread_before_from_now(
    now: DateTime<Utc>,
    older_than_days: i64,
) -> DateTime<Utc> {
    now.date_naive().and_time(NaiveTime::MIN).and_utc() - chrono::Duration::days(older_than_days)
}

pub(crate) fn collect_account_unread_rows(
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

pub(crate) fn collect_account_starred_rows(
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

pub(crate) fn collect_account_starred_unread_rows(
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

pub(crate) fn collect_feed_unread_rows(
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

pub(crate) fn collect_folder_unread_rows(
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

pub(crate) fn collect_old_unread_rows(
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

pub(crate) fn collect_existing_article_rows_by_id(
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

pub(crate) fn recalculate_bulk_feed_unread_counts(
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

pub(crate) fn mark_rows_read(
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

pub(crate) fn bulk_mark_account_read(
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

pub(crate) fn bulk_mark_account_starred_read(
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

pub(crate) fn bulk_mark_old_unread_read(
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

pub(crate) fn bulk_unstar_account_articles(
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
