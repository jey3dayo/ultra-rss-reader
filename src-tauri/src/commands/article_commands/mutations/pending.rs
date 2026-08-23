use chrono::Utc;
use rusqlite::OptionalExtension;

use crate::commands::dto::AppError;
use crate::domain::error::DomainError;
use crate::domain::provider::is_greader_managed_feed_remote_id;
use crate::domain::types::{AccountId, ArticleId};
use crate::repository::pending_mutation::{PendingMutation, PendingMutationType};

pub(crate) fn provider_supports_pending_article_mutations(account_kind: &str) -> bool {
    matches!(account_kind, "FreshRss")
}

pub(crate) fn feed_supports_pending_article_mutations(feed_remote_id: Option<&str>) -> bool {
    is_greader_managed_feed_remote_id(feed_remote_id)
}

pub(crate) fn supports_remote_mutations(account_kind: &str, feed_remote_id: Option<&str>) -> bool {
    provider_supports_pending_article_mutations(account_kind)
        && feed_supports_pending_article_mutations(feed_remote_id)
}

pub(crate) struct BulkArticleMutationRow {
    pub(crate) article_id: String,
    pub(crate) feed_id: String,
    pub(crate) remote_entry_id: Option<String>,
    pub(crate) account_kind: String,
    pub(crate) account_id: String,
    pub(crate) feed_remote_id: Option<String>,
}

pub(crate) fn collect_article_mutation_rows(
    conn: &rusqlite::Connection,
    sql: &str,
    params: &[&dyn rusqlite::ToSql],
) -> Result<Vec<BulkArticleMutationRow>, AppError> {
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

pub(crate) fn queue_bulk_pending_mutations(
    conn: &rusqlite::Connection,
    rows: &[BulkArticleMutationRow],
    mutation_type: PendingMutationType,
) -> Result<(), AppError> {
    for row in rows {
        if let Some(remote_entry_id) = &row.remote_entry_id {
            if supports_remote_mutations(&row.account_kind, row.feed_remote_id.as_deref()) {
                save_pending_mutation(
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

pub(crate) fn save_pending_mutation(
    conn: &rusqlite::Connection,
    mutation: &PendingMutation,
) -> Result<(), AppError> {
    if mutation.remote_entry_id.trim().is_empty() {
        return Err(DomainError::Validation(
            "pending mutation remote_entry_id cannot be blank".to_string(),
        )
        .into());
    }

    let replacement_types = mutation.mutation_type.replacement_type_values();
    let placeholders = std::iter::repeat_n("?", replacement_types.len())
        .collect::<Vec<_>>()
        .join(", ");
    let delete_sql = format!(
        "DELETE FROM pending_mutations
         WHERE account_id = ?1 AND remote_entry_id = ?2 AND mutation_type IN ({placeholders})"
    );
    let mut delete_params: Vec<&dyn rusqlite::types::ToSql> =
        Vec::with_capacity(2 + replacement_types.len());
    delete_params.push(&mutation.account_id.0);
    delete_params.push(&mutation.remote_entry_id);
    for mutation_type in replacement_types {
        delete_params.push(mutation_type);
    }
    conn.execute(&delete_sql, rusqlite::params_from_iter(delete_params))
        .map_err(DomainError::from)?;
    conn.execute(
        "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            mutation.account_id.0,
            mutation.mutation_type.as_str(),
            mutation.remote_entry_id,
            mutation.created_at
        ],
    )
    .map_err(DomainError::from)?;
    Ok(())
}

/// If the article belongs to a FreshRSS account and has a remote_id, insert a pending_mutation.
#[cfg(test)]
pub(crate) fn maybe_queue_mutation(
    conn: &rusqlite::Connection,
    article_id: &ArticleId,
    mutation_type: PendingMutationType,
) -> Result<(), AppError> {
    // Single query to get remote_id, account kind, and account_id
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
            save_pending_mutation(
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

pub(crate) fn maybe_queue_mutation_in_current_transaction(
    conn: &rusqlite::Connection,
    article_id: &ArticleId,
    mutation_type: PendingMutationType,
) -> Result<(), AppError> {
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
            save_pending_mutation(
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
