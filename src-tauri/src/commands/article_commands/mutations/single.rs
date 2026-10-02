use std::cell::Cell;
use std::sync::Mutex;
use std::time::Instant;

use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::repository::article::ArticleHistoryRepository;

use super::read_diagnostics::{
    classify_sqlite_error_code, log_mark_article_read_failure, log_mark_article_read_timing,
    MarkArticleReadStage, ReadDbErrorClass, ReadDiagnosticContext,
};
use crate::commands::dto::ReadDiagnosticContextArg;
use crate::infra::db::sqlite_article_change::{
    apply_article_change, ArticleChange, ArticleChangeStage, ArticleReadScope,
};

type MarkArticleReadFailureStage = (MarkArticleReadStage, ReadDbErrorClass);

pub(crate) fn mark_article_read_with_conn(
    conn: &rusqlite::Connection,
    article_id: ArticleId,
    read: bool,
    failure_stage_out: &Cell<Option<MarkArticleReadFailureStage>>,
) -> Result<(), AppError> {
    apply_article_change(conn, ArticleChange::Read(&article_id, read))
        .map(|_| ())
        .map_err(|failure| {
            let stage = match failure.stage {
                ArticleChangeStage::Begin => MarkArticleReadStage::Lock,
                ArticleChangeStage::Update => MarkArticleReadStage::UpdateRead,
                ArticleChangeStage::RecalculateCount => MarkArticleReadStage::RecalculateCount,
                ArticleChangeStage::QueueMutation => MarkArticleReadStage::QueueMutation,
                ArticleChangeStage::Commit => MarkArticleReadStage::Commit,
            };
            let error_class = classify_sqlite_error_code(failure.sqlite_code);
            failure_stage_out.set(Some((stage, error_class)));
            AppError::from(failure.error)
        })
}

pub(crate) fn mark_articles_read_with_conn(
    conn: &rusqlite::Connection,
    ids: &[ArticleId],
) -> Result<(), AppError> {
    apply_article_change(
        conn,
        ArticleChange::MarkRead(ArticleReadScope::Articles(ids)),
    )
    .map(|_| ())
    .map_err(|failure| AppError::from(failure.error))
}

pub(crate) fn toggle_article_star_with_conn(
    conn: &rusqlite::Connection,
    article_id: ArticleId,
    starred: bool,
) -> Result<(), AppError> {
    apply_article_change(conn, ArticleChange::Star(&article_id, starred))
        .map(|_| ())
        .map_err(|failure| AppError::from(failure.error))
}

pub(crate) fn mark_feed_read_with_conn(
    conn: &rusqlite::Connection,
    feed_id: FeedId,
) -> Result<Vec<String>, AppError> {
    apply_article_change(
        conn,
        ArticleChange::MarkRead(ArticleReadScope::Feed(&feed_id)),
    )
    .map_err(|failure| AppError::from(failure.error))
}

pub(crate) fn mark_folder_read_with_conn(
    conn: &rusqlite::Connection,
    folder_id: FolderId,
) -> Result<Vec<String>, AppError> {
    apply_article_change(
        conn,
        ArticleChange::MarkRead(ArticleReadScope::Folder(&folder_id)),
    )
    .map_err(|failure| AppError::from(failure.error))
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
