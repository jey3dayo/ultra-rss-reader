use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::local_account_sync::{
    generate_local_sync_article_key, normalize_feed_url, LocalAccountSyncProjection,
    LocalSyncAccountId, LocalSyncEntryIdentity, LocalSyncFeedState, LocalSyncFolderState,
    LocalSyncMuteKeywordState,
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

    set_apply_guard(&tx, true)?;
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

    set_apply_guard(&tx, false)?;
    tx.commit()?;
    Ok(report)
}

/// While the guard is active, change-stamp and tombstone triggers stay silent so that import
/// writes are not recorded as local changes. The flag is set and cleared inside the import
/// transaction, so a rollback never leaves it on.
fn set_apply_guard(conn: &Connection, active: bool) -> DomainResult<()> {
    conn.execute(
        "UPDATE local_sync_apply_guard SET active = ?1 WHERE id = 1",
        params![active],
    )?;
    Ok(())
}

fn parse_change_time(
    label: &str,
    changed_at: Option<String>,
) -> DomainResult<Option<DateTime<Utc>>> {
    changed_at
        .map(|value| {
            DateTime::parse_from_rfc3339(&value)
                .map(|parsed| parsed.with_timezone(&Utc))
                .map_err(|error| DomainError::Parse(format!("invalid {label} {value:?}: {error}")))
        })
        .transpose()
}

/// The file value replaces the local one only when it is not older than the local change.
/// A value never changed locally (NULL) always yields to the file.
fn file_wins(local_changed_at: Option<DateTime<Utc>>, file_updated_at: DateTime<Utc>) -> bool {
    local_changed_at.is_none_or(|local| file_updated_at >= local)
}

/// A local deletion newer than the file's value must not be undone by the import.
fn local_removal_is_newer(
    conn: &Connection,
    kind: &str,
    account_id: &str,
    key: &str,
    key2: &str,
    file_updated_at: DateTime<Utc>,
) -> DomainResult<bool> {
    let removed_at: Option<String> = conn
        .query_row(
            "SELECT removed_at FROM local_sync_tombstones
             WHERE kind = ?1 AND account_id = ?2 AND key = ?3 AND key2 = ?4",
            params![kind, account_id, key, key2],
            |row| row.get(0),
        )
        .optional()?;
    let removed_at = parse_change_time("tombstone removed_at", removed_at)?;
    Ok(removed_at.is_some_and(|removed_at| removed_at > file_updated_at))
}

/// Feed tombstones keep the URL as stored, while sync identities drop the fragment and
/// normalize the URL, so tombstones are matched after normalizing them the same way.
fn local_feed_removal_is_newer(
    conn: &Connection,
    account_id: &AccountId,
    normalized_feed_url: &str,
    file_updated_at: DateTime<Utc>,
) -> DomainResult<bool> {
    let mut stmt = conn.prepare(
        "SELECT key, removed_at FROM local_sync_tombstones
         WHERE kind = 'feed' AND account_id = ?1",
    )?;
    let rows = stmt
        .query_map(params![account_id.0], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    for (key, removed_at) in rows {
        if normalize_feed_url(&key).ok().as_deref() != Some(normalized_feed_url) {
            continue;
        }
        let removed_at = parse_change_time("tombstone removed_at", Some(removed_at))?;
        if removed_at.is_some_and(|removed_at| removed_at > file_updated_at) {
            return Ok(true);
        }
    }
    Ok(false)
}

fn upsert_folders(
    conn: &Connection,
    account_id: &AccountId,
    folders: &BTreeMap<String, LocalSyncFolderState>,
    report: &mut LocalAccountSyncApplyReport,
) -> DomainResult<BTreeMap<String, FolderId>> {
    // (account_id, sort_order) is unique, so imported orders are written only after every row
    // is parked on a distinct temporary value.
    let mut requested_order: BTreeMap<String, (i32, String)> = BTreeMap::new();
    let mut local_changed_at: BTreeMap<String, Option<DateTime<Utc>>> = BTreeMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT id, name, sort_order, changed_at FROM folders WHERE account_id = ?1",
        )?;
        let rows = stmt.query_map(params![account_id.0], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i32>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        })?;
        for row in rows {
            let (id, name, sort_order, changed_at) = row?;
            local_changed_at.insert(
                id.clone(),
                parse_change_time("folder changed_at", changed_at)?,
            );
            requested_order.insert(id, (sort_order, name.to_ascii_lowercase()));
        }
    }
    park_folder_sort_orders(conn, account_id)?;

    let mut folder_ids = BTreeMap::new();
    for (normalized_name, folder) in folders {
        let existing_id = find_folder_id_by_normalized_name(conn, account_id, normalized_name)?;
        match &existing_id {
            Some(id) => {
                if !file_wins(
                    local_changed_at.get(&id.0).copied().flatten(),
                    folder.updated_at,
                ) {
                    folder_ids.insert(normalized_name.clone(), id.clone());
                    continue;
                }
            }
            None => {
                if local_removal_is_newer(
                    conn,
                    "folder",
                    &account_id.0,
                    normalized_name,
                    "",
                    folder.updated_at,
                )? {
                    continue;
                }
            }
        }
        let folder_id = existing_id.unwrap_or_else(FolderId::new);
        let parked_sort_order = i32::MIN + i32::try_from(folder_ids.len()).unwrap_or(0);
        conn.execute(
            "INSERT INTO folders (id, account_id, name, sort_order, changed_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               changed_at = excluded.changed_at",
            params![
                folder_id.0,
                account_id.0,
                folder.display_name,
                parked_sort_order,
                format_change_time(folder.updated_at)
            ],
        )?;
        requested_order.insert(
            folder_id.0.clone(),
            (folder.sort_order, folder.display_name.to_ascii_lowercase()),
        );
        folder_ids.insert(normalized_name.clone(), folder_id);
        report.folders_upserted += 1;
    }

    let mut final_order: Vec<_> = requested_order.into_iter().collect();
    final_order.sort_by(
        |(left_id, (left_order, left_name)), (right_id, (right_order, right_name))| {
            left_order
                .cmp(right_order)
                .then_with(|| left_name.cmp(right_name))
                .then_with(|| left_id.cmp(right_id))
        },
    );
    for (sort_order, (folder_id, _)) in final_order.iter().enumerate() {
        conn.execute(
            "UPDATE folders SET sort_order = ?1 WHERE id = ?2",
            params![sort_order as i32, folder_id],
        )?;
    }
    Ok(folder_ids)
}

fn park_folder_sort_orders(conn: &Connection, account_id: &AccountId) -> DomainResult<()> {
    let folder_ids = {
        let mut stmt = conn.prepare("SELECT id FROM folders WHERE account_id = ?1")?;
        let rows = stmt.query_map(params![account_id.0], |row| row.get::<_, String>(0))?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    for (index, folder_id) in folder_ids.iter().enumerate() {
        conn.execute(
            "UPDATE folders SET sort_order = ?1 WHERE id = ?2",
            params![-1 - index as i32, folder_id],
        )?;
    }
    Ok(())
}

fn upsert_feeds(
    conn: &Connection,
    account_id: &AccountId,
    feeds: &BTreeMap<String, LocalSyncFeedState>,
    folder_ids: &BTreeMap<String, FolderId>,
    report: &mut LocalAccountSyncApplyReport,
) -> DomainResult<()> {
    let mut existing_feeds = load_existing_feeds(conn, account_id)?;
    for (normalized_feed_url, feed) in feeds {
        let existing = existing_feeds.remove(normalized_feed_url);
        match &existing {
            Some(existing) => {
                if !file_wins(existing.changed_at, feed.updated_at) {
                    continue;
                }
            }
            None => {
                if local_feed_removal_is_newer(
                    conn,
                    account_id,
                    normalized_feed_url,
                    feed.updated_at,
                )? {
                    continue;
                }
            }
        }
        let resolved_folder_id = feed
            .folder_name
            .as_deref()
            .map(|name| name.trim().to_ascii_lowercase())
            .and_then(|normalized_name| folder_ids.get(&normalized_name).cloned());
        let folder_id = match (&resolved_folder_id, &feed.folder_name, &existing) {
            (None, Some(_), Some(existing)) => existing.folder_id.clone(),
            _ => resolved_folder_id,
        };
        match existing {
            Some(existing) => {
                conn.execute(
                    "UPDATE feeds
                     SET folder_id = ?2,
                         title = ?3,
                         site_url = ?4,
                         icon_url = COALESCE(?5, icon_url),
                         changed_at = ?6
                     WHERE id = ?1",
                    params![
                        existing.id.0,
                        folder_id.as_ref().map(|id| id.0.as_str()),
                        feed.title,
                        feed.site_url,
                        feed.icon_url,
                        format_change_time(feed.updated_at),
                    ],
                )?;
            }
            None => {
                conn.execute(
                    "INSERT INTO feeds (
                        id, account_id, folder_id, title, url, site_url, icon_url, unread_count, reader_mode, web_preview_mode, changed_at
                     )
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 'inherit', 'inherit', ?8)",
                    params![
                        FeedId::new().0,
                        account_id.0,
                        folder_id.as_ref().map(|id| id.0.as_str()),
                        feed.title,
                        normalized_feed_url,
                        feed.site_url,
                        feed.icon_url,
                        format_change_time(feed.updated_at),
                    ],
                )?;
            }
        }
        report.feeds_upserted += 1;
    }
    Ok(())
}

struct ExistingFeed {
    id: FeedId,
    folder_id: Option<FolderId>,
    changed_at: Option<DateTime<Utc>>,
}

/// Local feeds keyed by their sync identity. A stored URL may still carry a fragment, so the
/// key is the normalized URL; when several rows share one identity the lowest id wins.
fn load_existing_feeds(
    conn: &Connection,
    account_id: &AccountId,
) -> DomainResult<BTreeMap<String, ExistingFeed>> {
    let mut stmt = conn.prepare(
        "SELECT id, folder_id, url, changed_at
         FROM feeds
         WHERE account_id = ?1
         ORDER BY id ASC",
    )?;
    let rows = stmt
        .query_map(params![account_id.0], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let mut existing_feeds = BTreeMap::new();
    for (id, folder_id, url, changed_at) in rows {
        let Ok(normalized_url) = normalize_feed_url(&url) else {
            continue;
        };
        existing_feeds
            .entry(normalized_url)
            .or_insert(ExistingFeed {
                id: FeedId(id),
                folder_id: folder_id.map(FolderId),
                changed_at: parse_change_time("feed changed_at", changed_at)?,
            });
    }
    Ok(existing_feeds)
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
        let existing = find_tag_by_normalized_name(conn, normalized_name)?;
        match &existing {
            Some((_, local_changed_at)) => {
                if !file_wins(*local_changed_at, tag.updated_at) {
                    continue;
                }
            }
            None => {
                if local_removal_is_newer(conn, "tag", "", normalized_name, "", tag.updated_at)? {
                    continue;
                }
            }
        }
        let tag_id = existing.map(|(id, _)| id).unwrap_or_else(TagId::new);
        conn.execute(
            "INSERT INTO tags (id, name, changed_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               changed_at = excluded.changed_at",
            params![
                tag_id.0,
                tag.display_name,
                format_change_time(tag.updated_at)
            ],
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
        let existing = find_mute_keyword(conn, normalized_keyword, scope)?;
        match &existing {
            Some((_, local_updated_at)) => {
                if !file_wins(Some(*local_updated_at), rule.updated_at) {
                    continue;
                }
            }
            None => {
                if local_removal_is_newer(
                    conn,
                    "mute_keyword",
                    "",
                    normalized_keyword,
                    scope,
                    rule.updated_at,
                )? {
                    continue;
                }
            }
        }
        let id = existing
            .map(|(id, _)| id)
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
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
    tombstones: &BTreeMap<(String, String), DateTime<Utc>>,
    report: &mut LocalAccountSyncApplyReport,
) -> DomainResult<()> {
    for ((normalized_keyword, scope), removed_at) in tombstones {
        let Some((id, local_updated_at)) = find_mute_keyword(conn, normalized_keyword, scope)?
        else {
            continue;
        };
        if local_updated_at > *removed_at {
            continue;
        }
        report.mute_keywords_removed +=
            conn.execute("DELETE FROM mute_keywords WHERE id = ?1", params![id])?;
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
        if let (Some(is_read), Some(read_updated_at)) = (state.is_read, state.read_updated_at) {
            if is_newer_than_local_change(
                conn,
                &target.article_id,
                "read_changed_at",
                read_updated_at,
            )? {
                conn.execute(
                    "UPDATE articles SET is_read = ?1, read_changed_at = ?2 WHERE id = ?3",
                    params![
                        is_read,
                        format_change_time(read_updated_at),
                        target.article_id.0
                    ],
                )?;
                feed_ids_to_recalculate.insert(target.feed_id.0.clone());
                report.article_states_applied += 1;
            }
        }
        if let (Some(is_starred), Some(starred_updated_at)) =
            (state.is_starred, state.starred_updated_at)
        {
            if is_newer_than_local_change(
                conn,
                &target.article_id,
                "starred_changed_at",
                starred_updated_at,
            )? {
                conn.execute(
                    "UPDATE articles SET is_starred = ?1, starred_changed_at = ?2 WHERE id = ?3",
                    params![
                        is_starred,
                        format_change_time(starred_updated_at),
                        target.article_id.0
                    ],
                )?;
                report.article_states_applied += 1;
            }
        }
    }
    Ok(feed_ids_to_recalculate)
}

/// The file value replaces the local one only when it is not older than the local change.
/// A state never changed locally (NULL) always yields to the file.
fn is_newer_than_local_change(
    conn: &Connection,
    article_id: &ArticleId,
    changed_at_column: &str,
    file_updated_at: DateTime<Utc>,
) -> DomainResult<bool> {
    let local_changed_at: Option<String> = conn.query_row(
        &format!("SELECT {changed_at_column} FROM articles WHERE id = ?1"),
        params![article_id.0],
        |row| row.get(0),
    )?;
    let Some(local_changed_at) = local_changed_at else {
        return Ok(true);
    };
    let local_changed_at = DateTime::parse_from_rfc3339(&local_changed_at).map_err(|error| {
        DomainError::Parse(format!(
            "invalid {changed_at_column} {local_changed_at:?}: {error}"
        ))
    })?;
    Ok(file_updated_at >= local_changed_at)
}

fn format_change_time(time: DateTime<Utc>) -> String {
    time.to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn apply_article_tags(
    conn: &Connection,
    article_ids: &BTreeMap<String, LocalSyncArticleTarget>,
    projection: &LocalAccountSyncProjection,
    report: &mut LocalAccountSyncApplyReport,
) -> DomainResult<()> {
    for (key, normalized_tag_name) in &projection.article_tags {
        let Some(article_id) = article_ids.get(&key.0) else {
            report.unmatched_article_keys += 1;
            continue;
        };
        let Some((tag_id, _)) = find_tag_by_normalized_name(conn, normalized_tag_name)? else {
            continue;
        };
        let added_at = projection
            .article_tag_added_at
            .get(&(key.clone(), normalized_tag_name.clone()))
            .copied()
            .unwrap_or(DateTime::UNIX_EPOCH);
        if local_removal_is_newer(
            conn,
            "article_tag",
            "",
            &article_id.article_id.0,
            normalized_tag_name,
            added_at,
        )? {
            continue;
        }
        let inserted = conn.execute(
            "INSERT OR IGNORE INTO article_tags (article_id, tag_id, changed_at)
             VALUES (?1, ?2, ?3)",
            params![
                article_id.article_id.0,
                tag_id.0,
                format_change_time(added_at)
            ],
        )?;
        report.article_tags_added += inserted;
        if inserted == 0 {
            refresh_article_tag_change_time(conn, &article_id.article_id.0, &tag_id.0, added_at)?;
        }
    }
    for ((key, normalized_tag_name), removed_at) in &projection.article_tag_tombstones {
        let Some(article_id) = article_ids.get(&key.0) else {
            report.unmatched_article_keys += 1;
            continue;
        };
        let Some((tag_id, _)) = find_tag_by_normalized_name(conn, normalized_tag_name)? else {
            continue;
        };
        if article_tag_changed_at(conn, &article_id.article_id.0, &tag_id.0)?
            .is_some_and(|added_at| added_at > *removed_at)
        {
            continue;
        }
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

fn article_tag_changed_at(
    conn: &Connection,
    article_id: &str,
    tag_id: &str,
) -> DomainResult<Option<DateTime<Utc>>> {
    let changed_at: Option<String> = conn
        .query_row(
            "SELECT changed_at FROM article_tags WHERE article_id = ?1 AND tag_id = ?2",
            params![article_id, tag_id],
            |row| row.get(0),
        )
        .optional()?
        .flatten();
    parse_change_time("article tag changed_at", changed_at)
}

fn refresh_article_tag_change_time(
    conn: &Connection,
    article_id: &str,
    tag_id: &str,
    added_at: DateTime<Utc>,
) -> DomainResult<()> {
    if article_tag_changed_at(conn, article_id, tag_id)?.is_some_and(|local| local >= added_at) {
        return Ok(());
    }
    conn.execute(
        "UPDATE article_tags SET changed_at = ?3 WHERE article_id = ?1 AND tag_id = ?2",
        params![article_id, tag_id, format_change_time(added_at)],
    )?;
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

fn find_tag_by_normalized_name(
    conn: &Connection,
    normalized_name: &str,
) -> DomainResult<Option<(TagId, Option<DateTime<Utc>>)>> {
    let row = conn
        .query_row(
            "SELECT id, changed_at
             FROM tags
             WHERE lower(trim(name)) = ?1
             ORDER BY id ASC
             LIMIT 1",
            params![normalized_name],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .optional()?;
    row.map(|(id, changed_at)| Ok((TagId(id), parse_change_time("tag changed_at", changed_at)?)))
        .transpose()
}

fn find_mute_keyword(
    conn: &Connection,
    normalized_keyword: &str,
    scope: &str,
) -> DomainResult<Option<(String, DateTime<Utc>)>> {
    let row = conn
        .query_row(
            "SELECT id, updated_at
             FROM mute_keywords
             WHERE lower(trim(keyword)) = ?1
               AND scope = ?2
             ORDER BY id ASC
             LIMIT 1",
            params![normalized_keyword, scope],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()?;
    row.map(|(id, updated_at)| {
        let updated_at = parse_change_time("mute keyword updated_at", Some(updated_at))?
            .unwrap_or(DateTime::UNIX_EPOCH);
        Ok((id, updated_at))
    })
    .transpose()
}

#[cfg(test)]
mod tests;
