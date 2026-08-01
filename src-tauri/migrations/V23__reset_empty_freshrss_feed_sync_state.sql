-- destructive-migration: resets FreshRSS account and feed cursors when retention purged every article.
DELETE FROM sync_state
WHERE scope_key = 'account:greader:all'
  AND EXISTS (
      SELECT 1
      FROM feeds f
      JOIN accounts a ON a.id = f.account_id
      WHERE f.account_id = sync_state.account_id
        AND a.kind = 'FreshRss'
        AND f.remote_id LIKE 'feed/%'
        AND NOT EXISTS (
            SELECT 1
            FROM articles article
            WHERE article.feed_id = f.id
        )
  );

DELETE FROM sync_state
WHERE EXISTS (
    SELECT 1
    FROM feeds f
    JOIN accounts a ON a.id = f.account_id
    WHERE f.account_id = sync_state.account_id
      AND sync_state.scope_key = 'feed:' || f.remote_id
      AND a.kind = 'FreshRss'
      AND f.remote_id LIKE 'feed/%'
      AND NOT EXISTS (
          SELECT 1
          FROM articles article
          WHERE article.feed_id = f.id
      )
);

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (23);
