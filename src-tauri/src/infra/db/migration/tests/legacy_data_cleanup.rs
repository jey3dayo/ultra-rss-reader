use rusqlite::params;

use super::super::consts::*;
use super::super::repairs::*;
use super::super::*;
use super::open_in_memory;

#[test]
fn v13_remaps_legacy_tag_palette_to_muted_colors() {
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

    conn.execute(
        "INSERT INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
        ("tag-1", "Important", "#ef4444"),
    )
    .unwrap();
    conn.execute(
        "INSERT INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
        ("tag-2", "Read later", "#3B82F6"),
    )
    .unwrap();
    conn.execute(
        "INSERT INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
        ("tag-3", "Custom", "#123456"),
    )
    .unwrap();

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 12);
    assert_eq!(result.to_version, LATEST_VERSION);

    let colors: Vec<(String, Option<String>)> = conn
        .prepare("SELECT id, color FROM tags ORDER BY id")
        .unwrap()
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();

    assert_eq!(
        colors[0],
        ("tag-1".to_string(), Some("#cf7868".to_string()))
    );
    assert_eq!(
        colors[1],
        ("tag-2".to_string(), Some("#6f8eb8".to_string()))
    );
    assert_eq!(
        colors[2],
        ("tag-3".to_string(), Some("#123456".to_string()))
    );
}

#[test]
fn v14_adds_article_content_text_column() {
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
    conn.execute(
        "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
        params!["acc-1", "Local", "Local"],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO feeds (id, account_id, title, url) VALUES (?1, ?2, ?3, ?4)",
        params!["feed-1", "acc-1", "Feed", "https://example.com/feed.xml"],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO articles (
             id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version,
             summary, url, author, thumbnail, published_at, is_read, is_starred, fetched_at
          ) VALUES (
             ?1, ?2, NULL, ?3, ?4, ?5, ?6,
             ?7, NULL, NULL, NULL, ?8, 0, 0, ?9
          )",
        params![
            "article-1",
            "feed-1",
            "Article",
            "<p>Raw</p>",
            "<p>Sanitized <strong>body</strong></p>",
            1,
            "Summary fallback",
            "2026-04-18T00:00:00Z",
            "2026-04-18T00:00:00Z"
        ],
    )
    .unwrap();

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 13);
    assert_eq!(result.to_version, LATEST_VERSION);

    assert!(conn
        .prepare("SELECT content_text FROM articles LIMIT 0")
        .is_ok());
    let (content_sanitized, content_text): (String, String) = conn
        .query_row(
            "SELECT content_sanitized, content_text FROM articles WHERE id = 'article-1'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(content_sanitized, "<p>Sanitized <strong>body</strong></p>");
    assert_eq!(content_text, "");
}

#[test]
fn v15_removes_inoreader_accounts_and_preferences() {
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

    conn.execute(
        "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
        params!["acc-inoreader", "Inoreader", "Inoreader"],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO folders (id, account_id, remote_id, name) VALUES (?1, ?2, ?3, ?4)",
        params!["folder-1", "acc-inoreader", "folder-remote", "Folder"],
    )
    .unwrap();
    conn.execute(
         "INSERT INTO feeds (id, account_id, folder_id, remote_id, title, url, site_url, unread_count, reader_mode, web_preview_mode)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 'inherit', 'inherit')",
         params![
             "feed-1",
             "acc-inoreader",
             "folder-1",
             "feed/http://example.com/rss",
             "Feed",
             "https://example.com/rss",
             "https://example.com"
         ],
     )
     .unwrap();
    conn.execute(
         "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, content_text, sanitizer_version, summary, url, author, thumbnail, published_at, is_read, is_starred, fetched_at)
          VALUES (?1, ?2, ?3, ?4, '', '', '', 1, NULL, NULL, NULL, NULL, ?5, 0, 0, ?6)",
         params![
             "article-1",
             "feed-1",
             "remote-1",
             "Article",
             "2026-04-18T00:00:00Z",
             "2026-04-18T00:00:00Z"
         ],
     )
     .unwrap();
    conn.execute(
        "INSERT INTO sync_state (account_id, scope_key) VALUES (?1, '')",
        params!["acc-inoreader"],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
          VALUES (?1, 'mark_read', 'remote-1', ?2)",
        params!["acc-inoreader", "2026-04-18T00:00:00Z"],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO preferences (key, value) VALUES ('inoreader_app_id', 'app-id')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO preferences (key, value) VALUES ('inoreader_app_key', 'app-key')",
        [],
    )
    .unwrap();

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 14);
    assert_eq!(result.to_version, LATEST_VERSION);

    let account_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM accounts WHERE kind = 'Inoreader'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    let feed_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM feeds WHERE account_id = 'acc-inoreader'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    let article_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE feed_id = 'feed-1'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    let sync_state_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sync_state WHERE account_id = 'acc-inoreader'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    let pending_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pending_mutations WHERE account_id = 'acc-inoreader'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    let pref_count: i64 = conn
         .query_row(
             "SELECT COUNT(*) FROM preferences WHERE key IN ('inoreader_app_id', 'inoreader_app_key')",
             [],
             |row| row.get(0),
         )
         .unwrap();

    assert_eq!(account_count, 0);
    assert_eq!(feed_count, 0);
    assert_eq!(article_count, 0);
    assert_eq!(sync_state_count, 0);
    assert_eq!(pending_count, 0);
    assert_eq!(pref_count, 0);
}
