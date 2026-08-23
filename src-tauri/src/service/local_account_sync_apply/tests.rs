use chrono::{DateTime, Utc};
use rusqlite::params;

use super::*;
use crate::domain::local_account_sync::{
    merge_local_account_sync_operations, normalize_feed_url, normalize_mute_keyword,
    normalize_tag_name, LocalSyncAction, LocalSyncArticleKey, LocalSyncDeviceId,
    LocalSyncEntityKey, LocalSyncOperationId,
};
use crate::infra::db::connection::DbManager;

fn ts(seconds: i64) -> DateTime<Utc> {
    DateTime::from_timestamp(seconds, 0).expect("test timestamp should be valid")
}

fn seed_account(conn: &Connection, account_id: &AccountId) {
    conn.execute(
        "INSERT INTO accounts (id, kind, name) VALUES (?1, 'Local', 'Local')",
        params![account_id.0],
    )
    .unwrap();
}

fn operation(
    id: &str,
    sync_account_id: &LocalSyncAccountId,
    entity_key: LocalSyncEntityKey,
    action: LocalSyncAction,
) -> crate::domain::local_account_sync::LocalAccountSyncOperation {
    crate::domain::local_account_sync::LocalAccountSyncOperation {
        sync_account_id: sync_account_id.clone(),
        device_id: LocalSyncDeviceId("device-a".to_string()),
        operation_id: LocalSyncOperationId(id.to_string()),
        occurred_at: ts(10),
        entity_key,
        action,
    }
}

#[test]
fn applies_feed_folder_tag_mute_keyword_and_article_state_projection() {
    let db = DbManager::new_in_memory().unwrap();
    let conn = db.writer();
    let account_id = AccountId("local-account".to_string());
    let sync_account_id = LocalSyncAccountId("sync-account".to_string());
    seed_account(conn, &account_id);
    conn.execute(
        "INSERT INTO feeds (id, account_id, title, url, site_url, icon_url, reader_mode, web_preview_mode)
         VALUES ('feed-existing', ?1, 'Old Feed', 'https://example.com/feed.xml', '', NULL, 'inherit', 'inherit')",
        params![account_id.0],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO articles (
            id, feed_id, remote_id, title, published_at, fetched_at, is_read, is_starred
         )
         VALUES ('article-existing', 'feed-existing', 'guid-1', 'Article', ?1, ?1, 0, 0)",
        params![ts(1).to_rfc3339()],
    )
    .unwrap();
    let article_key = crate::domain::local_account_sync::generate_local_sync_article_key(
        &sync_account_id,
        "https://example.com/feed.xml",
        crate::domain::local_account_sync::LocalSyncEntryIdentity {
            guid: Some("guid-1".to_string()),
            url: None,
            title: None,
        },
    )
    .unwrap()
    .key;
    let feed_url = normalize_feed_url("https://example.com/new.xml").unwrap();
    let folder_name = normalize_tag_name(" Tech ").unwrap();
    let tag_name = normalize_tag_name(" Read Later ").unwrap();
    let keyword = normalize_mute_keyword(" Spoiler ").unwrap();
    let projection = merge_local_account_sync_operations([
        operation(
            "folder",
            &sync_account_id,
            LocalSyncEntityKey::Folder {
                normalized_name: folder_name.clone(),
            },
            LocalSyncAction::UpsertFolder {
                display_name: "Tech".to_string(),
                sort_order: 1,
            },
        ),
        operation(
            "feed",
            &sync_account_id,
            LocalSyncEntityKey::Feed {
                normalized_feed_url: feed_url.clone(),
            },
            LocalSyncAction::UpsertFeed {
                title: "New Feed".to_string(),
                site_url: "https://example.com".to_string(),
                icon_url: Some("https://example.com/icon.png".to_string()),
                folder_name: Some("Tech".to_string()),
            },
        ),
        operation(
            "read",
            &sync_account_id,
            LocalSyncEntityKey::Article {
                article_key: article_key.clone(),
            },
            LocalSyncAction::SetRead { is_read: true },
        ),
        operation(
            "star",
            &sync_account_id,
            LocalSyncEntityKey::Article {
                article_key: article_key.clone(),
            },
            LocalSyncAction::SetStarred { is_starred: true },
        ),
        operation(
            "tag",
            &sync_account_id,
            LocalSyncEntityKey::Tag {
                normalized_name: tag_name.clone(),
            },
            LocalSyncAction::AddTag {
                display_name: "Read Later".to_string(),
            },
        ),
        operation(
            "article-tag",
            &sync_account_id,
            LocalSyncEntityKey::ArticleTag {
                article_key: article_key.clone(),
                normalized_tag_name: tag_name.clone(),
            },
            LocalSyncAction::AddArticleTag,
        ),
        operation(
            "mute",
            &sync_account_id,
            LocalSyncEntityKey::MuteKeyword {
                normalized_keyword: keyword.clone(),
                scope: "title".to_string(),
            },
            LocalSyncAction::UpsertMuteKeyword,
        ),
    ])
    .projection;

    let report =
        apply_local_account_sync_projection(&db, &account_id, &sync_account_id, &projection)
            .unwrap();

    assert_eq!(report.folders_upserted, 1);
    assert_eq!(report.feeds_upserted, 1);
    assert_eq!(report.article_states_applied, 2);
    assert_eq!(report.tags_upserted, 1);
    assert_eq!(report.article_tags_added, 1);
    assert_eq!(report.mute_keywords_upserted, 1);
    let article_state: (i64, i64) = conn
        .query_row(
            "SELECT is_read, is_starred FROM articles WHERE id = 'article-existing'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(article_state, (1, 1));
    let feed_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM feeds WHERE account_id = ?1 AND url = ?2",
            params![account_id.0, feed_url],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(feed_count, 1);
    let icon_url: Option<String> = conn
        .query_row(
            "SELECT icon_url FROM feeds WHERE account_id = ?1 AND url = ?2",
            params![account_id.0, feed_url],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(icon_url.as_deref(), Some("https://example.com/icon.png"));
    let article_tag_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM article_tags", [], |row| row.get(0))
        .unwrap();
    assert_eq!(article_tag_count, 1);
    let mute_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM mute_keywords", [], |row| row.get(0))
        .unwrap();
    assert_eq!(mute_count, 1);
}

#[test]
fn apply_preserves_existing_feed_icon_when_legacy_operation_omits_icon_url() {
    let db = DbManager::new_in_memory().unwrap();
    let conn = db.writer();
    let account_id = AccountId("local-account".to_string());
    let sync_account_id = LocalSyncAccountId("sync-account".to_string());
    seed_account(conn, &account_id);
    conn.execute(
        "INSERT INTO feeds (id, account_id, title, url, site_url, icon_url, reader_mode, web_preview_mode)
         VALUES ('feed-existing', ?1, 'Old Feed', ?2, '', ?3, 'inherit', 'inherit')",
        params![
            account_id.0,
            "https://example.com/existing.xml",
            "https://example.com/old-icon.png"
        ],
    )
    .unwrap();

    let legacy_operation: crate::domain::local_account_sync::LocalAccountSyncOperation =
        serde_json::from_str(
            r#"
            {
              "sync_account_id": "sync-account",
              "device_id": "device-a",
              "operation_id": "legacy-feed",
              "occurred_at": "1970-01-01T00:00:10Z",
              "entity_key": {
                "kind": "feed",
                "normalized_feed_url": "https://example.com/existing.xml"
              },
              "action": {
                "type": "upsert_feed",
                "title": "Updated Feed",
                "site_url": "https://example.com",
                "folder_name": null
              }
            }
            "#,
        )
        .unwrap();
    let projection = merge_local_account_sync_operations([legacy_operation]).projection;

    apply_local_account_sync_projection(&db, &account_id, &sync_account_id, &projection).unwrap();

    let icon_url: Option<String> = conn
        .query_row(
            "SELECT icon_url FROM feeds WHERE account_id = ?1 AND url = ?2",
            params![account_id.0, "https://example.com/existing.xml"],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        icon_url.as_deref(),
        Some("https://example.com/old-icon.png")
    );
}

#[test]
fn apply_reports_unmatched_article_key_and_does_not_delete_removed_tags() {
    let db = DbManager::new_in_memory().unwrap();
    let conn = db.writer();
    let account_id = AccountId("local-account".to_string());
    let sync_account_id = LocalSyncAccountId("sync-account".to_string());
    seed_account(conn, &account_id);
    conn.execute(
        "INSERT INTO tags (id, name) VALUES ('tag-existing', 'Keep Me')",
        [],
    )
    .unwrap();
    let normalized_name = normalize_tag_name("Keep Me").unwrap();
    let projection = merge_local_account_sync_operations([
        operation(
            "remove-tag",
            &sync_account_id,
            LocalSyncEntityKey::Tag {
                normalized_name: normalized_name.clone(),
            },
            LocalSyncAction::RemoveTag,
        ),
        operation(
            "read-missing",
            &sync_account_id,
            LocalSyncEntityKey::Article {
                article_key: LocalSyncArticleKey("missing".to_string()),
            },
            LocalSyncAction::SetRead { is_read: true },
        ),
    ])
    .projection;

    let report =
        apply_local_account_sync_projection(&db, &account_id, &sync_account_id, &projection)
            .unwrap();

    assert_eq!(report.skipped_removed_tags, 1);
    assert_eq!(report.unmatched_article_keys, 1);
    let tag_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM tags WHERE id = 'tag-existing'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(tag_count, 1);
}

#[test]
fn apply_recalculates_unread_count_after_read_state_changes() {
    let db = DbManager::new_in_memory().unwrap();
    let conn = db.writer();
    let account_id = AccountId("local-account".to_string());
    let sync_account_id = LocalSyncAccountId("sync-account".to_string());
    seed_account(conn, &account_id);
    conn.execute(
        "INSERT INTO feeds (id, account_id, title, url, site_url, unread_count, reader_mode, web_preview_mode)
         VALUES ('feed-existing', ?1, 'Feed', 'https://example.com/feed.xml', '', 1, 'inherit', 'inherit')",
        params![account_id.0],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO articles (
            id, feed_id, remote_id, title, published_at, fetched_at, is_read, is_starred
         )
         VALUES ('article-existing', 'feed-existing', 'guid-1', 'Article', ?1, ?1, 0, 0)",
        params![ts(1).to_rfc3339()],
    )
    .unwrap();
    let article_key = crate::domain::local_account_sync::generate_local_sync_article_key(
        &sync_account_id,
        "https://example.com/feed.xml",
        crate::domain::local_account_sync::LocalSyncEntryIdentity {
            guid: Some("guid-1".to_string()),
            url: None,
            title: None,
        },
    )
    .unwrap()
    .key;

    let mark_read_projection = merge_local_account_sync_operations([operation(
        "read",
        &sync_account_id,
        LocalSyncEntityKey::Article {
            article_key: article_key.clone(),
        },
        LocalSyncAction::SetRead { is_read: true },
    )])
    .projection;
    apply_local_account_sync_projection(&db, &account_id, &sync_account_id, &mark_read_projection)
        .unwrap();
    let unread_count_after_read: i64 = conn
        .query_row(
            "SELECT unread_count FROM feeds WHERE id = 'feed-existing'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(unread_count_after_read, 0);

    let mark_unread_projection = merge_local_account_sync_operations([operation(
        "unread",
        &sync_account_id,
        LocalSyncEntityKey::Article { article_key },
        LocalSyncAction::SetRead { is_read: false },
    )])
    .projection;
    apply_local_account_sync_projection(
        &db,
        &account_id,
        &sync_account_id,
        &mark_unread_projection,
    )
    .unwrap();
    let unread_count_after_unread: i64 = conn
        .query_row(
            "SELECT unread_count FROM feeds WHERE id = 'feed-existing'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(unread_count_after_unread, 1);
}

#[test]
fn apply_rolls_back_when_later_mute_keyword_upsert_violates_constraints() {
    let db = DbManager::new_in_memory().unwrap();
    let conn = db.writer();
    let account_id = AccountId("local-account".to_string());
    let sync_account_id = LocalSyncAccountId("sync-account".to_string());
    seed_account(conn, &account_id);
    conn.execute_batch(
        "CREATE TRIGGER fail_invalid_mute_keyword
         BEFORE INSERT ON mute_keywords
         WHEN NEW.scope = 'invalid'
         BEGIN
           SELECT RAISE(ABORT, 'invalid mute keyword scope');
         END;",
    )
    .unwrap();
    let alpha_name = normalize_tag_name("Alpha").unwrap();
    let keyword = normalize_mute_keyword("Boom").unwrap();
    let projection = merge_local_account_sync_operations([
        operation(
            "folder-alpha",
            &sync_account_id,
            LocalSyncEntityKey::Folder {
                normalized_name: alpha_name.clone(),
            },
            LocalSyncAction::UpsertFolder {
                display_name: "Alpha".to_string(),
                sort_order: 1,
            },
        ),
        operation(
            "mute-invalid",
            &sync_account_id,
            LocalSyncEntityKey::MuteKeyword {
                normalized_keyword: keyword,
                scope: "invalid".to_string(),
            },
            LocalSyncAction::UpsertMuteKeyword,
        ),
    ])
    .projection;

    apply_local_account_sync_projection(&db, &account_id, &sync_account_id, &projection)
        .expect_err("later apply failure should abort the transaction");

    let alpha_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM folders WHERE account_id = ?1 AND lower(trim(name)) = ?2",
            params![account_id.0, alpha_name],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(alpha_count, 0);
}
