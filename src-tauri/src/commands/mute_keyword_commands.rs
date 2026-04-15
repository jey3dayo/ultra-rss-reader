use tauri::State;

use crate::commands::dto::{AppError, MuteKeywordDto};
use crate::commands::AppState;
use crate::domain::mute_keyword::MuteKeywordScope;
use crate::infra::db::sqlite_mute_keyword::SqliteMuteKeywordRepository;
use crate::repository::mute_keyword::MuteKeywordRepository;

fn lock_db(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
) -> Result<std::sync::MutexGuard<'_, crate::infra::db::connection::DbManager>, AppError> {
    db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })
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
    let scope = MuteKeywordScope::try_from(scope.as_str())
        .map_err(|message| AppError::UserVisible { message })?;
    let db = lock_db(&state.db)?;
    let repo = SqliteMuteKeywordRepository::new(db.writer());
    let created = repo.create(&keyword, scope)?;
    Ok(MuteKeywordDto::from(created))
}

#[tauri::command]
pub fn update_mute_keyword(
    state: State<'_, AppState>,
    mute_keyword_id: String,
    scope: String,
) -> Result<MuteKeywordDto, AppError> {
    let scope = MuteKeywordScope::try_from(scope.as_str())
        .map_err(|message| AppError::UserVisible { message })?;
    let db = lock_db(&state.db)?;
    let repo = SqliteMuteKeywordRepository::new(db.writer());
    let updated = repo.update_scope(&mute_keyword_id, scope)?;
    Ok(MuteKeywordDto::from(updated))
}

#[tauri::command]
pub fn delete_mute_keyword(
    state: State<'_, AppState>,
    mute_keyword_id: String,
) -> Result<(), AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteMuteKeywordRepository::new(db.writer());
    repo.delete(&mute_keyword_id)?;
    Ok(())
}
