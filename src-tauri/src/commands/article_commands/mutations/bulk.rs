use chrono::{DateTime, NaiveTime, Utc};
use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::domain::types::AccountId;
pub(crate) use crate::infra::db::sqlite_article_change::OldUnreadScope;
use crate::infra::db::sqlite_article_change::{
    apply_article_change, count_old_unread_articles as count_old_unread_with_conn, ArticleChange,
    ArticleReadScope,
};

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

pub(crate) fn bulk_mark_account_read(
    conn: &rusqlite::Connection,
    account_id: &AccountId,
) -> Result<u64, AppError> {
    let ids = apply_article_change(
        conn,
        ArticleChange::MarkRead(ArticleReadScope::Account(account_id)),
    )
    .map_err(|failure| AppError::from(failure.error))?;
    Ok(ids.len() as u64)
}

pub(crate) fn bulk_mark_account_starred_read(
    conn: &rusqlite::Connection,
    account_id: &AccountId,
) -> Result<u64, AppError> {
    let ids = apply_article_change(
        conn,
        ArticleChange::MarkRead(ArticleReadScope::StarredAccount(account_id)),
    )
    .map_err(|failure| AppError::from(failure.error))?;
    Ok(ids.len() as u64)
}

pub(crate) fn bulk_unstar_account_articles(
    conn: &rusqlite::Connection,
    account_id: &AccountId,
) -> Result<u64, AppError> {
    let ids = apply_article_change(conn, ArticleChange::UnstarAccount(account_id))
        .map_err(|failure| AppError::from(failure.error))?;
    Ok(ids.len() as u64)
}

pub(crate) fn bulk_mark_old_unread_read(
    conn: &rusqlite::Connection,
    scope: OldUnreadScope,
    target_id: &str,
    before: DateTime<Utc>,
) -> Result<u64, AppError> {
    let ids = apply_article_change(
        conn,
        ArticleChange::MarkRead(ArticleReadScope::Old {
            scope,
            target_id,
            before,
        }),
    )
    .map_err(|failure| AppError::from(failure.error))?;
    Ok(ids.len() as u64)
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
    let count = count_old_unread_with_conn(db.reader(), scope, &target_id, before)?;
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
