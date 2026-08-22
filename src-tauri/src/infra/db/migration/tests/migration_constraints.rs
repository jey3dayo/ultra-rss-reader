use rusqlite::params;

use super::super::consts::*;
use super::super::repairs::*;
use super::super::*;
use super::{assert_single_schema_version_row, open_in_memory};

#[test]
fn v16_allows_duplicate_connection_verification_columns_only() {
    let mut conn = open_in_memory();
    conn.execute_batch(MIGRATION_V1).unwrap();
    conn.execute_batch(MIGRATION_V2).unwrap();
    conn.execute_batch(MIGRATION_V3).unwrap();
    conn.execute_batch(MIGRATION_V4).unwrap();
    conn.execute_batch(MIGRATION_V5).unwrap();
    conn.execute_batch(MIGRATION_V6).unwrap();
    conn.execute_batch(MIGRATION_V7).unwrap();
    apply_v8_feed_reader_preview_modes(&conn).unwrap();
    conn.execute_batch(MIGRATION_V9).unwrap();
    set_schema_version(&conn, 10).unwrap();
    conn.execute_batch(MIGRATION_V11).unwrap();
    conn.execute_batch(MIGRATION_V12).unwrap();
    conn.execute_batch(MIGRATION_V13).unwrap();
    conn.execute_batch(MIGRATION_V14).unwrap();
    conn.execute_batch(MIGRATION_V15).unwrap();
    conn.execute_batch(
        "ALTER TABLE accounts
          ADD COLUMN connection_verification_status TEXT NOT NULL DEFAULT 'unverified';
          ALTER TABLE accounts ADD COLUMN connection_verified_at TEXT;
          ALTER TABLE accounts ADD COLUMN connection_verification_error TEXT;",
    )
    .unwrap();

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 15);
    assert_eq!(result.to_version, LATEST_VERSION);

    assert!(conn
        .prepare("SELECT connection_verification_status FROM accounts LIMIT 0")
        .is_ok());
    assert!(conn
        .prepare("SELECT connection_verified_at FROM accounts LIMIT 0")
        .is_ok());
    assert!(conn
        .prepare("SELECT connection_verification_error FROM accounts LIMIT 0")
        .is_ok());
}

#[test]
fn v18_deduplicates_pending_mutations_before_adding_unique_index() {
    let mut conn = open_in_memory();
    conn.execute_batch(MIGRATION_V1).unwrap();
    conn.execute_batch(MIGRATION_V2).unwrap();
    conn.execute_batch(MIGRATION_V3).unwrap();
    conn.execute_batch(MIGRATION_V4).unwrap();
    conn.execute_batch(MIGRATION_V5).unwrap();
    conn.execute_batch(MIGRATION_V6).unwrap();
    conn.execute_batch(MIGRATION_V7).unwrap();
    apply_v8_feed_reader_preview_modes(&conn).unwrap();
    conn.execute_batch(MIGRATION_V9).unwrap();
    set_schema_version(&conn, 10).unwrap();
    conn.execute_batch(MIGRATION_V11).unwrap();
    conn.execute_batch(MIGRATION_V12).unwrap();
    conn.execute_batch(MIGRATION_V13).unwrap();
    conn.execute_batch(MIGRATION_V14).unwrap();
    conn.execute_batch(MIGRATION_V15).unwrap();
    apply_v16_account_connection_verification(&conn).unwrap();
    conn.execute_batch(MIGRATION_V17).unwrap();
    conn.execute(
        "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
        params!["acc-1", "Local", "Local"],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
          VALUES (?1, 'mark_read', 'entry-1', '2026-05-10T00:00:00Z'),
                 (?1, 'mark_read', 'entry-1', '2026-05-10T00:00:01Z'),
                 (?1, 'star', 'entry-1', '2026-05-10T00:00:02Z')",
        params!["acc-1"],
    )
    .unwrap();

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 17);
    assert_eq!(result.to_version, LATEST_VERSION);

    let pending_rows: Vec<(String, String)> = conn
        .prepare(
            "SELECT mutation_type, remote_entry_id
              FROM pending_mutations
              ORDER BY mutation_type, remote_entry_id",
        )
        .unwrap()
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    assert_eq!(
        pending_rows,
        vec![
            ("mark_read".to_string(), "entry-1".to_string()),
            ("star".to_string(), "entry-1".to_string())
        ]
    );
    assert_single_schema_version_row(&conn, LATEST_VERSION);

    let duplicate_result = conn.execute(
        "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
          VALUES (?1, 'mark_read', 'entry-1', '2026-05-10T00:00:03Z')",
        params!["acc-1"],
    );
    assert!(duplicate_result.is_err());
}

#[test]
fn v26_sanitizer_version_index_is_used_for_backfill_query() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();

    conn.execute(
        "INSERT INTO accounts (id, kind, name) VALUES ('acc-1', 'FreshRss', 'FreshRSS')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO feeds (id, account_id, remote_id, title, url)
          VALUES ('feed-1', 'acc-1', 'feed/1', 'Feed', 'https://example.com/feed')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO articles (
             id, account_id, feed_id, title, content_raw, content_sanitized,
             sanitizer_version, published_at, fetched_at
          ) VALUES (
             'article-1', 'acc-1', 'feed-1', 'Article', '', '',
             1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
          )",
        [],
    )
    .unwrap();

    let mut stmt = conn
        .prepare(
            "EXPLAIN QUERY PLAN
              SELECT id, feed_id, remote_id, title, content_raw, content_sanitized,
                     sanitizer_version, summary, url, author, thumbnail, published_at,
                     is_read, is_starred, fetched_at
              FROM articles
              WHERE sanitizer_version < ?1
              ORDER BY sanitizer_version ASC, fetched_at ASC, id ASC
              LIMIT ?2",
        )
        .unwrap();
    let plan = stmt
        .query_map(params![2, 100], |row| row.get::<_, String>(3))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap()
        .join("\n");

    assert!(
        plan.contains("idx_articles_sanitizer_version_fetched_id"),
        "backfill query should use the sanitizer_version composite index, plan was: {plan}"
    );
    assert!(
        !plan.to_uppercase().contains("USE TEMP B-TREE"),
        "index should satisfy the ORDER BY without a separate sort: {plan}"
    );
}
