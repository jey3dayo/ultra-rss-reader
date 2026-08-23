use tauri::State;

use crate::commands::dto::{AppError, MuteKeywordDto};
use crate::commands::AppState;
use crate::domain::error::DomainError;
use crate::domain::mute_keyword::MuteKeywordScope;
use crate::domain::types::AccountId;
use crate::infra::db::sqlite_article::mark_muted_unread_as_read_with_conn;
use crate::infra::db::sqlite_mute_keyword::SqliteMuteKeywordRepository;
use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
use crate::repository::mute_keyword::MuteKeywordRepository;
use crate::repository::preference::PreferenceRepository;

fn lock_db(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
) -> Result<std::sync::MutexGuard<'_, crate::infra::db::connection::DbManager>, AppError> {
    crate::commands::lock_db(db)
}

fn maybe_mark_existing_muted_articles_as_read(conn: &rusqlite::Connection) -> Result<(), AppError> {
    if !is_mute_auto_mark_read_enabled(conn)? {
        return Ok(());
    }

    if let Some(account_id) = selected_account_id_with_feeds(conn)? {
        mark_muted_unread_as_read_with_conn(conn, &account_id, None)?;
    }

    Ok(())
}

fn is_mute_auto_mark_read_enabled(conn: &rusqlite::Connection) -> Result<bool, AppError> {
    let pref_repo = SqlitePreferenceRepository::new(conn);
    Ok(pref_repo
        .get("mute_auto_mark_read")?
        .as_deref()
        .is_some_and(|value| value == "true"))
}

fn selected_account_id_with_feeds(
    conn: &rusqlite::Connection,
) -> Result<Option<AccountId>, AppError> {
    let selected_account_id = SqlitePreferenceRepository::new(conn).get("selected_account_id")?;
    let Some(selected_account_id) = selected_account_id else {
        return Ok(None);
    };
    let selected_account_id = selected_account_id.trim();
    if selected_account_id.is_empty() {
        return Ok(None);
    }

    let has_feed = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM feeds WHERE account_id = ?1)",
            rusqlite::params![selected_account_id],
            |row| row.get::<_, bool>(0),
        )
        .map_err(crate::domain::error::DomainError::from)?;
    Ok(has_feed.then(|| AccountId(selected_account_id.to_string())))
}

fn set_mute_auto_mark_read_impl(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
    enabled: bool,
) -> Result<(), AppError> {
    let db = lock_db(db)?;
    let tx = db
        .writer()
        .unchecked_transaction()
        .map_err(crate::domain::error::DomainError::from)?;
    let pref_repo = SqlitePreferenceRepository::new(&tx);
    pref_repo.set(
        "mute_auto_mark_read",
        if enabled { "true" } else { "false" },
    )?;

    if enabled {
        if let Some(account_id) = selected_account_id_with_feeds(&tx)? {
            mark_muted_unread_as_read_with_conn(&tx, &account_id, None)?;
        }
    }

    tx.commit()
        .map_err(crate::domain::error::DomainError::from)?;
    Ok(())
}

#[tauri::command]
pub fn list_mute_keywords(state: State<'_, AppState>) -> Result<Vec<MuteKeywordDto>, AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteMuteKeywordRepository::new(db.reader());
    let rules = repo.find_all()?;
    Ok(rules.into_iter().map(MuteKeywordDto::from).collect())
}

#[tauri::command]
pub fn create_mute_keyword(
    state: State<'_, AppState>,
    keyword: String,
    scope: String,
) -> Result<MuteKeywordDto, AppError> {
    create_mute_keyword_impl(&state.db, keyword, scope)
}

fn create_mute_keyword_impl(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
    keyword: String,
    scope: String,
) -> Result<MuteKeywordDto, AppError> {
    let scope = MuteKeywordScope::try_from(scope.as_str())
        .map_err(|message| AppError::UserVisible { message })?;
    let db = lock_db(db)?;
    let tx =
        rusqlite::Transaction::new_unchecked(db.writer(), rusqlite::TransactionBehavior::Immediate)
            .map_err(DomainError::from)?;
    let repo = SqliteMuteKeywordRepository::new(&tx);
    let created = repo.create(&keyword, scope)?;
    maybe_mark_existing_muted_articles_as_read(&tx)?;
    tx.commit()
        .map_err(crate::domain::error::DomainError::from)?;
    Ok(MuteKeywordDto::from(created))
}

#[tauri::command]
pub fn update_mute_keyword(
    state: State<'_, AppState>,
    mute_keyword_id: String,
    scope: String,
) -> Result<MuteKeywordDto, AppError> {
    update_mute_keyword_impl(&state.db, mute_keyword_id, scope)
}

fn update_mute_keyword_impl(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
    mute_keyword_id: String,
    scope: String,
) -> Result<MuteKeywordDto, AppError> {
    let scope = MuteKeywordScope::try_from(scope.as_str())
        .map_err(|message| AppError::UserVisible { message })?;
    let db = lock_db(db)?;
    let tx =
        rusqlite::Transaction::new_unchecked(db.writer(), rusqlite::TransactionBehavior::Immediate)
            .map_err(DomainError::from)?;
    let repo = SqliteMuteKeywordRepository::new(&tx);
    let updated = repo.update_scope(&mute_keyword_id, scope)?;
    maybe_mark_existing_muted_articles_as_read(&tx)?;
    tx.commit()
        .map_err(crate::domain::error::DomainError::from)?;
    Ok(MuteKeywordDto::from(updated))
}

#[tauri::command]
pub fn delete_mute_keyword(
    state: State<'_, AppState>,
    mute_keyword_id: String,
) -> Result<(), AppError> {
    delete_mute_keyword_impl(&state.db, mute_keyword_id)
}

#[tauri::command]
pub fn set_mute_auto_mark_read(state: State<'_, AppState>, enabled: bool) -> Result<(), AppError> {
    set_mute_auto_mark_read_impl(&state.db, enabled)
}

fn delete_mute_keyword_impl(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
    mute_keyword_id: String,
) -> Result<(), AppError> {
    let db = lock_db(db)?;
    let repo = SqliteMuteKeywordRepository::new(db.writer());
    repo.delete(&mute_keyword_id)?;
    Ok(())
}

#[cfg(test)]
mod tests;
