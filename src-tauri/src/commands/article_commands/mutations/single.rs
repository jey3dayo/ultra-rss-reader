use std::cell::Cell;
use std::sync::Mutex;
use std::time::Instant;

use rusqlite::OptionalExtension;
use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::domain::error::DomainError;
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::repository::article::{ArticleHistoryRepository, ArticleMutationRepository};
use crate::repository::feed::FeedRepository;
use crate::repository::pending_mutation::PendingMutationType;

use super::bulk::{
    collect_existing_article_rows_by_id, collect_feed_unread_rows, collect_folder_unread_rows,
    mark_rows_read,
};
use super::pending::maybe_queue_mutation_in_current_transaction;
use super::read_diagnostics::{
    classify_domain_error, classify_rusqlite_error, log_mark_article_read_failure,
    log_mark_article_read_timing, MarkArticleReadStage, ReadDbErrorClass, ReadDiagnosticContext,
};
use crate::commands::dto::ReadDiagnosticContextArg;

type MarkArticleReadFailureStage = (MarkArticleReadStage, ReadDbErrorClass);

/// Mirrors `mark_article_read_with_conn`'s previous transaction/commit contract exactly (same
/// lock/transaction/commit structure and rollback behavior); the only addition is that each
/// fallible step records which stage and safe error class it failed at into `failure_stage_out`
/// before returning its `AppError` unchanged. Logging itself happens once, in the caller, after
/// this function returns -- see `mark_article_read_impl` -- so a stage failure here and the
/// command-boundary timing are always reported as a single consolidated log line rather than two.
pub(crate) fn mark_article_read_with_conn(
    conn: &rusqlite::Connection,
    article_id: ArticleId,
    read: bool,
    failure_stage_out: &Cell<Option<MarkArticleReadFailureStage>>,
) -> Result<(), AppError> {
    let tx = conn.unchecked_transaction().map_err(|e| {
        failure_stage_out.set(Some((
            MarkArticleReadStage::Lock,
            classify_rusqlite_error(&e),
        )));
        AppError::from(DomainError::from(e))
    })?;

    let repo = SqliteArticleRepository::new(&tx);
    repo.mark_as_read(&article_id, read).map_err(|e| {
        failure_stage_out.set(Some((
            MarkArticleReadStage::UpdateRead,
            classify_domain_error(&e),
        )));
        AppError::from(e)
    })?;

    let feed_id_str = tx
        .query_row(
            "SELECT feed_id FROM articles WHERE id = ?1",
            rusqlite::params![article_id.0],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| {
            failure_stage_out.set(Some((
                MarkArticleReadStage::RecalculateCount,
                classify_rusqlite_error(&e),
            )));
            AppError::from(DomainError::from(e))
        })?;

    if let Some(feed_id_str) = feed_id_str {
        let feed_repo = SqliteFeedRepository::new(&tx);
        feed_repo
            .recalculate_unread_count(&FeedId(feed_id_str))
            .map_err(|e| {
                failure_stage_out.set(Some((
                    MarkArticleReadStage::RecalculateCount,
                    classify_domain_error(&e),
                )));
                AppError::from(e)
            })?;

        let mutation_type = if read {
            PendingMutationType::MarkRead
        } else {
            PendingMutationType::MarkUnread
        };
        maybe_queue_mutation_in_current_transaction(&tx, &article_id, mutation_type).inspect_err(
            |_e| {
                // maybe_queue_mutation_in_current_transaction already returns AppError; its
                // message is user-visible-safe but not diagnostic-safe, so record a fixed class.
                failure_stage_out.set(Some((
                    MarkArticleReadStage::QueueMutation,
                    ReadDbErrorClass::Other,
                )));
            },
        )?;
    }

    tx.commit().map_err(|e| {
        failure_stage_out.set(Some((
            MarkArticleReadStage::Commit,
            classify_rusqlite_error(&e),
        )));
        AppError::from(DomainError::from(e))
    })?;

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

/// Body of the `mark_article_read` command, extracted from the `#[tauri::command]` wrapper so it
/// is directly unit-testable against a plain `Mutex<DbManager>` (including a poisoned one)
/// without needing a full Tauri `State`/`AppState` harness.
///
/// Diagnostic context is built before the lock is even attempted so that a poisoned mutex (which
/// returns before any transaction starts) is still recorded as a stage="lock" failure rather than
/// silently skipping diagnostics for this outcome. The DB guard is dropped before any diagnostic
/// logging runs, so the (synchronous, in-process) `tracing` call never extends how long the
/// database mutex is held.
pub(crate) fn mark_article_read_impl(
    db: &Mutex<DbManager>,
    article_id: String,
    read: Option<bool>,
    context: Option<ReadDiagnosticContextArg>,
) -> Result<(), AppError> {
    let context = ReadDiagnosticContext::from_arg_or_backend_generated(context);

    let lock_wait_start = Instant::now();
    let db_guard = match crate::commands::lock_db(db) {
        Ok(guard) => guard,
        Err(e) => {
            // No transaction was ever attempted here, so transaction_elapsed is genuinely zero,
            // not a fabricated placeholder.
            log_mark_article_read_failure(
                &context,
                MarkArticleReadStage::Lock,
                ReadDbErrorClass::Other,
                lock_wait_start.elapsed(),
                std::time::Duration::ZERO,
            );
            return Err(e);
        }
    };
    let lock_wait = lock_wait_start.elapsed();

    let article_id = ArticleId(article_id);
    let read = read.unwrap_or(true);

    let failure_stage: Cell<Option<MarkArticleReadFailureStage>> = Cell::new(None);
    let transaction_start = Instant::now();
    let result = mark_article_read_with_conn(db_guard.writer(), article_id, read, &failure_stage);
    let transaction_elapsed = transaction_start.elapsed();

    // Release the DB mutex before any diagnostic logging, so logging never extends the time the
    // lock is held.
    drop(db_guard);

    match &result {
        Ok(()) => {
            log_mark_article_read_timing(&context, lock_wait, transaction_elapsed);
        }
        Err(_) => {
            // failure_stage is guaranteed to be set whenever mark_article_read_with_conn returns
            // an Err: every one of its fallible steps sets it in the same closure that produces
            // the error. Fall back to QueueMutation/Other only as defense-in-depth, never as the
            // expected path.
            let (stage, error_class) = failure_stage
                .get()
                .unwrap_or((MarkArticleReadStage::QueueMutation, ReadDbErrorClass::Other));
            log_mark_article_read_failure(
                &context,
                stage,
                error_class,
                lock_wait,
                transaction_elapsed,
            );
        }
    }

    result
}

#[tauri::command]
pub fn mark_article_read(
    state: State<'_, AppState>,
    article_id: String,
    read: Option<bool>,
    context: Option<ReadDiagnosticContextArg>,
) -> Result<(), AppError> {
    mark_article_read_impl(&state.db, article_id, read, context)
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
