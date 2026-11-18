-- Activity combines final stored article dates with observations retained after deletion or probing.
ALTER TABLE feeds ADD COLUMN last_seen_article_at TEXT;
ALTER TABLE feeds ADD COLUMN last_seen_unstored_article_at TEXT;
ALTER TABLE feeds ADD COLUMN last_seen_article_probe_completed INTEGER NOT NULL DEFAULT 0;

UPDATE feeds
SET last_seen_article_at = (
    SELECT MAX(a.published_at)
    FROM articles a
    WHERE a.feed_id = feeds.id
)
WHERE EXISTS (SELECT 1 FROM articles a WHERE a.feed_id = feeds.id);

CREATE TRIGGER articles_retain_activity_after_delete
AFTER DELETE ON articles
FOR EACH ROW
BEGIN
    UPDATE feeds
    SET last_seen_unstored_article_at = OLD.published_at
    WHERE id = OLD.feed_id
      AND (last_seen_unstored_article_at IS NULL
           OR julianday(last_seen_unstored_article_at) < julianday(OLD.published_at));
END;

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (30);
