use std::sync::{atomic::AtomicBool, Mutex};
use tauri::State;

use crate::commands::dto::{
    AppError, FeedIntegrityCleanupDto, FeedIntegrityIssueDto, FeedIntegrityReportDto,
};
use crate::commands::AppState;
use crate::commands::{start_database_maintenance, try_lock_db};
use crate::infra::db::sqlite_article::SqliteArticleRepository;

#[tauri::command]
pub fn get_feed_integrity_report(
    state: State<'_, AppState>,
) -> Result<FeedIntegrityReportDto, AppError> {
    get_feed_integrity_report_inner(&state.db, &state.syncing)
}

pub(crate) fn get_feed_integrity_report_inner(
    db: &Mutex<crate::infra::db::connection::DbManager>,
    syncing: &AtomicBool,
) -> Result<FeedIntegrityReportDto, AppError> {
    let _report_guard = start_database_maintenance(syncing)?;
    let db = crate::commands::lock_db(db)?;
    let repo = SqliteArticleRepository::new(db.reader());

    Ok(FeedIntegrityReportDto {
        orphaned_article_count: repo.count_orphaned_articles()?,
        orphaned_feeds: repo
            .list_orphaned_feed_groups()?
            .into_iter()
            .map(|group| FeedIntegrityIssueDto {
                missing_feed_id: group.missing_feed_id,
                article_count: group.article_count,
                latest_article_title: group.latest_article_title,
                latest_article_published_at: group.latest_article_published_at,
            })
            .collect(),
    })
}

#[tauri::command]
pub fn cleanup_feed_integrity_orphans(
    state: State<'_, AppState>,
    dry_run: bool,
    orphaned_article_ids: Option<Vec<String>>,
) -> Result<FeedIntegrityCleanupDto, AppError> {
    cleanup_feed_integrity_orphans_inner(&state.db, &state.syncing, dry_run, orphaned_article_ids)
}

pub(crate) fn cleanup_feed_integrity_orphans_inner(
    db: &Mutex<crate::infra::db::connection::DbManager>,
    syncing: &AtomicBool,
    dry_run: bool,
    orphaned_article_ids: Option<Vec<String>>,
) -> Result<FeedIntegrityCleanupDto, AppError> {
    let _maintenance_guard = start_database_maintenance(syncing)?;
    let db = try_lock_db(db)?;
    let repo = SqliteArticleRepository::new(db.writer());
    let snapshot_article_ids = match (dry_run, orphaned_article_ids) {
        (true, _) => Some(repo.list_orphaned_article_ids()?),
        (false, Some(ids)) => Some(ids),
        (false, None) => None,
    };
    let orphaned_article_count = snapshot_article_ids.as_ref().map_or_else(
        || repo.count_orphaned_articles(),
        |ids| Ok(ids.len() as i64),
    )?;
    let deleted_article_count = match (dry_run, snapshot_article_ids.as_deref()) {
        (true, _) => 0,
        (false, Some(ids)) => repo.delete_orphaned_articles_by_ids(ids)?,
        (false, None) => repo.delete_orphaned_articles()?,
    };
    if deleted_article_count > 0 {
        db.refresh_query_statistics()?;
    }

    Ok(FeedIntegrityCleanupDto {
        dry_run,
        orphaned_article_count,
        deleted_article_count,
        orphaned_article_ids: if dry_run { snapshot_article_ids } else { None },
    })
}
