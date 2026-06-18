UPDATE articles
SET account_id = (
    SELECT feeds.account_id
    FROM feeds
    WHERE feeds.id = articles.feed_id
)
WHERE EXISTS (
      SELECT 1
      FROM feeds
      WHERE feeds.id = articles.feed_id
  )
  AND (
      account_id IS NULL
      OR account_id != (
          SELECT feeds.account_id
          FROM feeds
          WHERE feeds.id = articles.feed_id
      )
  );

CREATE TRIGGER IF NOT EXISTS articles_set_account_id_after_insert
AFTER INSERT ON articles
FOR EACH ROW
WHEN NEW.account_id IS NULL OR NEW.account_id != (
    SELECT feeds.account_id
    FROM feeds
    WHERE feeds.id = NEW.feed_id
)
BEGIN
    UPDATE articles
    SET account_id = (
        SELECT feeds.account_id
        FROM feeds
        WHERE feeds.id = NEW.feed_id
    )
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS articles_sync_account_id_after_feed_change
AFTER UPDATE OF feed_id ON articles
FOR EACH ROW
WHEN NEW.account_id IS NULL OR NEW.account_id != (
    SELECT feeds.account_id
    FROM feeds
    WHERE feeds.id = NEW.feed_id
)
BEGIN
    UPDATE articles
    SET account_id = (
        SELECT feeds.account_id
        FROM feeds
        WHERE feeds.id = NEW.feed_id
    )
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS articles_sync_account_id_after_feed_account_change
AFTER UPDATE OF account_id ON feeds
FOR EACH ROW
WHEN NEW.account_id != OLD.account_id
BEGIN
    UPDATE articles
    SET account_id = NEW.account_id
    WHERE feed_id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_articles_account_published_fetched_id
    ON articles(account_id, published_at DESC, fetched_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_articles_account_unread_published_fetched_id
    ON articles(account_id, is_read, published_at DESC, fetched_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_articles_account_starred_published_fetched_id
    ON articles(account_id, is_starred, published_at DESC, fetched_at DESC, id DESC)
    WHERE is_starred = 1;

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (20);
