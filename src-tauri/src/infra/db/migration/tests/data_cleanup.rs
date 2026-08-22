use rusqlite::params;

use super::super::consts::*;
use super::super::repairs::*;
use super::super::*;
use super::{migrate_to_v19, open_in_memory};

#[test]
fn v23_resets_only_freshrss_accounts_with_empty_provider_feeds() {
    let conn = open_in_memory();
    migrate_to_v19(&conn);
    apply_v20_article_account_ordered_indexes(&conn).unwrap();
    conn.execute_batch(MIGRATION_V21).unwrap();
    conn.execute_batch(MIGRATION_V22).unwrap();

    conn.execute(
        "INSERT INTO accounts (id, kind, name) VALUES (?1, 'FreshRss', 'FreshRSS')",
        params!["freshrss-account"],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO accounts (id, kind, name) VALUES (?1, 'Local', 'Local')",
        params!["local-account"],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO accounts (id, kind, name) VALUES (?1, 'FreshRss', 'Healthy FreshRSS')",
        params!["healthy-freshrss-account"],
    )
    .unwrap();

    conn.execute(
        "INSERT INTO feeds (id, account_id, remote_id, title, url)
           VALUES (?1, ?2, 'feed/empty', 'Empty FreshRSS', 'https://example.com/empty')",
        params!["empty-freshrss-feed", "freshrss-account"],
    )
    .unwrap();
    conn.execute(
          "INSERT INTO feeds (id, account_id, remote_id, title, url)
           VALUES (?1, ?2, 'feed/with-article', 'FreshRSS with article', 'https://example.com/article')",
          params!["article-freshrss-feed", "freshrss-account"],
      )
      .unwrap();
    conn.execute(
          "INSERT INTO feeds (id, account_id, remote_id, title, url)
           VALUES (?1, ?2, 'feed/local-kind', 'Local account remote feed', 'https://example.com/local-kind')",
          params!["local-kind-feed", "local-account"],
      )
      .unwrap();
    conn.execute(
        "INSERT INTO feeds (id, account_id, title, url)
           VALUES (?1, ?2, 'FreshRSS local feed', 'https://example.com/local')",
        params!["local-freshrss-feed", "freshrss-account"],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO feeds (id, account_id, remote_id, title, url)
           VALUES (?1, ?2, 'feed/healthy', 'Healthy FreshRSS', 'https://example.com/healthy')",
        params!["healthy-freshrss-feed", "healthy-freshrss-account"],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO articles (
              id, account_id, feed_id, title, content_raw, content_sanitized,
              sanitizer_version, published_at, fetched_at
           ) VALUES (
              'saved-article', 'freshrss-account', 'article-freshrss-feed',
              'Saved article', '', '', 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
           )",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO articles (
              id, account_id, feed_id, title, content_raw, content_sanitized,
              sanitizer_version, published_at, fetched_at
           ) VALUES (
              'healthy-saved-article', 'healthy-freshrss-account', 'healthy-freshrss-feed',
              'Healthy saved article', '', '', 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
           )",
        [],
    )
    .unwrap();

    for (account_id, scope_key) in [
        ("freshrss-account", "feed:feed/empty"),
        ("freshrss-account", "account:greader:all"),
        ("freshrss-account", "account:greader:remote-state-full"),
        ("freshrss-account", "feed:feed/with-article"),
        ("local-account", "feed:feed/local-kind"),
        ("local-account", "account:greader:all"),
        ("freshrss-account", "local_feed:https://example.com/local"),
        ("healthy-freshrss-account", "account:greader:all"),
        ("healthy-freshrss-account", "feed:feed/healthy"),
    ] {
        conn.execute(
            "INSERT INTO sync_state (account_id, scope_key, continuation)
               VALUES (?1, ?2, 'cursor')",
            params![account_id, scope_key],
        )
        .unwrap();
    }

    let mut conn = conn;
    let result = run_migrations(&mut conn).unwrap();

    assert_eq!(result.from_version, 22);
    assert_eq!(result.to_version, LATEST_VERSION);
    assert_eq!(get_schema_version(&conn), LATEST_VERSION);

    let sync_state_count = |account_id: &str, scope_key: &str| {
        conn.query_row(
            "SELECT COUNT(*) FROM sync_state WHERE account_id = ?1 AND scope_key = ?2",
            params![account_id, scope_key],
            |row| row.get::<_, i64>(0),
        )
        .unwrap()
    };

    assert_eq!(sync_state_count("freshrss-account", "feed:feed/empty"), 0);
    assert_eq!(
        sync_state_count("freshrss-account", "account:greader:all"),
        0
    );
    assert_eq!(
        sync_state_count("freshrss-account", "account:greader:remote-state-full"),
        1
    );
    assert_eq!(
        sync_state_count("freshrss-account", "feed:feed/with-article"),
        1
    );
    assert_eq!(sync_state_count("local-account", "feed:feed/local-kind"), 1);
    assert_eq!(sync_state_count("local-account", "account:greader:all"), 1);
    assert_eq!(
        sync_state_count("freshrss-account", "local_feed:https://example.com/local"),
        1
    );
    assert_eq!(
        sync_state_count("healthy-freshrss-account", "account:greader:all"),
        1
    );
    assert_eq!(
        sync_state_count("healthy-freshrss-account", "feed:feed/healthy"),
        1
    );
}
