use async_trait::async_trait;
use serde_json::json;

use crate::infra::db::migration::{read_schema_version, LATEST_VERSION};
use crate::infra::db::sqlite_article::SqliteArticleRepository;

use crate::cli::command::{CliCommand, CommandOutput};
use crate::cli::error::CliResult;
use crate::cli::route::{Capability, NetworkAccess, Route};

const CAPABILITIES: &[Capability] = &[Capability::DbRead];

/// Reimplements the size/schema-version read that
/// `commands::database_commands::get_database_info_inner` performs, rather
/// than reusing it directly: that function takes `&Mutex<DbManager>` and
/// returns `commands::dto::AppError` (a Tauri-IPC-facing error type), both of
/// which are specific to the `AppState`-backed Tauri command boundary. The
/// CLI's read-only route has neither a `Mutex` nor a Tauri `AppState`, so
/// reusing it would mean threading Tauri IPC types through the CLI just to
/// unwrap them again. `ReadOnlyDbManager::database_info` (added for this
/// task) already reuses the same underlying `DbManager::database_info_from_path`
/// the Tauri command calls, so the actual size-reading logic is not
/// duplicated.
pub(crate) struct DbInfoCommand;

#[async_trait(?Send)]
impl CliCommand for DbInfoCommand {
    fn capabilities(&self) -> &'static [Capability] {
        CAPABILITIES
    }

    async fn run(&self, route: Route, _network: NetworkAccess) -> CliResult<CommandOutput> {
        let Route::ReadOnly(db) = route else {
            unreachable!(
                "DbInfoCommand declares Capability::DbRead; dispatcher must route ReadOnly"
            );
        };

        let info = db.database_info()?;
        let schema_version = db.with_conn(|conn| Ok(read_schema_version(conn)?))?;

        let human = format!(
            "schema_version: {schema_version} (latest: {LATEST_VERSION})\n\
             db size: {} bytes\nwal size: {} bytes\nshm size: {} bytes\ntotal size: {} bytes",
            info.db_size_bytes, info.wal_size_bytes, info.shm_size_bytes, info.total_size_bytes
        );

        let json_data = json!({
            "schema_version": schema_version,
            "latest_version": LATEST_VERSION,
            "db_size_bytes": info.db_size_bytes,
            "wal_size_bytes": info.wal_size_bytes,
            "shm_size_bytes": info.shm_size_bytes,
            "total_size_bytes": info.total_size_bytes,
        });

        Ok(CommandOutput {
            human,
            json_data,
            exit_code: None,
        })
    }
}

/// Reuses `SqliteArticleRepository::count_orphaned_articles` /
/// `list_orphaned_feed_groups` directly: these are the same pure query
/// methods `get_feed_integrity_report_inner`
/// (`commands/article_commands/integrity.rs`) calls, already `pub` and
/// requiring only a `&Connection`. That Tauri command additionally takes a
/// `syncing` maintenance guard, but a report-only read cannot corrupt
/// anything a real guard would protect against, and the CLI has no
/// `AppState`/`AtomicBool` to fake one with — so this deliberately runs the
/// query without a guard rather than fabricating app coordination.
pub(crate) struct DbIntegrityCommand;

#[async_trait(?Send)]
impl CliCommand for DbIntegrityCommand {
    fn capabilities(&self) -> &'static [Capability] {
        CAPABILITIES
    }

    async fn run(&self, route: Route, _network: NetworkAccess) -> CliResult<CommandOutput> {
        let Route::ReadOnly(db) = route else {
            unreachable!(
                "DbIntegrityCommand declares Capability::DbRead; dispatcher must route ReadOnly"
            );
        };

        let (orphaned_article_count, orphaned_feeds) = db.with_conn(|conn| {
            let repo = SqliteArticleRepository::new(conn);
            Ok((
                repo.count_orphaned_articles()?,
                repo.list_orphaned_feed_groups()?,
            ))
        })?;

        let human = if orphaned_feeds.is_empty() {
            format!("orphaned_article_count: {orphaned_article_count}\nno orphaned feed groups")
        } else {
            let mut lines = vec![format!("orphaned_article_count: {orphaned_article_count}")];
            for group in &orphaned_feeds {
                lines.push(format!(
                    "  - missing_feed_id={} article_count={} latest_article_title={:?} latest_article_published_at={:?}",
                    group.missing_feed_id,
                    group.article_count,
                    group.latest_article_title,
                    group.latest_article_published_at,
                ));
            }
            lines.join("\n")
        };

        let json_data = json!({
            "orphaned_article_count": orphaned_article_count,
            "orphaned_feeds": orphaned_feeds.iter().map(|group| json!({
                "missing_feed_id": group.missing_feed_id,
                "article_count": group.article_count,
                "latest_article_title": group.latest_article_title,
                "latest_article_published_at": group.latest_article_published_at,
            })).collect::<Vec<_>>(),
        });

        Ok(CommandOutput {
            human,
            json_data,
            exit_code: None,
        })
    }
}
