//! Atomic user-initiated article changes and their remote pending mutations.

use chrono::{DateTime, SecondsFormat, Utc};
use rusqlite::{Connection, OptionalExtension};

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::is_greader_managed_feed_remote_id;
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
use crate::repository::article::ArticleMutationRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::pending_mutation::{PendingMutation, PendingMutationType};

use super::sqlite_article::SqliteArticleRepository;
use super::sqlite_feed::SqliteFeedRepository;
use super::sqlite_pending_mutation::save_pending_mutation_in_transaction;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum OldUnreadScope {
    Account,
    Feed,
    Folder,
}

pub(crate) enum ArticleChange<'a> {
    Read(&'a ArticleId, bool),
    Star(&'a ArticleId, bool),
    MarkRead(ArticleReadScope<'a>),
    UnstarAccount(&'a AccountId),
}

pub(crate) enum ArticleReadScope<'a> {
    Articles(&'a [ArticleId]),
    Feed(&'a FeedId),
    Folder(&'a FolderId),
    Account(&'a AccountId),
    StarredAccount(&'a AccountId),
    Old {
        scope: OldUnreadScope,
        target_id: &'a str,
        before: DateTime<Utc>,
    },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum ArticleChangeStage {
    Begin,
    Update,
    RecalculateCount,
    QueueMutation,
    Commit,
}

#[derive(Debug)]
pub(crate) struct ArticleChangeFailure {
    pub(crate) stage: ArticleChangeStage,
    pub(crate) sqlite_code: Option<rusqlite::ErrorCode>,
    pub(crate) error: DomainError,
}

impl ArticleChangeFailure {
    fn domain(stage: ArticleChangeStage, error: DomainError) -> Self {
        Self {
            stage,
            sqlite_code: None,
            error,
        }
    }

    fn sqlite(stage: ArticleChangeStage, error: rusqlite::Error) -> Self {
        Self {
            stage,
            sqlite_code: error.sqlite_error_code(),
            error: error.into(),
        }
    }
}

/// Applies article state, unread counts and pending queue changes in one transaction.
/// Returns selected article IDs only after commit; every failure rolls back all changes.
pub(crate) fn apply_article_change(
    conn: &Connection,
    change: ArticleChange<'_>,
) -> Result<Vec<String>, ArticleChangeFailure> {
    use ArticleChangeStage as Stage;

    let tx = conn
        .unchecked_transaction()
        .map_err(|error| ArticleChangeFailure::sqlite(Stage::Begin, error))?;
    let article_ids = match change {
        ArticleChange::Read(article_id, read) => {
            SqliteArticleRepository::new(&tx)
                .mark_as_read(article_id, read)
                .map_err(|error| ArticleChangeFailure::domain(Stage::Update, error))?;
            let feed_id: Option<String> = tx
                .query_row(
                    "SELECT feed_id FROM articles WHERE id = ?1",
                    rusqlite::params![article_id.0],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|error| ArticleChangeFailure::sqlite(Stage::RecalculateCount, error))?;
            if let Some(feed_id) = feed_id {
                SqliteFeedRepository::new(&tx)
                    .recalculate_unread_count(&FeedId(feed_id))
                    .map_err(|error| {
                        ArticleChangeFailure::domain(Stage::RecalculateCount, error)
                    })?;
                let mutation_type = if read {
                    PendingMutationType::MarkRead
                } else {
                    PendingMutationType::MarkUnread
                };
                maybe_queue_mutation_in_current_transaction(&tx, article_id, mutation_type)
                    .map_err(|error| ArticleChangeFailure::domain(Stage::QueueMutation, error))?;
            }
            vec![article_id.0.clone()]
        }
        ArticleChange::Star(article_id, starred) => {
            SqliteArticleRepository::new(&tx)
                .mark_as_starred(article_id, starred)
                .map_err(|error| ArticleChangeFailure::domain(Stage::Update, error))?;
            let mutation_type = if starred {
                PendingMutationType::Star
            } else {
                PendingMutationType::Unstar
            };
            maybe_queue_mutation_in_current_transaction(&tx, article_id, mutation_type)
                .map_err(|error| ArticleChangeFailure::domain(Stage::QueueMutation, error))?;
            vec![article_id.0.clone()]
        }
        ArticleChange::MarkRead(scope) => {
            let rows = select_read_rows(&tx, scope)
                .map_err(|error| ArticleChangeFailure::domain(Stage::Update, error))?;
            apply_bulk_change(&tx, rows, false)?
        }
        ArticleChange::UnstarAccount(account_id) => {
            let rows = collect_account_starred_rows(&tx, account_id)
                .map_err(|error| ArticleChangeFailure::domain(Stage::Update, error))?;
            apply_bulk_change(&tx, rows, true)?
        }
    };
    tx.commit()
        .map_err(|error| ArticleChangeFailure::sqlite(Stage::Commit, error))?;
    Ok(article_ids)
}

fn apply_bulk_change(
    tx: &rusqlite::Transaction<'_>,
    rows: Vec<BulkArticleMutationRow>,
    unstar: bool,
) -> Result<Vec<String>, ArticleChangeFailure> {
    use ArticleChangeStage as Stage;

    let update = if unstar {
        "UPDATE articles SET is_starred = 0 WHERE id = ?1"
    } else {
        "UPDATE articles SET is_read = 1 WHERE id = ?1"
    };
    for row in &rows {
        tx.execute(update, rusqlite::params![row.article_id])
            .map_err(|error| ArticleChangeFailure::sqlite(Stage::Update, error))?;
    }
    if !unstar {
        recalculate_bulk_feed_unread_counts(tx, &rows)
            .map_err(|error| ArticleChangeFailure::domain(Stage::RecalculateCount, error))?;
    }
    let mutation_type = if unstar {
        PendingMutationType::Unstar
    } else {
        PendingMutationType::MarkRead
    };
    queue_bulk_pending_mutations(tx, &rows, mutation_type)
        .map_err(|error| ArticleChangeFailure::domain(Stage::QueueMutation, error))?;
    Ok(rows.into_iter().map(|row| row.article_id).collect())
}

fn select_read_rows(
    conn: &Connection,
    scope: ArticleReadScope<'_>,
) -> DomainResult<Vec<BulkArticleMutationRow>> {
    match scope {
        ArticleReadScope::Articles(ids) => collect_existing_article_rows_by_id(conn, ids),
        ArticleReadScope::Feed(id) => collect_feed_unread_rows(conn, id),
        ArticleReadScope::Folder(id) => collect_folder_unread_rows(conn, id),
        ArticleReadScope::Account(id) => collect_account_unread_rows(conn, id),
        ArticleReadScope::StarredAccount(id) => collect_account_starred_unread_rows(conn, id),
        ArticleReadScope::Old {
            scope,
            target_id,
            before,
        } => collect_old_unread_rows(conn, scope, target_id, before),
    }
}

pub(crate) fn count_old_unread_articles(
    conn: &Connection,
    scope: OldUnreadScope,
    target_id: &str,
    before: DateTime<Utc>,
) -> DomainResult<usize> {
    Ok(collect_old_unread_rows(conn, scope, target_id, before)?.len())
}

fn supports_remote_mutations(account_kind: &str, feed_remote_id: Option<&str>) -> bool {
    matches!(account_kind, "FreshRss") && is_greader_managed_feed_remote_id(feed_remote_id)
}

struct BulkArticleMutationRow {
    article_id: String,
    feed_id: String,
    remote_entry_id: Option<String>,
    account_kind: String,
    account_id: String,
    feed_remote_id: Option<String>,
}

fn collect_article_mutation_rows(
    conn: &rusqlite::Connection,
    sql: &str,
    params: &[&dyn rusqlite::ToSql],
) -> DomainResult<Vec<BulkArticleMutationRow>> {
    let mut stmt = conn.prepare(sql).map_err(DomainError::from)?;
    let rows = stmt
        .query_map(params, |row| {
            Ok(BulkArticleMutationRow {
                article_id: row.get(0)?,
                feed_id: row.get(1)?,
                remote_entry_id: row.get(2)?,
                account_kind: row.get(3)?,
                account_id: row.get(4)?,
                feed_remote_id: row.get(5)?,
            })
        })
        .map_err(DomainError::from)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DomainError::from)?;
    Ok(rows)
}

fn queue_bulk_pending_mutations(
    conn: &rusqlite::Transaction<'_>,
    rows: &[BulkArticleMutationRow],
    mutation_type: PendingMutationType,
) -> DomainResult<()> {
    for row in rows {
        if let Some(remote_entry_id) = &row.remote_entry_id {
            if supports_remote_mutations(&row.account_kind, row.feed_remote_id.as_deref()) {
                save_pending_mutation_in_transaction(
                    conn,
                    &PendingMutation {
                        id: None,
                        account_id: AccountId(row.account_id.clone()),
                        mutation_type,
                        remote_entry_id: remote_entry_id.clone(),
                        created_at: Utc::now().to_rfc3339(),
                    },
                )?;
            }
        }
    }
    Ok(())
}

fn collect_account_unread_rows(
    conn: &rusqlite::Connection,
    account_id: &AccountId,
) -> DomainResult<Vec<BulkArticleMutationRow>> {
    collect_article_mutation_rows(
        conn,
        "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         JOIN accounts acc ON f.account_id = acc.id
         WHERE f.account_id = ?1 AND a.is_read = 0",
        &[&account_id.0],
    )
}

fn collect_account_starred_rows(
    conn: &rusqlite::Connection,
    account_id: &AccountId,
) -> DomainResult<Vec<BulkArticleMutationRow>> {
    collect_article_mutation_rows(
        conn,
        "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         JOIN accounts acc ON f.account_id = acc.id
         WHERE f.account_id = ?1 AND a.is_starred = 1",
        &[&account_id.0],
    )
}

fn collect_account_starred_unread_rows(
    conn: &rusqlite::Connection,
    account_id: &AccountId,
) -> DomainResult<Vec<BulkArticleMutationRow>> {
    collect_article_mutation_rows(
        conn,
        "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         JOIN accounts acc ON f.account_id = acc.id
         WHERE f.account_id = ?1 AND a.is_starred = 1 AND a.is_read = 0",
        &[&account_id.0],
    )
}

fn collect_feed_unread_rows(
    conn: &rusqlite::Connection,
    feed_id: &FeedId,
) -> DomainResult<Vec<BulkArticleMutationRow>> {
    collect_article_mutation_rows(
        conn,
        "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         JOIN accounts acc ON f.account_id = acc.id
         WHERE a.feed_id = ?1 AND a.is_read = 0",
        &[&feed_id.0],
    )
}

fn collect_folder_unread_rows(
    conn: &rusqlite::Connection,
    folder_id: &FolderId,
) -> DomainResult<Vec<BulkArticleMutationRow>> {
    collect_article_mutation_rows(
        conn,
        "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         JOIN accounts acc ON f.account_id = acc.id
         WHERE f.folder_id = ?1 AND a.is_read = 0",
        &[&folder_id.0],
    )
}

fn collect_old_unread_rows(
    conn: &rusqlite::Connection,
    scope: OldUnreadScope,
    target_id: &str,
    before: DateTime<Utc>,
) -> DomainResult<Vec<BulkArticleMutationRow>> {
    let before = before.to_rfc3339_opts(SecondsFormat::Secs, true);
    match scope {
        OldUnreadScope::Account => collect_article_mutation_rows(
            conn,
            "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
             FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             JOIN accounts acc ON f.account_id = acc.id
             WHERE f.account_id = ?1
               AND a.is_read = 0
               AND datetime(a.published_at) IS NOT NULL
               AND datetime(a.published_at) < datetime(?2)",
            &[&target_id, &before],
        ),
        OldUnreadScope::Feed => collect_article_mutation_rows(
            conn,
            "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
             FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             JOIN accounts acc ON f.account_id = acc.id
             WHERE a.feed_id = ?1
               AND a.is_read = 0
               AND datetime(a.published_at) IS NOT NULL
               AND datetime(a.published_at) < datetime(?2)",
            &[&target_id, &before],
        ),
        OldUnreadScope::Folder => collect_article_mutation_rows(
            conn,
            "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
             FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             JOIN accounts acc ON f.account_id = acc.id
             WHERE f.folder_id = ?1
               AND a.is_read = 0
               AND datetime(a.published_at) IS NOT NULL
               AND datetime(a.published_at) < datetime(?2)",
            &[&target_id, &before],
        ),
    }
}

fn collect_existing_article_rows_by_id(
    conn: &rusqlite::Connection,
    ids: &[ArticleId],
) -> DomainResult<Vec<BulkArticleMutationRow>> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }

    let placeholders = std::iter::repeat_n("?", ids.len())
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         JOIN accounts acc ON f.account_id = acc.id
         WHERE a.id IN ({placeholders})"
    );
    let params = ids
        .iter()
        .map(|id| &id.0 as &dyn rusqlite::ToSql)
        .collect::<Vec<_>>();
    collect_article_mutation_rows(conn, &sql, params.as_slice())
}

fn recalculate_bulk_feed_unread_counts(
    conn: &rusqlite::Connection,
    rows: &[BulkArticleMutationRow],
) -> DomainResult<()> {
    let mut feed_ids = rows
        .iter()
        .map(|row| row.feed_id.as_str())
        .collect::<Vec<_>>();
    feed_ids.sort_unstable();
    feed_ids.dedup();

    let feed_repo = SqliteFeedRepository::new(conn);
    for feed_id in feed_ids {
        feed_repo.recalculate_unread_count(&FeedId(feed_id.to_string()))?;
    }
    Ok(())
}

fn maybe_queue_mutation_in_current_transaction(
    conn: &rusqlite::Transaction<'_>,
    article_id: &ArticleId,
    mutation_type: PendingMutationType,
) -> DomainResult<()> {
    let row: Option<(String, String, String, Option<String>)> = conn
        .query_row(
            "SELECT a.remote_id, acc.kind, f.account_id, f.remote_id
             FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             JOIN accounts acc ON f.account_id = acc.id
             WHERE a.id = ?1 AND a.remote_id IS NOT NULL",
            rusqlite::params![article_id.0],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                ))
            },
        )
        .optional()
        .map_err(DomainError::from)?;

    if let Some((remote_entry_id, account_kind, account_id, feed_remote_id)) = row {
        if supports_remote_mutations(&account_kind, feed_remote_id.as_deref()) {
            save_pending_mutation_in_transaction(
                conn,
                &PendingMutation {
                    id: None,
                    account_id: AccountId(account_id),
                    mutation_type,
                    remote_entry_id,
                    created_at: chrono::Utc::now().to_rfc3339(),
                },
            )?;
        }
    }

    Ok(())
}
