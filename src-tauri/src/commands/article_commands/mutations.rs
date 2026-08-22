use chrono::{DateTime, NaiveTime, SecondsFormat, Utc};
use rusqlite::OptionalExtension;
use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::domain::error::DomainError;
use crate::domain::provider::is_greader_managed_feed_remote_id;
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::repository::article::ArticleRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::pending_mutation::{PendingMutation, PendingMutationType};

pub(crate) fn provider_supports_pending_article_mutations(account_kind: &str) -> bool {
    matches!(account_kind, "FreshRss")
}

pub(crate) fn feed_supports_pending_article_mutations(feed_remote_id: Option<&str>) -> bool {
    is_greader_managed_feed_remote_id(feed_remote_id)
}

pub(crate) fn supports_remote_mutations(account_kind: &str, feed_remote_id: Option<&str>) -> bool {
    provider_supports_pending_article_mutations(account_kind)
        && feed_supports_pending_article_mutations(feed_remote_id)
}

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

pub(crate) struct BulkArticleMutationRow {
    pub(crate) article_id: String,
    pub(crate) feed_id: String,
    pub(crate) remote_entry_id: Option<String>,
    pub(crate) account_kind: String,
    pub(crate) account_id: String,
    pub(crate) feed_remote_id: Option<String>,
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

pub(crate) fn collect_article_mutation_rows(
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

pub(crate) fn queue_bulk_pending_mutations(
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

pub(crate) fn save_pending_mutation(
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

pub(crate) fn mark_article_read_with_conn(
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

pub(crate) fn mark_articles_read_with_conn(
    conn: &rusqlite::Connection,
    ids: &[ArticleId],
) -> Result<(), AppError> {
    let tx = conn.unchecked_transaction().map_err(DomainError::from)?;
    let rows = collect_existing_article_rows_by_id(&tx, ids)?;
    mark_rows_read(&tx, &rows)?;

    tx.commit().map_err(DomainError::from)?;
    Ok(())
}

pub(crate) fn toggle_article_star_with_conn(
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

pub(crate) fn mark_feed_read_with_conn(
    conn: &rusqlite::Connection,
    feed_id: FeedId,
) -> Result<Vec<String>, AppError> {
    let tx = conn.unchecked_transaction().map_err(DomainError::from)?;
    let rows = collect_feed_unread_rows(&tx, &feed_id)?;
    mark_rows_read(&tx, &rows)?;
    tx.commit().map_err(DomainError::from)?;
    Ok(rows.into_iter().map(|row| row.article_id).collect())
}

pub(crate) fn mark_folder_read_with_conn(
    conn: &rusqlite::Connection,
    folder_id: FolderId,
) -> Result<Vec<String>, AppError> {
    let tx = conn.unchecked_transaction().map_err(DomainError::from)?;
    let rows = collect_folder_unread_rows(&tx, &folder_id)?;
    mark_rows_read(&tx, &rows)?;
    tx.commit().map_err(DomainError::from)?;
    Ok(rows.into_iter().map(|row| row.article_id).collect())
}

pub(crate) fn record_article_view_with_conn(
    conn: &rusqlite::Connection,
    account_id: AccountId,
    article_id: ArticleId,
) -> Result<(), AppError> {
    let repo = SqliteArticleRepository::new(conn);
    repo.record_view(&account_id, &article_id)?;
    Ok(())
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
pub fn mark_feed_read(
    state: State<'_, AppState>,
    feed_id: String,
) -> Result<Vec<String>, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let feed_id = FeedId(feed_id);
    mark_feed_read_with_conn(db.writer(), feed_id)
}

#[tauri::command]
pub fn mark_folder_read(
    state: State<'_, AppState>,
    folder_id: String,
) -> Result<Vec<String>, AppError> {
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
pub(crate) fn maybe_queue_mutation(
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

pub(crate) fn maybe_queue_mutation_in_current_transaction(
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
