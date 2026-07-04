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
        "SELECT f.url, f.title, f.site_url, folders.name
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
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for (url, title, site_url, folder_name) in feeds {
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
mod tests {
    use chrono::{DateTime, Utc};

    use crate::domain::local_account_sync::{
        LocalAccountSyncOperation, LocalSyncAccountId, LocalSyncAction, LocalSyncArticleKey,
        LocalSyncDeviceId, LocalSyncEntityKey, LocalSyncOperationId,
    };
    use crate::domain::types::AccountId;
    use crate::infra::db::connection::DbManager;
    use crate::infra::db::sqlite_local_account_sync_settings::SqliteLocalAccountSyncSettingsRepository;
    use crate::infra::local_account_sync_files::write_local_sync_operation_file;
    use crate::repository::local_account_sync_settings::{
        LocalAccountSyncSettings, LocalAccountSyncSettingsRepository,
    };
    use crate::service::local_account_sync::{
        build_current_state_operations, compute_local_account_sync_digest,
        export_local_account_sync_folder, export_local_account_sync_folder_if_changed,
        import_local_account_sync_folder,
    };

    fn ts(seconds: i64) -> DateTime<Utc> {
        DateTime::from_timestamp(seconds, 0).expect("test timestamp should be valid")
    }

    fn operation(id: &str) -> LocalAccountSyncOperation {
        LocalAccountSyncOperation {
            sync_account_id: LocalSyncAccountId("sync-account-a".to_string()),
            operation_id: LocalSyncOperationId(id.to_string()),
            device_id: LocalSyncDeviceId("device-a".to_string()),
            occurred_at: ts(10),
            entity_key: LocalSyncEntityKey::Article {
                article_key: LocalSyncArticleKey("missing".to_string()),
            },
            action: LocalSyncAction::SetRead { is_read: true },
        }
    }

    /// Seeds one folder, one feed, and one article (read + starred) for
    /// `account_id`, matching the shape exercised by the export tests below.
    fn seed_export_fixture(db: &DbManager, account_id: &AccountId) {
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, 'Local', 'Local')",
                [&account_id.0],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order)
                 VALUES ('folder-1', ?1, 'Tech', 1)",
                [&account_id.0],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, folder_id, title, url, site_url, reader_mode, web_preview_mode)
                 VALUES ('feed-1', ?1, 'folder-1', 'Feed', 'https://example.com/feed.xml', 'https://example.com', 'inherit', 'inherit')",
                [&account_id.0],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO articles (
                    id, feed_id, remote_id, title, url, published_at, fetched_at, is_read, is_starred
                 )
                 VALUES ('article-1', 'feed-1', 'guid-1', 'Article', 'https://example.com/a', ?1, ?1, 1, 1)",
                [ts(1).to_rfc3339()],
            )
            .unwrap();
    }

    #[test]
    fn import_reports_rejected_files_without_applying_operations() {
        let db = DbManager::new_in_memory().unwrap();
        let account_id = AccountId("account-1".to_string());
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, 'Local', 'Local')",
                [&account_id.0],
            )
            .unwrap();
        let dir = tempfile::tempdir().unwrap();
        write_local_sync_operation_file(dir.path(), &operation("read-missing"), 1).unwrap();
        let op_dir = dir.path().join("ops").join("device-a");
        std::fs::write(op_dir.join("00000002.json"), "{not-json").unwrap();

        let report = import_local_account_sync_folder(
            &db,
            &account_id,
            &LocalSyncAccountId("sync-account-a".to_string()),
            dir.path(),
        )
        .unwrap();

        assert_eq!(report.loaded_operations, 1);
        assert_eq!(report.rejected_files, 1);
        assert_eq!(report.apply_report.article_states_applied, 0);
        assert_eq!(report.apply_report.unmatched_article_keys, 0);
        assert!(!report.applied);
    }

    #[test]
    fn export_writes_current_local_account_state_as_operation_files() {
        let db = DbManager::new_in_memory().unwrap();
        let account_id = AccountId("account-1".to_string());
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, 'Local', 'Local')",
                [&account_id.0],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order)
                 VALUES ('folder-1', ?1, 'Tech', 1)",
                [&account_id.0],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, folder_id, title, url, site_url, reader_mode, web_preview_mode)
                 VALUES ('feed-1', ?1, 'folder-1', 'Feed', 'https://example.com/feed.xml', 'https://example.com', 'inherit', 'inherit')",
                [&account_id.0],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO articles (
                    id, feed_id, remote_id, title, url, published_at, fetched_at, is_read, is_starred
                 )
                 VALUES ('article-1', 'feed-1', 'guid-1', 'Article', 'https://example.com/a', ?1, ?1, 1, 1)",
                [ts(1).to_rfc3339()],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO tags (id, name) VALUES ('tag-1', 'Read Later')",
                [],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO article_tags (article_id, tag_id) VALUES ('article-1', 'tag-1')",
                [],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at)
                 VALUES ('mute-1', 'Spoiler', 'title', ?1, ?1)",
                [ts(1).to_rfc3339()],
            )
            .unwrap();
        let dir = tempfile::tempdir().unwrap();

        let report = export_local_account_sync_folder(
            &db,
            &account_id,
            &LocalSyncAccountId("sync-account-a".to_string()),
            &LocalSyncDeviceId("device-a".to_string()),
            dir.path(),
        )
        .unwrap();

        assert_eq!(report.operations_written, 7);
        let load_report =
            crate::infra::local_account_sync_files::load_local_sync_operation_dir(dir.path())
                .unwrap();
        assert_eq!(load_report.operations.len(), 7);
        assert!(load_report
            .operations
            .iter()
            .any(|operation| matches!(operation.action, LocalSyncAction::UpsertFeed { .. })));
        assert!(load_report.operations.iter().any(|operation| matches!(
            operation.action,
            LocalSyncAction::SetRead { is_read: true }
        )));
        assert!(load_report.operations.iter().any(|operation| matches!(
            operation.action,
            LocalSyncAction::SetStarred { is_starred: true }
        )));
        assert!(load_report
            .operations
            .iter()
            .any(|operation| matches!(operation.action, LocalSyncAction::AddArticleTag)));

        let second_report = export_local_account_sync_folder(
            &db,
            &account_id,
            &LocalSyncAccountId("sync-account-a".to_string()),
            &LocalSyncDeviceId("device-a".to_string()),
            dir.path(),
        )
        .unwrap();
        let second_load_report =
            crate::infra::local_account_sync_files::load_local_sync_operation_dir(dir.path())
                .unwrap();

        assert_eq!(second_report.operations_written, 7);
        assert_eq!(second_load_report.operations.len(), 14);
    }

    #[test]
    fn compute_digest_is_stable_across_differing_operation_ids_and_timestamps() {
        let operation_a = operation("op-1");
        let operation_b = LocalAccountSyncOperation {
            operation_id: LocalSyncOperationId("op-2".to_string()),
            occurred_at: ts(999),
            ..operation_a.clone()
        };

        assert_eq!(
            compute_local_account_sync_digest(&[operation_a]),
            compute_local_account_sync_digest(&[operation_b])
        );
    }

    #[test]
    fn compute_digest_changes_when_action_changes() {
        let unread = operation("op-1");
        let read = LocalAccountSyncOperation {
            action: LocalSyncAction::SetRead { is_read: false },
            ..unread.clone()
        };

        assert_ne!(
            compute_local_account_sync_digest(&[unread]),
            compute_local_account_sync_digest(&[read])
        );
    }

    #[test]
    fn compute_digest_changes_when_a_feed_is_added() {
        let db = DbManager::new_in_memory().unwrap();
        let account_id = AccountId("account-1".to_string());
        seed_export_fixture(&db, &account_id);

        let before = compute_local_account_sync_digest(
            &build_current_state_operations(
                &db,
                &account_id,
                &LocalSyncAccountId("sync-account-a".to_string()),
                &LocalSyncDeviceId("device-a".to_string()),
            )
            .unwrap(),
        );

        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, folder_id, title, url, site_url, reader_mode, web_preview_mode)
                 VALUES ('feed-2', ?1, NULL, 'Feed Two', 'https://example.com/feed2.xml', 'https://example.com', 'inherit', 'inherit')",
                [&account_id.0],
            )
            .unwrap();

        let after = compute_local_account_sync_digest(
            &build_current_state_operations(
                &db,
                &account_id,
                &LocalSyncAccountId("sync-account-a".to_string()),
                &LocalSyncDeviceId("device-a".to_string()),
            )
            .unwrap(),
        );

        assert_ne!(before, after);
    }

    fn seeded_settings(sync_folder_path: &str, account_id: &AccountId) -> LocalAccountSyncSettings {
        LocalAccountSyncSettings {
            account_id: account_id.clone(),
            sync_folder_path: sync_folder_path.to_string(),
            sync_account_id: LocalSyncAccountId("sync-account-a".to_string()),
            device_id: LocalSyncDeviceId("device-a".to_string()),
            enabled: true,
            last_export_digest: None,
        }
    }

    #[test]
    fn export_if_changed_writes_once_then_skips_when_state_is_unchanged() {
        let db = DbManager::new_in_memory().unwrap();
        let account_id = AccountId("account-1".to_string());
        seed_export_fixture(&db, &account_id);
        let dir = tempfile::tempdir().unwrap();

        let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.writer());
        let settings = seeded_settings(&dir.path().to_string_lossy(), &account_id);
        settings_repo.save(&settings).unwrap();

        let first_report = export_local_account_sync_folder_if_changed(&db, &account_id, &settings)
            .unwrap()
            .expect("first export should write files because there is no prior digest");
        assert_eq!(first_report.operations_written, 4);
        let load_report =
            crate::infra::local_account_sync_files::load_local_sync_operation_dir(dir.path())
                .unwrap();
        assert_eq!(load_report.operations.len(), 4);

        let settings_after_first = settings_repo
            .find_by_account_id(&account_id)
            .unwrap()
            .expect("settings should exist after first export");
        assert!(settings_after_first.last_export_digest.is_some());

        let second_result =
            export_local_account_sync_folder_if_changed(&db, &account_id, &settings_after_first)
                .unwrap();
        assert_eq!(second_result, None);

        let load_report_after_second =
            crate::infra::local_account_sync_files::load_local_sync_operation_dir(dir.path())
                .unwrap();
        assert_eq!(load_report_after_second.operations.len(), 4);
    }

    #[test]
    fn export_if_changed_writes_again_and_updates_digest_after_state_changes() {
        let db = DbManager::new_in_memory().unwrap();
        let account_id = AccountId("account-1".to_string());
        seed_export_fixture(&db, &account_id);
        let dir = tempfile::tempdir().unwrap();

        let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.writer());
        let settings = seeded_settings(&dir.path().to_string_lossy(), &account_id);
        settings_repo.save(&settings).unwrap();

        export_local_account_sync_folder_if_changed(&db, &account_id, &settings)
            .unwrap()
            .expect("first export should write files because there is no prior digest");
        let settings_after_first = settings_repo
            .find_by_account_id(&account_id)
            .unwrap()
            .expect("settings should exist after first export");

        db.writer()
            .execute("UPDATE articles SET is_read = 0 WHERE id = 'article-1'", [])
            .unwrap();

        let second_report =
            export_local_account_sync_folder_if_changed(&db, &account_id, &settings_after_first)
                .unwrap()
                .expect("changed state should trigger another export");
        assert_eq!(second_report.operations_written, 4);

        let load_report =
            crate::infra::local_account_sync_files::load_local_sync_operation_dir(dir.path())
                .unwrap();
        assert_eq!(load_report.operations.len(), 8);

        let settings_after_second = settings_repo
            .find_by_account_id(&account_id)
            .unwrap()
            .expect("settings should exist after second export");
        assert_ne!(
            settings_after_second.last_export_digest,
            settings_after_first.last_export_digest
        );
    }
}
