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

    let account_ids = account_ids_with_feeds(conn)?;
    for account_id in account_ids {
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

fn account_ids_with_feeds(conn: &rusqlite::Connection) -> Result<Vec<AccountId>, AppError> {
    let mut stmt = conn
        .prepare("SELECT DISTINCT account_id FROM feeds")
        .map_err(crate::domain::error::DomainError::from)?;
    let account_ids = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(crate::domain::error::DomainError::from)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(crate::domain::error::DomainError::from)?;
    Ok(account_ids.into_iter().map(AccountId).collect())
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
        let account_ids = account_ids_with_feeds(&tx)?;
        for account_id in account_ids {
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
mod tests {
    use super::*;
    use crate::domain::types::FeedId;
    use crate::infra::db::connection::DbManager;
    use crate::infra::db::sqlite_article::SqliteArticleRepository;
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

    fn insert_unread_article(db: &DbManager, feed_id: &FeedId, title: &str) {
        let article_repo = SqliteArticleRepository::new(db.writer());
        let article = crate::domain::article::Article {
            id: crate::domain::types::ArticleId(uuid::Uuid::new_v4().to_string()),
            feed_id: feed_id.clone(),
            remote_id: None,
            title: title.to_string(),
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
            let feed_repo = SqliteFeedRepository::new(guard.writer());
            insert_unread_article(&guard, &feed_id, "Kindle Unlimited campaign");
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

    #[test]
    fn set_mute_auto_mark_read_rolls_back_preference_when_auto_read_fails() {
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
        insert_unread_article(&guard, &feed_id, "Kindle Unlimited campaign");
        guard
            .writer()
            .execute_batch(
                "CREATE TEMP TRIGGER fail_mute_auto_read
                 BEFORE UPDATE OF is_read ON articles
                 WHEN NEW.is_read = 1
                 BEGIN
                   SELECT RAISE(ABORT, 'forced mute auto read failure');
                 END;",
            )
            .unwrap();
        drop(guard);

        let error = set_mute_auto_mark_read_impl(&db, true).unwrap_err();

        assert!(error.to_string().contains("forced mute auto read failure"));
        let guard = db.lock().unwrap();
        let pref_repo = SqlitePreferenceRepository::new(guard.reader());
        assert_eq!(pref_repo.get("mute_auto_mark_read").unwrap(), None);
        let is_read: bool = guard
            .reader()
            .query_row(
                "SELECT is_read FROM articles WHERE feed_id = ?1",
                params![feed_id.0],
                |row| row.get(0),
            )
            .unwrap();
        assert!(!is_read);
    }

    #[test]
    fn create_mute_keyword_does_not_mark_existing_matches_when_preference_is_missing_or_false() {
        let db = test_db();
        let guard = db.lock().unwrap();
        let account_id = insert_test_account(&guard);
        let feed_id = insert_test_feed(&guard, &account_id);
        insert_unread_article(&guard, &feed_id, "Kindle Unlimited campaign");
        drop(guard);

        let created =
            create_mute_keyword_impl(&db, "Kindle Unlimited".to_string(), "title".to_string())
                .unwrap();

        let guard = db.lock().unwrap();
        let is_read_without_preference: bool = guard
            .reader()
            .query_row(
                "SELECT is_read FROM articles WHERE feed_id = ?1",
                params![feed_id.0],
                |row| row.get(0),
            )
            .unwrap();
        assert!(!is_read_without_preference);

        let pref_repo = SqlitePreferenceRepository::new(guard.writer());
        pref_repo.set("mute_auto_mark_read", "false").unwrap();
        drop(guard);

        update_mute_keyword_impl(&db, created.id, "body".to_string()).unwrap();

        let guard = db.lock().unwrap();
        let is_read_with_false_preference: bool = guard
            .reader()
            .query_row(
                "SELECT is_read FROM articles WHERE feed_id = ?1",
                params![feed_id.0],
                |row| row.get(0),
            )
            .unwrap();
        assert!(!is_read_with_false_preference);
    }

    #[test]
    fn create_mute_keyword_rolls_back_rule_when_auto_read_fails() {
        let db = test_db();
        let guard = db.lock().unwrap();
        let account_id = insert_test_account(&guard);
        let feed_id = insert_test_feed(&guard, &account_id);
        let pref_repo = SqlitePreferenceRepository::new(guard.writer());
        pref_repo.set("mute_auto_mark_read", "true").unwrap();
        insert_unread_article(&guard, &feed_id, "Kindle Unlimited campaign");
        guard
            .writer()
            .execute_batch(
                "CREATE TEMP TRIGGER fail_mute_create_auto_read
                 BEFORE UPDATE OF is_read ON articles
                 WHEN NEW.is_read = 1
                 BEGIN
                   SELECT RAISE(ABORT, 'forced mute create auto read failure');
                 END;",
            )
            .unwrap();
        drop(guard);

        let error =
            create_mute_keyword_impl(&db, "Kindle Unlimited".to_string(), "title".to_string())
                .unwrap_err();

        assert!(error
            .to_string()
            .contains("forced mute create auto read failure"));
        let guard = db.lock().unwrap();
        let rules = SqliteMuteKeywordRepository::new(guard.reader())
            .find_all()
            .unwrap();
        assert!(rules.is_empty());
        let is_read: bool = guard
            .reader()
            .query_row(
                "SELECT is_read FROM articles WHERE feed_id = ?1",
                params![feed_id.0],
                |row| row.get(0),
            )
            .unwrap();
        assert!(!is_read);
    }

    #[test]
    fn create_mute_keyword_reports_unique_constraint_as_validation_error() {
        let db = test_db();
        let guard = db.lock().unwrap();
        guard
            .writer()
            .execute(
                "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at)
                 VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))",
                params!["mute-1", "Kindle Unlimited", "title"],
            )
            .unwrap();
        drop(guard);

        let error =
            create_mute_keyword_impl(&db, "  kindle unlimited  ".to_string(), "title".to_string())
                .unwrap_err();

        assert!(error.to_string().contains("Mute keyword already exists"));
    }

    #[test]
    fn update_mute_keyword_rolls_back_scope_when_auto_read_fails() {
        let db = test_db();
        let guard = db.lock().unwrap();
        let account_id = insert_test_account(&guard);
        let feed_id = insert_test_feed(&guard, &account_id);
        let pref_repo = SqlitePreferenceRepository::new(guard.writer());
        pref_repo.set("mute_auto_mark_read", "true").unwrap();
        let created = SqliteMuteKeywordRepository::new(guard.writer())
            .create("Kindle Unlimited", MuteKeywordScope::Body)
            .unwrap();
        insert_unread_article(&guard, &feed_id, "Kindle Unlimited campaign");
        guard
            .writer()
            .execute_batch(
                "CREATE TEMP TRIGGER fail_mute_update_auto_read
                 BEFORE UPDATE OF is_read ON articles
                 WHEN NEW.is_read = 1
                 BEGIN
                   SELECT RAISE(ABORT, 'forced mute update auto read failure');
                 END;",
            )
            .unwrap();
        drop(guard);

        let error =
            update_mute_keyword_impl(&db, created.id.clone(), "title".to_string()).unwrap_err();

        assert!(error
            .to_string()
            .contains("forced mute update auto read failure"));
        let guard = db.lock().unwrap();
        let rule = SqliteMuteKeywordRepository::new(guard.reader())
            .find_all()
            .unwrap()
            .into_iter()
            .find(|rule| rule.id == created.id)
            .unwrap();
        assert_eq!(rule.scope, MuteKeywordScope::Body);
        let is_read: bool = guard
            .reader()
            .query_row(
                "SELECT is_read FROM articles WHERE feed_id = ?1",
                params![feed_id.0],
                |row| row.get(0),
            )
            .unwrap();
        assert!(!is_read);
    }

    #[test]
    fn account_ids_with_feeds_returns_each_account_once() {
        let db = test_db();
        let guard = db.lock().unwrap();
        let account_id = insert_test_account(&guard);
        insert_test_feed(&guard, &account_id);
        insert_test_feed(&guard, &account_id);

        let account_ids = account_ids_with_feeds(guard.reader()).unwrap();

        assert_eq!(account_ids, vec![account_id]);
    }

    #[test]
    fn delete_missing_mute_keyword_is_successful_noop() {
        let db = test_db();

        delete_mute_keyword_impl(&db, "missing-mute-keyword".to_string()).unwrap();
    }
}
