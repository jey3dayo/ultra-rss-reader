use std::path::Path;

use chrono::Utc;
use rusqlite::params;
use sha2::{Digest, Sha256};

use crate::domain::error::DomainResult;
use crate::domain::local_account_sync::{
    generate_local_sync_article_key, merge_local_account_sync_operations, normalize_feed_url,
    normalize_mute_keyword, normalize_tag_name, LocalAccountSyncOperation, LocalSyncAccountId,
    LocalSyncAction, LocalSyncDeviceId, LocalSyncEntityKey, LocalSyncEntryIdentity,
    LocalSyncOperationId,
};
use crate::domain::types::AccountId;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_local_account_sync_settings::SqliteLocalAccountSyncSettingsRepository;
use crate::infra::local_account_sync_files::{
    load_local_sync_operation_dir, next_local_sync_operation_sequence,
    write_local_sync_operation_file,
};
use crate::repository::local_account_sync_settings::{
    LocalAccountSyncSettings, LocalAccountSyncSettingsRepository,
};
use crate::service::local_account_sync_apply::{
    apply_local_account_sync_projection, LocalAccountSyncApplyReport,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalAccountSyncImportReport {
    pub loaded_operations: usize,
    pub applied_operations: usize,
    pub rejected_operations: usize,
    pub rejected_files: usize,
    pub conflicted_candidates: usize,
    pub applied: bool,
    pub apply_report: LocalAccountSyncApplyReport,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalAccountSyncExportReport {
    pub operations_written: usize,
}

pub fn import_local_account_sync_folder(
    db: &DbManager,
    account_id: &AccountId,
    sync_account_id: &LocalSyncAccountId,
    account_root: &Path,
) -> DomainResult<LocalAccountSyncImportReport> {
    let load_report = load_local_sync_operation_dir(account_root)?;
    let merge_result = merge_local_account_sync_operations(load_report.operations);
    let should_apply =
        load_report.rejected_files.is_empty() && load_report.conflicted_candidates.is_empty();
    let apply_report = if should_apply {
        apply_local_account_sync_projection(
            db,
            account_id,
            sync_account_id,
            &merge_result.projection,
        )?
    } else {
        LocalAccountSyncApplyReport::default()
    };

    Ok(LocalAccountSyncImportReport {
        loaded_operations: merge_result.applied_operations + merge_result.rejected_operations.len(),
        applied_operations: merge_result.applied_operations,
        rejected_operations: merge_result.rejected_operations.len(),
        rejected_files: load_report.rejected_files.len(),
        conflicted_candidates: load_report.conflicted_candidates.len(),
        applied: should_apply,
        apply_report,
    })
}

pub fn export_local_account_sync_folder(
    db: &DbManager,
    account_id: &AccountId,
    sync_account_id: &LocalSyncAccountId,
    device_id: &LocalSyncDeviceId,
    account_root: &Path,
) -> DomainResult<LocalAccountSyncExportReport> {
    let operations = build_current_state_operations(db, account_id, sync_account_id, device_id)?;
    write_operation_files(account_root, device_id, &operations)
}

/// Exports the current local-account state only when it differs from the
/// last exported state, so unchanged runs neither rewrite the full operation
/// snapshot nor grow the sync folder file count.
///
/// Returns `Ok(None)` without writing anything when the projected state is
/// unchanged since the last export (per `settings.last_export_digest`).
/// Otherwise writes the operation files exactly like
/// [`export_local_account_sync_folder`] and persists the new digest.
pub fn export_local_account_sync_folder_if_changed(
    db: &DbManager,
    account_id: &AccountId,
    settings: &LocalAccountSyncSettings,
) -> DomainResult<Option<LocalAccountSyncExportReport>> {
    let operations = build_current_state_operations(
        db,
        account_id,
        &settings.sync_account_id,
        &settings.device_id,
    )?;
    let digest = compute_local_account_sync_digest(&operations);
    if settings.last_export_digest.as_deref() == Some(digest.as_str()) {
        return Ok(None);
    }

    let account_root = Path::new(&settings.sync_folder_path);
    let report = write_operation_files(account_root, &settings.device_id, &operations)?;

    // If the files above were written successfully but persisting the digest below
    // fails (e.g. a transient DB error), the next call will not see the new digest
    // and will re-export the same unchanged state once more. This is an accepted
    // tolerance: a redundant export is harmless, while silently dropping the write
    // would not be.
    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.writer());
    settings_repo.save_export_digest(account_id, &digest)?;

    Ok(Some(report))
}

/// Persists `settings.last_export_digest` to match the current local-account
/// state, without writing any operation files.
///
/// Intended to be called right after a manual export
/// ([`export_local_account_sync_folder`]) succeeds, so the digest reflects
/// what was just written and the very next auto-export
/// ([`export_local_account_sync_folder_if_changed`]) does not redundantly
/// rewrite the same full snapshot it just wrote manually.
pub fn save_current_state_export_digest(
    db: &DbManager,
    account_id: &AccountId,
    settings: &LocalAccountSyncSettings,
) -> DomainResult<()> {
    let operations = build_current_state_operations(
        db,
        account_id,
        &settings.sync_account_id,
        &settings.device_id,
    )?;
    let digest = compute_local_account_sync_digest(&operations);
    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.writer());
    settings_repo.save_export_digest(account_id, &digest)?;
    Ok(())
}

/// Writes the given operations as sequential files under `account_root` for
/// `device_id`, starting from the next available sequence number, and
/// returns a report of how many operation files were written.
fn write_operation_files(
    account_root: &Path,
    device_id: &LocalSyncDeviceId,
    operations: &[LocalAccountSyncOperation],
) -> DomainResult<LocalAccountSyncExportReport> {
    let next_sequence = next_local_sync_operation_sequence(account_root, device_id)?;
    for (index, operation) in operations.iter().enumerate() {
        write_local_sync_operation_file(account_root, operation, next_sequence + index as u64)?;
    }
    Ok(LocalAccountSyncExportReport {
        operations_written: operations.len(),
    })
}

/// Computes a deterministic digest over the canonical operation set,
/// excluding `operation_id` and `occurred_at` since both are regenerated on
/// every export and would otherwise make every digest unique.
pub fn compute_local_account_sync_digest(operations: &[LocalAccountSyncOperation]) -> String {
    let mut entries: Vec<String> = operations
        .iter()
        .map(|operation| {
            serde_json::to_string(&(&operation.entity_key, &operation.action))
                .expect("local account sync entity key and action should serialize")
        })
        .collect();
    entries.sort();
    let joined = entries.join("\n");

    let mut hasher = Sha256::new();
    hasher.update(joined.as_bytes());
    hex::encode(hasher.finalize())
}

fn build_current_state_operations(
    db: &DbManager,
    account_id: &AccountId,
    sync_account_id: &LocalSyncAccountId,
    device_id: &LocalSyncDeviceId,
) -> DomainResult<Vec<LocalAccountSyncOperation>> {
    let now = Utc::now();
    let mut operations = Vec::new();
    let conn = db.reader();

    let mut folder_stmt = conn.prepare(
        "SELECT name, sort_order
         FROM folders
         WHERE account_id = ?1
         ORDER BY sort_order ASC, name COLLATE NOCASE ASC, id ASC",
    )?;
    let folders = folder_stmt
        .query_map(params![account_id.0], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for (name, sort_order) in folders {
        operations.push(operation(
            sync_account_id,
            device_id,
            now,
            LocalSyncEntityKey::Folder {
                normalized_name: normalize_tag_name(&name)?,
            },
            LocalSyncAction::UpsertFolder {
                display_name: name,
                sort_order,
            },
        ));
    }

    let mut feed_stmt = conn.prepare(
        "SELECT f.url, f.title, f.site_url, f.icon_url, folders.name
         FROM feeds f
         LEFT JOIN folders ON folders.id = f.folder_id
         WHERE f.account_id = ?1
         ORDER BY f.url ASC, f.id ASC",
    )?;
    let feeds = feed_stmt
        .query_map(params![account_id.0], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for (url, title, site_url, icon_url, folder_name) in feeds {
        operations.push(operation(
            sync_account_id,
            device_id,
            now,
            LocalSyncEntityKey::Feed {
                normalized_feed_url: normalize_feed_url(&url)?,
            },
            LocalSyncAction::UpsertFeed {
                title,
                site_url,
                icon_url,
                folder_name,
            },
        ));
    }

    let mut article_stmt = conn.prepare(
        "SELECT f.url, a.remote_id, a.url, a.title, a.is_read, a.is_starred
         FROM articles a
         JOIN feeds f ON f.id = a.feed_id
         WHERE f.account_id = ?1
         ORDER BY f.url ASC, a.id ASC",
    )?;
    let articles = article_stmt
        .query_map(params![account_id.0], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, bool>(4)?,
                row.get::<_, bool>(5)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for (feed_url, guid, url, title, is_read, is_starred) in articles {
        let article_key = generate_local_sync_article_key(
            sync_account_id,
            &feed_url,
            LocalSyncEntryIdentity { guid, url, title },
        )?
        .key;
        operations.push(operation(
            sync_account_id,
            device_id,
            now,
            LocalSyncEntityKey::Article {
                article_key: article_key.clone(),
            },
            LocalSyncAction::SetRead { is_read },
        ));
        operations.push(operation(
            sync_account_id,
            device_id,
            now,
            LocalSyncEntityKey::Article { article_key },
            LocalSyncAction::SetStarred { is_starred },
        ));
    }

    let mut tag_stmt =
        conn.prepare("SELECT name FROM tags ORDER BY name COLLATE NOCASE ASC, id ASC")?;
    let tags = tag_stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    for name in tags {
        operations.push(operation(
            sync_account_id,
            device_id,
            now,
            LocalSyncEntityKey::Tag {
                normalized_name: normalize_tag_name(&name)?,
            },
            LocalSyncAction::AddTag { display_name: name },
        ));
    }

    let mut article_tag_stmt = conn.prepare(
        "SELECT f.url, a.remote_id, a.url, a.title, t.name
         FROM article_tags at
         JOIN articles a ON a.id = at.article_id
         JOIN feeds f ON f.id = a.feed_id
         JOIN tags t ON t.id = at.tag_id
         WHERE f.account_id = ?1
         ORDER BY f.url ASC, a.id ASC, t.name COLLATE NOCASE ASC",
    )?;
    let article_tags = article_tag_stmt
        .query_map(params![account_id.0], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for (feed_url, guid, url, title, tag_name) in article_tags {
        let article_key = generate_local_sync_article_key(
            sync_account_id,
            &feed_url,
            LocalSyncEntryIdentity { guid, url, title },
        )?
        .key;
        operations.push(operation(
            sync_account_id,
            device_id,
            now,
            LocalSyncEntityKey::ArticleTag {
                article_key,
                normalized_tag_name: normalize_tag_name(&tag_name)?,
            },
            LocalSyncAction::AddArticleTag,
        ));
    }

    let mut mute_stmt = conn.prepare(
        "SELECT keyword, scope
         FROM mute_keywords
         ORDER BY lower(trim(keyword)) ASC, scope ASC, id ASC",
    )?;
    let mute_keywords = mute_stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for (keyword, scope) in mute_keywords {
        operations.push(operation(
            sync_account_id,
            device_id,
            now,
            LocalSyncEntityKey::MuteKeyword {
                normalized_keyword: normalize_mute_keyword(&keyword)?,
                scope,
            },
            LocalSyncAction::UpsertMuteKeyword,
        ));
    }

    Ok(operations)
}

fn operation(
    sync_account_id: &LocalSyncAccountId,
    device_id: &LocalSyncDeviceId,
    occurred_at: chrono::DateTime<Utc>,
    entity_key: LocalSyncEntityKey,
    action: LocalSyncAction,
) -> LocalAccountSyncOperation {
    LocalAccountSyncOperation {
        sync_account_id: sync_account_id.clone(),
        device_id: device_id.clone(),
        operation_id: LocalSyncOperationId::new(),
        occurred_at,
        entity_key,
        action,
    }
}

#[cfg(test)]
mod tests;
