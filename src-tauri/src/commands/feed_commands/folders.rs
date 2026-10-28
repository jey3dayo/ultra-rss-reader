use std::sync::{atomic::AtomicBool, Mutex};

use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

use crate::commands::dto::{AppError, FolderDto};
use crate::commands::sync_providers::{GReaderSession, SessionError};
use crate::commands::AppState;
use crate::domain::account::FolderOrderMode;
use crate::domain::error::DomainError;
use crate::domain::feed::Feed;
use crate::domain::provider::ProviderKind;
use crate::domain::types::{AccountId, FeedId, FolderId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_folder::SqliteFolderRepository;
use crate::infra::provider::traits::FeedProvider;
use crate::repository::account::AccountRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;

use super::{
    load_delete_feed_account, load_feed_for_delete, lock_db, normalize_folder_name,
    FOLDER_LOCAL_NAME_UNIQUE_INDEX, FOLDER_NAME_UNIQUE_INDEX, FOLDER_SORT_ORDER_UNIQUE_INDEX,
    UPDATE_FEED_FOLDER_TARGET_VALIDATION_MESSAGE,
};

pub(crate) fn validate_folder_name(
    name: &str,
    existing_names: &[String],
) -> Result<String, AppError> {
    let name = normalize_folder_name(name)?;
    if existing_names
        .iter()
        .any(|existing| existing.eq_ignore_ascii_case(&name))
    {
        return Err(AppError::UserVisible {
            message: format!("Folder name \"{name}\" is already in use"),
        });
    }
    Ok(name.to_string())
}

fn classify_create_folder_persistence_error(error: DomainError, name: &str) -> AppError {
    match &error {
        DomainError::Persistence(message)
            if message.contains(FOLDER_NAME_UNIQUE_INDEX)
                || message.contains(FOLDER_LOCAL_NAME_UNIQUE_INDEX) =>
        {
            AppError::UserVisible {
                message: format!("Folder name \"{name}\" is already in use"),
            }
        }
        DomainError::Persistence(message)
            if message.contains(FOLDER_SORT_ORDER_UNIQUE_INDEX)
                || message.contains("folders.account_id, folders.sort_order") =>
        {
            AppError::UserVisible {
                message: "Folder order changed while creating the folder. Please retry.".into(),
            }
        }
        _ => AppError::from(error),
    }
}

#[tauri::command]
pub fn create_folder(
    state: State<'_, AppState>,
    account_id: String,
    name: String,
) -> Result<FolderDto, AppError> {
    let db = lock_db(&state.db)?;
    create_folder_in_db(&db, account_id, name)
}

pub(crate) fn create_folder_in_db(
    db: &DbManager,
    account_id: String,
    name: String,
) -> Result<FolderDto, AppError> {
    use crate::domain::folder::Folder;

    let account_id = AccountId(account_id);
    let tx = db
        .writer()
        .unchecked_transaction()
        .map_err(|error| DomainError::Persistence(error.to_string()))?;
    let account_repo = SqliteAccountRepository::new(&tx);
    if account_repo.find_by_id(&account_id)?.is_none() {
        return Err(AppError::UserVisible {
            message: "Account not found".into(),
        });
    }

    let folder_repo = SqliteFolderRepository::new(&tx);
    let existing = folder_repo.find_by_account(&account_id)?;
    for (sort_order, folder) in existing.iter().enumerate() {
        let sort_order = i32::try_from(sort_order).map_err(|error| {
            DomainError::Persistence(format!("Folder sort order overflow: {error}"))
        })?;
        if folder.sort_order != sort_order {
            tx.execute(
                "UPDATE folders SET sort_order = ?1 WHERE id = ?2",
                params![sort_order, &folder.id.0],
            )
            .map_err(|error| DomainError::Persistence(error.to_string()))?;
        }
    }
    let name = validate_folder_name(
        &name,
        &existing
            .iter()
            .filter(|folder| folder.remote_id.is_none())
            .map(|folder| folder.name.clone())
            .collect::<Vec<_>>(),
    )?;
    let sort_order = i32::try_from(existing.len()).map_err(|error| {
        DomainError::Persistence(format!("Folder sort order overflow: {error}"))
    })?;

    // NOTE: Local-only folder; remote sync will be handled in a future iteration
    let folder = Folder {
        id: FolderId::new(),
        account_id,
        remote_id: None,
        name,
        sort_order,
    };
    folder_repo
        .save(&folder)
        .map_err(|error| classify_create_folder_persistence_error(error, &folder.name))?;
    tx.commit()
        .map_err(|error| DomainError::Persistence(error.to_string()))?;
    Ok(FolderDto::from(folder))
}

#[tauri::command]
pub async fn update_feed_folder(
    state: State<'_, AppState>,
    feed_id: String,
    folder_id: Option<String>,
) -> Result<(), AppError> {
    update_feed_folder_with_remote_sync_boundary(
        &state.db,
        state.syncing.as_ref(),
        feed_id,
        folder_id,
    )
    .await
}

pub(crate) async fn update_feed_folder_with_remote_sync_boundary(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    feed_id: String,
    folder_id: Option<String>,
) -> Result<(), AppError> {
    let _guard = crate::commands::start_database_maintenance(syncing)?;
    let feed_id_typed = FeedId(feed_id.clone());
    let feed = {
        let db = lock_db(db)?;
        load_feed_for_delete(&db, &feed_id_typed)?
    };
    let account = {
        let db = lock_db(db)?;
        load_delete_feed_account(&db, &feed.account_id)?
    };

    if matches!(account.kind, ProviderKind::FreshRss) {
        if let Some(remote_id) = feed.remote_id.clone() {
            let (add_label, remove_label) = {
                let db = lock_db(db)?;
                resolve_folder_edit_labels(&db, &feed, folder_id.as_deref())?
            };
            if add_label.is_some() || remove_label.is_some() {
                let session = GReaderSession::establish(&account)
                    .await
                    .map_err(SessionError::into_user_visible)?;
                session
                    .provider()
                    .edit_subscription(
                        &remote_id,
                        None,
                        add_label.as_deref(),
                        remove_label.as_deref(),
                    )
                    .await?;
            }
        }
    }

    let db = lock_db(db)?;
    update_feed_folder_in_db(&db, feed_id, folder_id)
}

fn lookup_folder_name(db: &DbManager, folder_id: &str) -> Result<String, AppError> {
    db.reader()
        .query_row(
            "SELECT name FROM folders WHERE id = ?1",
            params![folder_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| AppError::UserVisible {
            message: format!("Failed to resolve folder name: {error}"),
        })?
        .ok_or_else(|| AppError::UserVisible {
            message: "Folder not found".to_string(),
        })
}

fn resolve_folder_edit_labels(
    db: &DbManager,
    feed: &Feed,
    new_folder_id: Option<&str>,
) -> Result<(Option<String>, Option<String>), AppError> {
    validate_update_feed_folder_target(db.reader(), &feed.id.0, new_folder_id)?;

    let add_label = match new_folder_id {
        Some(folder_id) => Some(lookup_folder_name(db, folder_id)?),
        None => None,
    };
    let remove_label = match feed.folder_id.as_ref() {
        Some(old_folder_id) if Some(old_folder_id.0.as_str()) != new_folder_id => {
            Some(lookup_folder_name(db, &old_folder_id.0)?)
        }
        _ => None,
    };
    Ok((add_label, remove_label))
}

pub(crate) fn update_feed_folder_in_db(
    db: &DbManager,
    feed_id: String,
    folder_id: Option<String>,
) -> Result<(), AppError> {
    let tx = db
        .writer()
        .unchecked_transaction()
        .map_err(DomainError::from)?;
    validate_update_feed_folder_target(&tx, &feed_id, folder_id.as_deref())?;
    let repo = SqliteFeedRepository::new(&tx);
    let fid = folder_id.as_ref().map(|id| FolderId(id.clone()));
    if let Err(error) = repo.update_folder(&FeedId(feed_id.clone()), fid.as_ref()) {
        return Err(classify_update_feed_folder_error(
            &tx,
            &feed_id,
            folder_id.as_deref(),
            error,
        ));
    }
    tx.commit().map_err(DomainError::from)?;
    Ok(())
}

pub(crate) fn classify_update_feed_folder_error(
    conn: &Connection,
    feed_id: &str,
    folder_id: Option<&str>,
    error: DomainError,
) -> AppError {
    let is_target_validation_error = matches!(
        &error,
        DomainError::Validation(message)
            if message == UPDATE_FEED_FOLDER_TARGET_VALIDATION_MESSAGE
    );
    if !is_target_validation_error {
        return error.into();
    }

    match validate_update_feed_folder_target(conn, feed_id, folder_id) {
        Ok(()) => error.into(),
        Err(classified_error) => classified_error,
    }
}

fn validate_update_feed_folder_target(
    conn: &Connection,
    feed_id: &str,
    folder_id: Option<&str>,
) -> Result<(), AppError> {
    let feed_repo = SqliteFeedRepository::new(conn);
    let feed = feed_repo
        .find_by_id(&FeedId(feed_id.to_string()))?
        .ok_or_else(|| AppError::UserVisible {
            message: "Feed not found".to_string(),
        })?;

    let Some(folder_id) = folder_id else {
        return Ok(());
    };

    let folder_account_id = conn
        .query_row(
            "SELECT account_id FROM folders WHERE id = ?1",
            params![folder_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| AppError::UserVisible {
            message: format!("Failed to validate target folder: {error}"),
        })?;

    match folder_account_id {
        None => Err(AppError::UserVisible {
            message: "Folder not found".to_string(),
        }),
        Some(folder_account_id) if folder_account_id != feed.account_id.0 => {
            Err(AppError::UserVisible {
                message: "Folder belongs to another account".to_string(),
            })
        }
        Some(_) => Ok(()),
    }
}

fn apply_folder_sort_order_ids(
    tx: &rusqlite::Transaction<'_>,
    account_id: &AccountId,
    ordered_folder_ids: &[String],
) -> Result<(), AppError> {
    if ordered_folder_ids.is_empty() {
        return Ok(());
    }

    let existing_ids = {
        let mut stmt = tx
            .prepare("SELECT id FROM folders WHERE account_id = ?1 ORDER BY sort_order, id")
            .map_err(|error| DomainError::Persistence(error.to_string()))?;
        let rows = stmt
            .query_map(params![account_id.0], |row| row.get::<_, String>(0))
            .map_err(|error| DomainError::Persistence(error.to_string()))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| DomainError::Persistence(error.to_string()))?
    };

    if existing_ids.len() != ordered_folder_ids.len() {
        return Err(AppError::UserVisible {
            message: "Folder list is out of date. Please retry.".into(),
        });
    }

    let existing_set: std::collections::HashSet<&str> =
        existing_ids.iter().map(String::as_str).collect();
    if ordered_folder_ids
        .iter()
        .any(|folder_id| !existing_set.contains(folder_id.as_str()))
    {
        return Err(AppError::UserVisible {
            message: "Folder list is out of date. Please retry.".into(),
        });
    }

    for (index, folder_id) in ordered_folder_ids.iter().enumerate() {
        let temporary_order = -(index as i32 + 1);
        tx.execute(
            "UPDATE folders SET sort_order = ?1 WHERE id = ?2 AND account_id = ?3",
            params![temporary_order, folder_id, account_id.0],
        )
        .map_err(|error| DomainError::Persistence(error.to_string()))?;
    }

    for (sort_order, folder_id) in ordered_folder_ids.iter().enumerate() {
        let sort_order = i32::try_from(sort_order).map_err(|error| {
            DomainError::Persistence(format!("Folder sort order overflow: {error}"))
        })?;
        tx.execute(
            "UPDATE folders SET sort_order = ?1 WHERE id = ?2 AND account_id = ?3",
            params![sort_order, folder_id, account_id.0],
        )
        .map_err(|error| DomainError::Persistence(error.to_string()))?;
    }

    Ok(())
}

pub(crate) fn reorder_folders_in_db(
    db: &DbManager,
    account_id: String,
    ordered_folder_ids: Vec<String>,
) -> Result<Vec<FolderDto>, AppError> {
    let account_id = AccountId(account_id);
    let tx = db
        .writer()
        .unchecked_transaction()
        .map_err(|error| DomainError::Persistence(error.to_string()))?;
    let account_repo = SqliteAccountRepository::new(&tx);
    if account_repo.find_by_id(&account_id)?.is_none() {
        return Err(AppError::UserVisible {
            message: "Account not found".into(),
        });
    }

    apply_folder_sort_order_ids(&tx, &account_id, &ordered_folder_ids)?;
    account_repo.set_folder_order_mode(&account_id, FolderOrderMode::Manual)?;

    tx.commit()
        .map_err(|error| DomainError::Persistence(error.to_string()))?;

    let folder_repo = SqliteFolderRepository::new(db.reader());
    let folders = folder_repo.find_by_account(&account_id)?;
    Ok(folders.into_iter().map(FolderDto::from).collect())
}

pub(crate) fn reset_folder_order_in_db(
    db: &DbManager,
    account_id: String,
    ordered_folder_ids: Vec<String>,
) -> Result<Vec<FolderDto>, AppError> {
    let account_id = AccountId(account_id);
    let tx = db
        .writer()
        .unchecked_transaction()
        .map_err(|error| DomainError::Persistence(error.to_string()))?;
    let account_repo = SqliteAccountRepository::new(&tx);
    if account_repo.find_by_id(&account_id)?.is_none() {
        return Err(AppError::UserVisible {
            message: "Account not found".into(),
        });
    }

    apply_folder_sort_order_ids(&tx, &account_id, &ordered_folder_ids)?;
    account_repo.set_folder_order_mode(&account_id, FolderOrderMode::Name)?;

    tx.commit()
        .map_err(|error| DomainError::Persistence(error.to_string()))?;

    let folder_repo = SqliteFolderRepository::new(db.reader());
    let folders = folder_repo.find_by_account(&account_id)?;
    Ok(folders.into_iter().map(FolderDto::from).collect())
}

#[tauri::command]
pub fn reorder_folders(
    state: State<'_, AppState>,
    account_id: String,
    ordered_folder_ids: Vec<String>,
) -> Result<Vec<FolderDto>, AppError> {
    let db = lock_db(&state.db)?;
    reorder_folders_in_db(&db, account_id, ordered_folder_ids)
}

#[tauri::command]
pub fn reset_folder_order(
    state: State<'_, AppState>,
    account_id: String,
    ordered_folder_ids: Vec<String>,
) -> Result<Vec<FolderDto>, AppError> {
    let db = lock_db(&state.db)?;
    reset_folder_order_in_db(&db, account_id, ordered_folder_ids)
}
