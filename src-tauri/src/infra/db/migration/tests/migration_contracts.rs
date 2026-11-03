use super::super::consts::*;
use super::super::*;
use super::{normalize_sql, open_in_memory};

#[test]
fn fresh_db_migrates_to_latest() {
    let mut conn = open_in_memory();
    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 0);
    assert_eq!(result.to_version, LATEST_VERSION);
    assert!(result.migrated());
}

#[test]
fn already_current_is_noop() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();
    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, LATEST_VERSION);
    assert_eq!(result.to_version, LATEST_VERSION);
    assert!(!result.migrated());
}

#[test]
fn latest_version_matches_migration_file_sequence() {
    let migration_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    let mut versions = std::fs::read_dir(&migration_dir)
        .unwrap()
        .map(|entry| {
            let entry = entry.unwrap();
            let file_name = entry.file_name();
            let file_name = file_name.to_string_lossy();
            let version = file_name
                .strip_prefix('V')
                .and_then(|name| name.split_once("__"))
                .map(|(version, _)| version)
                .unwrap_or_else(|| panic!("invalid migration filename: {file_name}"));
            version
                .parse::<i32>()
                .unwrap_or_else(|_| panic!("invalid migration version: {file_name}"))
        })
        .collect::<Vec<_>>();
    versions.sort_unstable();

    assert_eq!(versions.last().copied(), Some(LATEST_VERSION));
    assert!(
        versions.windows(2).all(|window| window[0] < window[1]),
        "migration versions should be strictly increasing: {versions:?}"
    );

    let inline_versions = [10];
    for version in 1..=LATEST_VERSION {
        assert!(
            versions.binary_search(&version).is_ok() || inline_versions.contains(&version),
            "migration version {version} is not represented by a file or inline repair"
        );
    }
}

#[test]
fn v16_file_migration_matches_inline_contract() {
    let inline_v16_sql = format!(
        "{V16_CONNECTION_VERIFICATION_STATUS_SQL};
          {V16_CONNECTION_VERIFIED_AT_SQL};
          {V16_CONNECTION_VERIFICATION_ERROR_SQL};
          DELETE FROM schema_version;
          INSERT INTO schema_version (version) VALUES (16);"
    );

    assert_eq!(
        normalize_sql(MIGRATION_V16),
        normalize_sql(&inline_v16_sql),
        "file-based V16 migration must stay in sync with the inline migration"
    );
}

#[test]
fn v22_file_migration_matches_inline_contract() {
    let inline_v22_sql = format!(
        "{V22_LAST_EXPORT_DIGEST_SQL};
          DELETE FROM schema_version;
          INSERT INTO schema_version (version) VALUES (22);"
    );

    assert_eq!(
        normalize_sql(MIGRATION_V22),
        normalize_sql(&inline_v22_sql),
        "file-based V22 migration must stay in sync with the inline migration"
    );
}

#[test]
fn v22_allows_duplicate_last_export_digest_column_only() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();
    set_schema_version(&conn, 21).unwrap();

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 21);
    assert_eq!(result.to_version, LATEST_VERSION);
    assert!(conn
        .prepare("SELECT last_export_digest FROM local_account_sync_settings LIMIT 0")
        .is_ok());
}

#[test]
fn v24_file_migration_matches_inline_contract() {
    let inline_v24_sql = format!(
        "{V24_FEED_ICON_URL_SQL};
          DELETE FROM schema_version;
          INSERT INTO schema_version (version) VALUES (24);"
    );

    assert_eq!(
        normalize_sql(MIGRATION_V24),
        normalize_sql(&inline_v24_sql),
        "file-based V24 migration must stay in sync with the inline migration"
    );
}

#[test]
fn v24_allows_duplicate_feed_icon_url_column_only() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();
    set_schema_version(&conn, 23).unwrap();

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 23);
    assert_eq!(result.to_version, LATEST_VERSION);
    assert!(conn.prepare("SELECT icon_url FROM feeds LIMIT 0").is_ok());
}

#[test]
fn v27_file_migration_matches_inline_contract() {
    let inline_v27_sql = format!(
        "{V27_FOLDER_ORDER_MODE_SQL};
          DELETE FROM schema_version;
          INSERT INTO schema_version (version) VALUES (27);"
    );

    assert_eq!(
        normalize_sql(MIGRATION_V27),
        normalize_sql(&inline_v27_sql),
        "file-based V27 migration must stay in sync with the inline migration"
    );
}

#[test]
fn v28_file_migration_matches_inline_contract() {
    let inline_v28_sql = format!(
        "{V28_READ_CHANGED_AT_SQL};
          {V28_STARRED_CHANGED_AT_SQL};
          {V28_STAMP_TRIGGERS_SQL}
          DELETE FROM schema_version;
          INSERT INTO schema_version (version) VALUES (28);"
    );

    assert_eq!(
        normalize_sql(MIGRATION_V28),
        normalize_sql(&inline_v28_sql),
        "file-based V28 migration must stay in sync with the inline migration"
    );
}

#[test]
fn v27_allows_duplicate_folder_order_mode_column_only() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();
    set_schema_version(&conn, 26).unwrap();

    let first = run_migrations(&mut conn).unwrap();
    assert_eq!(first.from_version, 26);
    assert_eq!(first.to_version, LATEST_VERSION);
    assert!(conn
        .prepare("SELECT folder_order_mode FROM accounts LIMIT 0")
        .is_ok());

    let second = run_migrations(&mut conn).unwrap();
    assert_eq!(second.from_version, LATEST_VERSION);
    assert_eq!(second.to_version, LATEST_VERSION);
    assert!(!second.migrated());
}

#[test]
fn v28_adds_article_change_time_columns_and_triggers() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();

    assert!(conn
        .prepare("SELECT read_changed_at, starred_changed_at FROM articles LIMIT 0")
        .is_ok());
    let trigger_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master
             WHERE type = 'trigger'
               AND name IN ('articles_stamp_read_changed_at', 'articles_stamp_starred_changed_at')",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(trigger_count, 2);
}

#[test]
fn v28_stamps_change_times_for_repository_writes_but_not_for_explicit_times() {
    use crate::domain::types::ArticleId;
    use crate::infra::db::connection::DbManager;
    use crate::infra::db::sqlite_article::SqliteArticleRepository;
    use crate::repository::article::ArticleMutationRepository;

    let db = DbManager::new_in_memory().unwrap();
    let conn = db.writer();
    conn.execute_batch(
        "INSERT INTO accounts (id, kind, name) VALUES ('account-1', 'Local', 'Local');
         INSERT INTO feeds (id, account_id, title, url, site_url, reader_mode, web_preview_mode)
         VALUES ('feed-1', 'account-1', 'Feed', 'https://example.com/feed.xml', '', 'inherit', 'inherit');
         INSERT INTO articles (id, feed_id, title, published_at, fetched_at, is_read, is_starred)
         VALUES ('article-1', 'feed-1', 'Article', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 0, 0);",
    )
    .unwrap();
    let change_times = |conn: &Connection| -> (Option<String>, Option<String>) {
        conn.query_row(
            "SELECT read_changed_at, starred_changed_at FROM articles WHERE id = 'article-1'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap()
    };
    assert_eq!(change_times(conn), (None, None));

    let repo = SqliteArticleRepository::new(conn);
    repo.mark_as_read(&ArticleId("article-1".to_string()), true)
        .unwrap();
    let (read_changed_at, starred_changed_at) = change_times(conn);
    assert!(read_changed_at.is_some_and(|value| value.ends_with('Z')));
    assert_eq!(starred_changed_at, None);

    repo.mark_as_starred(&ArticleId("article-1".to_string()), true)
        .unwrap();
    assert!(change_times(conn).1.is_some());

    conn.execute(
        "UPDATE articles SET is_read = 0, read_changed_at = '2020-05-06T07:08:09.123Z'
         WHERE id = 'article-1'",
        [],
    )
    .unwrap();
    assert_eq!(
        change_times(conn).0.as_deref(),
        Some("2020-05-06T07:08:09.123Z")
    );
}

#[test]
fn v29_file_migration_matches_inline_contract() {
    let inline_v29_sql = format!(
        "{V29_FOLDERS_CHANGED_AT_SQL};
          {V29_FEEDS_CHANGED_AT_SQL};
          {V29_TAGS_CHANGED_AT_SQL};
          {V29_ARTICLE_TAGS_CHANGED_AT_SQL};
          {V29_LOCAL_SYNC_TABLES_SQL}
          {V29_TRIGGERS_SQL}
          DELETE FROM schema_version;
          INSERT INTO schema_version (version) VALUES (29);"
    );

    let file_v29_sql = MIGRATION_V29
        .lines()
        .filter(|line| !line.trim_start().starts_with("--"))
        .collect::<Vec<_>>()
        .join("\n");

    assert_eq!(
        normalize_sql(&file_v29_sql),
        normalize_sql(&inline_v29_sql),
        "file-based V29 migration must stay in sync with the inline migration"
    );
}

const V29_TRIGGER_NAME_FILTER: &str = "type = 'trigger'
    AND (name LIKE '%\\_stamp\\_changed\\_at\\_%' ESCAPE '\\'
         OR name LIKE '%\\_tombstone\\_%' ESCAPE '\\')";

fn v29_trigger_names(conn: &Connection) -> Vec<String> {
    let mut stmt = conn
        .prepare(&format!(
            "SELECT name FROM sqlite_master WHERE {V29_TRIGGER_NAME_FILTER} ORDER BY name"
        ))
        .unwrap();
    let names = stmt
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<String>, _>>()
        .unwrap();
    names
}

fn downgrade_to_v28(conn: &Connection) {
    for name in v29_trigger_names(conn) {
        conn.execute_batch(&format!("DROP TRIGGER {name}")).unwrap();
    }
    conn.execute_batch(
        "DROP TABLE local_sync_tombstones;
         DROP TABLE local_sync_apply_guard;
         ALTER TABLE folders DROP COLUMN changed_at;
         ALTER TABLE feeds DROP COLUMN changed_at;
         ALTER TABLE tags DROP COLUMN changed_at;
         ALTER TABLE article_tags DROP COLUMN changed_at;",
    )
    .unwrap();
    set_schema_version(conn, 28).unwrap();
}

fn v29_changed_at_column_count(conn: &Connection) -> usize {
    ["folders", "feeds", "tags", "article_tags"]
        .iter()
        .filter(|table| table_has_column(conn, table, "changed_at").unwrap())
        .count()
}

#[test]
fn v29_upgrade_from_v28_adds_change_tracking_and_is_idempotent() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();
    let expected_triggers = v29_trigger_names(&conn);
    assert!(!expected_triggers.is_empty());
    downgrade_to_v28(&conn);
    assert_eq!(v29_changed_at_column_count(&conn), 0);
    assert!(v29_trigger_names(&conn).is_empty());

    let upgraded = run_migrations(&mut conn).unwrap();
    assert_eq!(upgraded.from_version, 28);
    assert_eq!(upgraded.to_version, LATEST_VERSION);
    assert_eq!(
        v29_changed_at_column_count(&conn),
        4,
        "every synced entity table gets changed_at"
    );
    assert_eq!(v29_trigger_names(&conn), expected_triggers);
    let inactive_guard_rows: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM local_sync_apply_guard WHERE active = 0",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(inactive_guard_rows, 1);

    set_schema_version(&conn, 28).unwrap();
    let rerun = run_migrations(&mut conn).unwrap();
    assert_eq!(rerun.to_version, LATEST_VERSION);
    assert_eq!(v29_changed_at_column_count(&conn), 4);
    assert_eq!(v29_trigger_names(&conn), expected_triggers);
}

fn migrated_with_local_sync_fixture() -> crate::infra::db::connection::DbManager {
    let db = crate::infra::db::connection::DbManager::new_in_memory().unwrap();
    db.writer()
        .execute_batch(
        "INSERT INTO accounts (id, kind, name) VALUES ('a1', 'Local', 'One'), ('a2', 'Local', 'Two');
         INSERT INTO folders (id, account_id, name, sort_order) VALUES
           ('f1', 'a1', 'Tech', 0), ('f2', 'a2', 'Gone', 0);
         INSERT INTO feeds (id, account_id, title, url, site_url, reader_mode, web_preview_mode)
         VALUES ('feed-1', 'a1', 'Feed', 'https://example.com/1', '', 'inherit', 'inherit'),
                ('feed-2', 'a2', 'Feed', 'https://example.com/2', '', 'inherit', 'inherit');
         INSERT INTO articles (id, feed_id, title, published_at, fetched_at) VALUES
           ('art-1', 'feed-1', 'One', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
           ('art-2', 'feed-1', 'Two', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
           ('art-3', 'feed-2', 'Three', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
         INSERT INTO tags (id, name) VALUES ('t1', 'Rust'), ('t2', 'Swift');
         INSERT INTO article_tags (article_id, tag_id) VALUES
           ('art-1', 't1'), ('art-2', 't1'), ('art-3', 't2');",
    )
        .unwrap();
    db
}

fn tombstones(conn: &Connection) -> Vec<String> {
    let mut stmt = conn
        .prepare(
            "SELECT kind || ':' || account_id || ':' || key || ':' || key2
             FROM local_sync_tombstones ORDER BY 1",
        )
        .unwrap();
    let rows = stmt
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<String>, _>>()
        .unwrap();
    rows
}

#[test]
fn v29_tombstones_record_direct_local_deletions_only() {
    let db = migrated_with_local_sync_fixture();
    let conn = db.writer();
    assert!(tombstones(conn).is_empty());

    conn.execute_batch("DELETE FROM article_tags WHERE article_id = 'art-2'")
        .unwrap();
    assert_eq!(tombstones(conn), ["article_tag::art-2:rust"]);

    conn.execute_batch("DELETE FROM tags WHERE id = 't1'")
        .unwrap();
    assert_eq!(
        tombstones(conn),
        [
            "article_tag::art-1:rust",
            "article_tag::art-2:rust",
            "tag::rust:"
        ],
        "deleting a tag records the links it takes with it, since the cascade fires after the tag is gone"
    );

    conn.execute_batch("DELETE FROM articles WHERE id = 'art-3'")
        .unwrap();
    assert_eq!(
        tombstones(conn).len(),
        3,
        "deleting an article must not tombstone its tag links"
    );

    conn.execute_batch("DELETE FROM folders WHERE id = 'f1'")
        .unwrap();
    conn.execute_batch("DELETE FROM accounts WHERE id = 'a2'")
        .unwrap();
    assert_eq!(
        tombstones(conn),
        [
            "article_tag::art-1:rust",
            "article_tag::art-2:rust",
            "folder:a1:tech:",
            "tag::rust:"
        ],
        "deleting an account must not leave tombstones for its folders"
    );
}

#[test]
fn v29_folder_rename_tombstones_the_old_name_and_recreating_it_clears_the_tombstone() {
    let db = migrated_with_local_sync_fixture();
    let conn = db.writer();

    conn.execute_batch("UPDATE folders SET name = 'Dev' WHERE id = 'f1'")
        .unwrap();
    assert_eq!(tombstones(conn), ["folder:a1:tech:"]);

    conn.execute_batch(
        "INSERT INTO folders (id, account_id, name, sort_order) VALUES ('f3', 'a1', 'tech', 5)",
    )
    .unwrap();
    assert!(tombstones(conn).is_empty());
}

#[test]
fn v29_recreating_a_tag_link_or_mute_keyword_clears_its_tombstone() {
    let db = migrated_with_local_sync_fixture();
    let conn = db.writer();
    conn.execute_batch(
        "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at)
         VALUES ('m1', ' Spam ', 'title', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
         DELETE FROM mute_keywords WHERE id = 'm1';
         DELETE FROM article_tags WHERE article_id = 'art-1' AND tag_id = 't1';",
    )
    .unwrap();
    assert_eq!(
        tombstones(conn),
        ["article_tag::art-1:rust", "mute_keyword::spam:title"]
    );

    conn.execute_batch(
        "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at)
         VALUES ('m2', 'SPAM', 'title', '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z');
         INSERT INTO article_tags (article_id, tag_id) VALUES ('art-1', 't1');",
    )
    .unwrap();
    assert!(tombstones(conn).is_empty());
}

#[test]
fn v29_triggers_record_nothing_while_the_apply_guard_is_active() {
    let db = migrated_with_local_sync_fixture();
    let conn = db.writer();
    conn.execute_batch(
        "UPDATE local_sync_apply_guard SET active = 1;
         UPDATE folders SET name = 'Dev', sort_order = 9 WHERE id = 'f1';
         INSERT INTO folders (id, account_id, name, sort_order) VALUES ('f3', 'a1', 'New', 5);
         DELETE FROM article_tags WHERE article_id = 'art-1';
         UPDATE feeds SET title = 'Renamed' WHERE id = 'feed-1';",
    )
    .unwrap();

    assert!(tombstones(conn).is_empty());
    let guarded_stamps: i64 = conn
        .query_row(
            "SELECT
               (SELECT COUNT(*) FROM folders WHERE id IN ('f1', 'f3') AND changed_at IS NOT NULL)
             + (SELECT COUNT(*) FROM feeds WHERE id = 'feed-1' AND changed_at IS NOT NULL)",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        guarded_stamps, 2,
        "only the pre-guard fixture inserts of f1 and feed-1 carry a stamp"
    );
}

#[test]
fn v29_stamps_only_real_value_changes_and_keeps_explicit_times() {
    let db = migrated_with_local_sync_fixture();
    let conn = db.writer();
    let feed_changed_at = |conn: &Connection| -> Option<String> {
        conn.query_row(
            "SELECT changed_at FROM feeds WHERE id = 'feed-1'",
            [],
            |row| row.get(0),
        )
        .unwrap()
    };
    let inserted_at = feed_changed_at(conn);
    assert!(
        inserted_at
            .as_deref()
            .is_some_and(|value| value.ends_with('Z')),
        "inserted feeds are stamped"
    );

    conn.execute_batch("UPDATE feeds SET title = title, unread_count = 5 WHERE id = 'feed-1'")
        .unwrap();
    assert_eq!(
        feed_changed_at(conn),
        inserted_at,
        "rewriting identical values is not a change"
    );

    conn.execute_batch(
        "UPDATE feeds SET changed_at = '2020-01-01T00:00:00.000Z' WHERE id = 'feed-1'",
    )
    .unwrap();
    conn.execute_batch("UPDATE feeds SET title = 'Renamed' WHERE id = 'feed-1'")
        .unwrap();
    assert!(feed_changed_at(conn).is_some_and(|value| value.as_str() > "2020-01-01T00:00:00.000Z"));

    conn.execute_batch(
        "UPDATE feeds SET title = 'Again', changed_at = '2020-05-06T07:08:09.123Z' WHERE id = 'feed-1'",
    )
    .unwrap();
    assert_eq!(
        feed_changed_at(conn).as_deref(),
        Some("2020-05-06T07:08:09.123Z")
    );
}

#[test]
fn v29_unsubscribing_a_feed_tombstones_its_url_and_resubscribing_keeps_it_below_the_new_change_time(
) {
    let db = migrated_with_local_sync_fixture();
    let conn = db.writer();

    conn.execute_batch("DELETE FROM feeds WHERE id = 'feed-1'")
        .unwrap();
    assert_eq!(tombstones(conn), ["feed:a1:https://example.com/1:"]);

    conn.execute_batch(
        "INSERT INTO feeds (id, account_id, title, url, site_url, reader_mode, web_preview_mode)
         VALUES ('feed-1b', 'a1', 'Feed', 'https://example.com/1', '', 'inherit', 'inherit')",
    )
    .unwrap();
    assert_eq!(
        tombstones(conn),
        ["feed:a1:https://example.com/1:"],
        "the tombstone stays: the live feed's change time supersedes it, and a failed subscription rolls back to it"
    );

    conn.execute_batch("DELETE FROM accounts WHERE id = 'a2'")
        .unwrap();
    assert_eq!(
        tombstones(conn).len(),
        1,
        "deleting an account must not leave tombstones for its feeds"
    );
}

#[test]
fn v29_tag_rename_restamps_the_article_links_whose_sync_identity_changed() {
    let db = migrated_with_local_sync_fixture();
    let conn = db.writer();
    conn.execute_batch(
        "UPDATE article_tags SET changed_at = '2020-01-01T00:00:00.000Z' WHERE tag_id = 't1';
         UPDATE article_tags SET changed_at = '2020-01-01T00:00:00.000Z' WHERE tag_id = 't2';
         UPDATE tags SET name = 'RUST' WHERE id = 't1';",
    )
    .unwrap();
    let stale_links = |conn: &Connection, tag_id: &str| -> i64 {
        conn.query_row(
            "SELECT COUNT(*) FROM article_tags
             WHERE tag_id = ?1 AND changed_at = '2020-01-01T00:00:00.000Z'",
            [tag_id],
            |row| row.get(0),
        )
        .unwrap()
    };
    assert_eq!(
        stale_links(conn, "t1"),
        2,
        "a case-only rename keeps the same sync identity"
    );

    conn.execute_batch("UPDATE tags SET name = 'Rustlang' WHERE id = 't1'")
        .unwrap();

    assert_eq!(stale_links(conn, "t1"), 0);
    assert_eq!(
        stale_links(conn, "t2"),
        1,
        "links of other tags are untouched"
    );
}

#[test]
fn v29_feed_url_change_restamps_only_the_article_times_that_were_recorded() {
    let db = migrated_with_local_sync_fixture();
    let conn = db.writer();
    conn.execute_batch(
        "UPDATE articles SET read_changed_at = '2020-01-01T00:00:00.000Z',
                             starred_changed_at = NULL
         WHERE id = 'art-1';
         UPDATE article_tags SET changed_at = '2020-01-01T00:00:00.000Z';
         UPDATE articles SET read_changed_at = '2020-01-01T00:00:00.000Z' WHERE id = 'art-3';
         UPDATE feeds SET url = 'https://example.com/moved' WHERE id = 'feed-1';",
    )
    .unwrap();

    let time = |sql: &str| -> Option<String> { conn.query_row(sql, [], |row| row.get(0)).unwrap() };
    assert!(
        time("SELECT read_changed_at FROM articles WHERE id = 'art-1'")
            .is_some_and(|value| value.as_str() > "2020-01-01T00:00:00.000Z")
    );
    assert_eq!(
        time("SELECT starred_changed_at FROM articles WHERE id = 'art-1'"),
        None,
        "a state never changed locally carries no intent to protect"
    );
    assert!(
        time("SELECT changed_at FROM article_tags WHERE article_id = 'art-1'")
            .is_some_and(|value| value.as_str() > "2020-01-01T00:00:00.000Z")
    );
    assert_eq!(
        time("SELECT read_changed_at FROM articles WHERE id = 'art-3'").as_deref(),
        Some("2020-01-01T00:00:00.000Z"),
        "articles of other feeds are untouched"
    );
}
