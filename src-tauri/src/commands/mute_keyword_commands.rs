use tauri::State;

use crate::commands::dto::{AppError, MuteKeywordDto};
use crate::commands::AppState;
use crate::domain::mute_keyword::MuteKeywordScope;
use crate::domain::types::AccountId;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_mute_keyword::SqliteMuteKeywordRepository;
use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
use crate::repository::article::ArticleRepository;
use crate::repository::mute_keyword::MuteKeywordRepository;
use crate::repository::preference::PreferenceRepository;

fn lock_db(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
) -> Result<std::sync::MutexGuard<'_, crate::infra::db::connection::DbManager>, AppError> {
    db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })
}

fn maybe_mark_existing_muted_articles_as_read(
    db: &crate::infra::db::connection::DbManager,
) -> Result<(), AppError> {
    let mut stmt = db
        .reader()
        .prepare("SELECT DISTINCT account_id FROM feeds")
        .map_err(crate::domain::error::DomainError::from)?;
    let account_ids = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(crate::domain::error::DomainError::from)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(crate::domain::error::DomainError::from)?;

    let article_repo = SqliteArticleRepository::new(db.writer());
    for account_id in account_ids {
        article_repo.mark_muted_unread_as_read(&AccountId(account_id), None)?;
    }

    Ok(())
}

fn set_mute_auto_mark_read_impl(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
    enabled: bool,
) -> Result<(), AppError> {
    let db = lock_db(db)?;
    let pref_repo = SqlitePreferenceRepository::new(db.writer());
    pref_repo.set(
        "mute_auto_mark_read",
        if enabled { "true" } else { "false" },
    )?;

    if enabled {
        maybe_mark_existing_muted_articles_as_read(&db)?;
    }

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
    let scope = MuteKeywordScope::try_from(scope.as_str())
        .map_err(|message| AppError::UserVisible { message })?;
    let db = lock_db(&state.db)?;
    let repo = SqliteMuteKeywordRepository::new(db.writer());
    let created = repo.create(&keyword, scope)?;
    maybe_mark_existing_muted_articles_as_read(&db)?;
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
    maybe_mark_existing_muted_articles_as_read(&db)?;
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

#[tauri::command]
pub fn set_mute_auto_mark_read(state: State<'_, AppState>, enabled: bool) -> Result<(), AppError> {
    set_mute_auto_mark_read_impl(&state.db, enabled)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::types::FeedId;
    use crate::infra::db::connection::DbManager;
    use crate::infra::db::sqlite_feed::SqliteFeedRepository;
    use crate::repository::article::ArticleRepository;
    use crate::repository::feed::FeedRepository;
    use rusqlite::params;

    fn test_db() -> std::sync::Mutex<DbManager> {
        std::sync::Mutex::new(DbManager::new_in_memory().unwrap())
    }

    fn insert_test_account(db: &DbManager) -> AccountId {
        let id = AccountId::new();
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                params![id.0, "Local", "Test"],
            )
            .unwrap();
        id
    }

    fn insert_test_feed(db: &DbManager, account_id: &AccountId) -> FeedId {
        let id = FeedId::new();
        let url = format!("http://test.com/feed/{}", id.0);
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, remote_id, title, url) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id.0, account_id.0, format!("feed/{url}"), "Test Feed", url],
            )
            .unwrap();
        id
    }

    #[test]
    fn set_mute_auto_mark_read_persists_enabled_state_and_marks_existing_matches() {
        let db = test_db();
        let guard = db.lock().unwrap();
        let account_id = insert_test_account(&guard);
        let feed_id = insert_test_feed(&guard, &account_id);
        guard
            .writer()
            .execute(
                "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at) VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))",
                params![uuid::Uuid::new_v4().to_string(), "Kindle Unlimited", "title"],
            )
            .unwrap();

        {
            let article_repo = SqliteArticleRepository::new(guard.writer());
            let feed_repo = SqliteFeedRepository::new(guard.writer());
            let article = crate::domain::article::Article {
                id: crate::domain::types::ArticleId(uuid::Uuid::new_v4().to_string()),
                feed_id: feed_id.clone(),
                remote_id: None,
                title: "Kindle Unlimited campaign".to_string(),
                content_raw: "raw".to_string(),
                content_sanitized: "sanitized".to_string(),
                sanitizer_version: 1,
                summary: None,
                url: None,
                author: None,
                published_at: chrono::Utc::now(),
                thumbnail: None,
                is_read: false,
                is_starred: false,
                fetched_at: chrono::Utc::now(),
            };
            article_repo.upsert(std::slice::from_ref(&article)).unwrap();
            feed_repo.recalculate_unread_count(&feed_id).unwrap();
        }

        drop(guard);

        set_mute_auto_mark_read_impl(&db, true).unwrap();

        let guard = db.lock().unwrap();
        let pref_repo = SqlitePreferenceRepository::new(guard.reader());
        assert_eq!(
            pref_repo.get("mute_auto_mark_read").unwrap().as_deref(),
            Some("true")
        );

        let is_read: bool = guard
            .reader()
            .query_row(
                "SELECT is_read FROM articles WHERE feed_id = ?1",
                params![feed_id.0],
                |row| row.get(0),
            )
            .unwrap();
        assert!(is_read);
    }
}
