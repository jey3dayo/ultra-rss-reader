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
                id, account_id, folder_id, title, url, site_url, icon_url, unread_count, reader_mode, web_preview_mode
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 'inherit', 'inherit')
             ON CONFLICT(account_id, url) DO UPDATE SET
               folder_id = excluded.folder_id,
               title = excluded.title,
               site_url = excluded.site_url,
               icon_url = COALESCE(excluded.icon_url, feeds.icon_url)",
            params![
                feed_id.0,
                account_id.0,
                folder_id.as_ref().map(|id| id.0.as_str()),
                feed.title,
                normalized_feed_url,
                feed.site_url,
                feed.icon_url,
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
mod tests;
