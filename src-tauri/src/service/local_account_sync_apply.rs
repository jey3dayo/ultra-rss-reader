use std::collections::{BTreeMap, BTreeSet};

use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};

use crate::domain::error::DomainResult;
use crate::domain::local_account_sync::{
    generate_local_sync_article_key, LocalAccountSyncProjection, LocalSyncAccountId,
    LocalSyncEntryIdentity, LocalSyncFeedState, LocalSyncFolderState, LocalSyncMuteKeywordState,
};
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId, TagId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_feed::recalculate_unread_count_with_conn;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct LocalAccountSyncApplyReport {
    pub folders_upserted: usize,
    pub feeds_upserted: usize,
    pub article_states_applied: usize,
    pub tags_upserted: usize,
    pub article_tags_added: usize,
    pub article_tags_removed: usize,
    pub mute_keywords_upserted: usize,
    pub mute_keywords_removed: usize,
    pub unmatched_article_keys: usize,
    pub skipped_removed_tags: usize,
    pub conflict_count: usize,
}

pub fn apply_local_account_sync_projection(
    db: &DbManager,
    account_id: &AccountId,
    sync_account_id: &LocalSyncAccountId,
    projection: &LocalAccountSyncProjection,
) -> DomainResult<LocalAccountSyncApplyReport> {
    let conn = db.writer();
    let tx = rusqlite::Transaction::new_unchecked(conn, TransactionBehavior::Immediate)?;
    let mut report = LocalAccountSyncApplyReport {
        conflict_count: projection.feed_folder_conflicts.len(),
        ..LocalAccountSyncApplyReport::default()
    };

    let folder_ids = upsert_folders(&tx, account_id, &projection.folders, &mut report)?;
    upsert_feeds(&tx, account_id, &projection.feeds, &folder_ids, &mut report)?;
    upsert_tags(&tx, &projection.tags, &mut report)?;
    apply_mute_keywords(&tx, &projection.mute_keywords, &mut report)?;
    remove_mute_keywords(&tx, &projection.mute_keyword_tombstones, &mut report)?;

    let article_ids = resolve_article_sync_keys(&tx, account_id, sync_account_id)?;
    let feed_ids_to_recalculate = apply_article_states(&tx, &article_ids, projection, &mut report)?;
    apply_article_tags(&tx, &article_ids, projection, &mut report)?;
    for feed_id in feed_ids_to_recalculate {
        recalculate_unread_count_with_conn(&tx, &FeedId(feed_id))?;
    }

    tx.commit()?;
    Ok(report)
}

fn upsert_folders(
    conn: &Connection,
    account_id: &AccountId,
    folders: &BTreeMap<String, LocalSyncFolderState>,
    report: &mut LocalAccountSyncApplyReport,
) -> DomainResult<BTreeMap<String, FolderId>> {
    let mut folder_ids = BTreeMap::new();
    for (normalized_name, folder) in folders {
        let folder_id = find_folder_id_by_normalized_name(conn, account_id, normalized_name)?
            .unwrap_or_else(FolderId::new);
        conn.execute(
            "INSERT INTO folders (id, account_id, name, sort_order)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               sort_order = excluded.sort_order",
            params![
                folder_id.0,
                account_id.0,
                folder.display_name,
                folder.sort_order
            ],
        )?;
        folder_ids.insert(normalized_name.clone(), folder_id);
        report.folders_upserted += 1;
    }
    Ok(folder_ids)
}

fn upsert_feeds(
    conn: &Connection,
    account_id: &AccountId,
    feeds: &BTreeMap<String, LocalSyncFeedState>,
    folder_ids: &BTreeMap<String, FolderId>,
    report: &mut LocalAccountSyncApplyReport,
) -> DomainResult<()> {
    for (normalized_feed_url, feed) in feeds {
        let feed_id =
            find_feed_id_by_url(conn, account_id, normalized_feed_url)?.unwrap_or_else(FeedId::new);
        let folder_id = feed
            .folder_name
            .as_deref()
            .map(|name| name.trim().to_ascii_lowercase())
            .and_then(|normalized_name| folder_ids.get(&normalized_name).cloned());
        conn.execute(
            "INSERT INTO feeds (
                id, account_id, folder_id, title, url, site_url, unread_count, reader_mode, web_preview_mode
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 'inherit', 'inherit')
             ON CONFLICT(account_id, url) DO UPDATE SET
               folder_id = excluded.folder_id,
               title = excluded.title,
               site_url = excluded.site_url",
            params![
                feed_id.0,
                account_id.0,
                folder_id.as_ref().map(|id| id.0.as_str()),
                feed.title,
                normalized_feed_url,
                feed.site_url,
            ],
        )?;
        report.feeds_upserted += 1;
    }
    Ok(())
}

fn upsert_tags(
    conn: &Connection,
    tags: &BTreeMap<String, crate::domain::local_account_sync::LocalSyncTagState>,
    report: &mut LocalAccountSyncApplyReport,
) -> DomainResult<()> {
    for (normalized_name, tag) in tags {
        if tag.removed_at.is_some() {
            report.skipped_removed_tags += 1;
            continue;
        }
        let tag_id =
            find_tag_id_by_normalized_name(conn, normalized_name)?.unwrap_or_else(TagId::new);
        conn.execute(
            "INSERT INTO tags (id, name)
             VALUES (?1, ?2)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name",
            params![tag_id.0, tag.display_name],
        )?;
        report.tags_upserted += 1;
    }
    Ok(())
}

fn apply_mute_keywords(
    conn: &Connection,
    mute_keywords: &BTreeMap<(String, String), LocalSyncMuteKeywordState>,
    report: &mut LocalAccountSyncApplyReport,
) -> DomainResult<()> {
    for ((normalized_keyword, scope), rule) in mute_keywords {
        let existing_id = find_mute_keyword_id(conn, normalized_keyword, scope)?;
        let id = existing_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        conn.execute(
            "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?4)
             ON CONFLICT(id) DO UPDATE SET
               keyword = excluded.keyword,
               scope = excluded.scope,
               updated_at = excluded.updated_at",
            params![id, rule.keyword, rule.scope, rule.updated_at.to_rfc3339()],
        )?;
        report.mute_keywords_upserted += 1;
    }
    Ok(())
}

fn remove_mute_keywords(
    conn: &Connection,
    tombstones: &BTreeMap<(String, String), chrono::DateTime<chrono::Utc>>,
    report: &mut LocalAccountSyncApplyReport,
) -> DomainResult<()> {
    for (normalized_keyword, scope) in tombstones.keys() {
        let deleted = conn.execute(
            "DELETE FROM mute_keywords
             WHERE lower(trim(keyword)) = ?1
               AND scope = ?2",
            params![normalized_keyword, scope],
        )?;
        report.mute_keywords_removed += deleted;
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct LocalSyncArticleTarget {
    article_id: ArticleId,
    feed_id: FeedId,
}

fn resolve_article_sync_keys(
    conn: &Connection,
    account_id: &AccountId,
    sync_account_id: &LocalSyncAccountId,
) -> DomainResult<BTreeMap<String, LocalSyncArticleTarget>> {
    let mut stmt = conn.prepare(
        "SELECT a.id, f.id, f.url, a.remote_id, a.url, a.title
         FROM articles a
         JOIN feeds f ON f.id = a.feed_id
         WHERE f.account_id = ?1
         ORDER BY a.id ASC",
    )?;
    let rows = stmt
        .query_map(params![account_id.0], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let mut article_ids = BTreeMap::new();
    for (article_id, feed_id, feed_url, remote_id, url, title) in rows {
        let key = generate_local_sync_article_key(
            sync_account_id,
            &feed_url,
            LocalSyncEntryIdentity {
                guid: remote_id,
                url,
                title,
            },
        )?;
        article_ids.insert(
            key.key.0,
            LocalSyncArticleTarget {
                article_id: ArticleId(article_id),
                feed_id: FeedId(feed_id),
            },
        );
    }
    Ok(article_ids)
}

fn apply_article_states(
    conn: &Connection,
    article_ids: &BTreeMap<String, LocalSyncArticleTarget>,
    projection: &LocalAccountSyncProjection,
    report: &mut LocalAccountSyncApplyReport,
) -> DomainResult<BTreeSet<String>> {
    let mut feed_ids_to_recalculate = BTreeSet::new();
    for (article_key, state) in &projection.articles {
        let Some(target) = article_ids.get(&article_key.0) else {
            report.unmatched_article_keys += 1;
            continue;
        };
        if let Some(is_read) = state.is_read {
            conn.execute(
                "UPDATE articles SET is_read = ?1 WHERE id = ?2",
                params![is_read, target.article_id.0],
            )?;
            feed_ids_to_recalculate.insert(target.feed_id.0.clone());
            report.article_states_applied += 1;
        }
        if let Some(is_starred) = state.is_starred {
            conn.execute(
                "UPDATE articles SET is_starred = ?1 WHERE id = ?2",
                params![is_starred, target.article_id.0],
            )?;
            report.article_states_applied += 1;
        }
    }
    Ok(feed_ids_to_recalculate)
}

fn apply_article_tags(
    conn: &Connection,
    article_ids: &BTreeMap<String, LocalSyncArticleTarget>,
    projection: &LocalAccountSyncProjection,
    report: &mut LocalAccountSyncApplyReport,
) -> DomainResult<()> {
    for (article_key, normalized_tag_name) in &projection.article_tags {
        let Some(article_id) = article_ids.get(&article_key.0) else {
            report.unmatched_article_keys += 1;
            continue;
        };
        let Some(tag_id) = find_tag_id_by_normalized_name(conn, normalized_tag_name)? else {
            continue;
        };
        let inserted = conn.execute(
            "INSERT OR IGNORE INTO article_tags (article_id, tag_id)
             VALUES (?1, ?2)",
            params![article_id.article_id.0, tag_id.0],
        )?;
        report.article_tags_added += inserted;
    }
    for (article_key, normalized_tag_name) in projection.article_tag_tombstones.keys() {
        let Some(article_id) = article_ids.get(&article_key.0) else {
            report.unmatched_article_keys += 1;
            continue;
        };
        let Some(tag_id) = find_tag_id_by_normalized_name(conn, normalized_tag_name)? else {
            continue;
        };
        let deleted = conn.execute(
            "DELETE FROM article_tags
             WHERE article_id = ?1
               AND tag_id = ?2",
            params![article_id.article_id.0, tag_id.0],
        )?;
        report.article_tags_removed += deleted;
    }
    Ok(())
}

fn find_folder_id_by_normalized_name(
    conn: &Connection,
    account_id: &AccountId,
    normalized_name: &str,
) -> DomainResult<Option<FolderId>> {
    conn.query_row(
        "SELECT id
         FROM folders
         WHERE account_id = ?1
           AND lower(trim(name)) = ?2
         ORDER BY id ASC
         LIMIT 1",
        params![account_id.0, normalized_name],
        |row| row.get::<_, String>(0).map(FolderId),
    )
    .optional()
    .map_err(Into::into)
}

fn find_feed_id_by_url(
    conn: &Connection,
    account_id: &AccountId,
    feed_url: &str,
) -> DomainResult<Option<FeedId>> {
    conn.query_row(
        "SELECT id
         FROM feeds
         WHERE account_id = ?1
           AND url = ?2
         ORDER BY id ASC
         LIMIT 1",
        params![account_id.0, feed_url],
        |row| row.get::<_, String>(0).map(FeedId),
    )
    .optional()
    .map_err(Into::into)
}

fn find_tag_id_by_normalized_name(
    conn: &Connection,
    normalized_name: &str,
) -> DomainResult<Option<TagId>> {
    conn.query_row(
        "SELECT id
         FROM tags
         WHERE lower(trim(name)) = ?1
         ORDER BY id ASC
         LIMIT 1",
        params![normalized_name],
        |row| row.get::<_, String>(0).map(TagId),
    )
    .optional()
    .map_err(Into::into)
}

fn find_mute_keyword_id(
    conn: &Connection,
    normalized_keyword: &str,
    scope: &str,
) -> DomainResult<Option<String>> {
    conn.query_row(
        "SELECT id
         FROM mute_keywords
         WHERE lower(trim(keyword)) = ?1
           AND scope = ?2
         ORDER BY id ASC
         LIMIT 1",
        params![normalized_keyword, scope],
        |row| row.get(0),
    )
    .optional()
    .map_err(Into::into)
}

#[cfg(test)]
mod tests {
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
            "INSERT INTO feeds (id, account_id, title, url, site_url, reader_mode, web_preview_mode)
             VALUES ('feed-existing', ?1, 'Old Feed', 'https://example.com/feed.xml', '', 'inherit', 'inherit')",
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
        apply_local_account_sync_projection(
            &db,
            &account_id,
            &sync_account_id,
            &mark_read_projection,
        )
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
}
