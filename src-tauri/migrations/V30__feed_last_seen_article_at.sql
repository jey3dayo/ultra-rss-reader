-- Feeds remember the newest article publication time ever observed for them.
-- Unlike the articles table, this value survives retention purges of read
-- articles, so subscription review can still tell a feed that stopped
-- publishing apart from a feed whose articles were never fetched.
-- Existing rows are backfilled from the articles still stored locally; feeds
-- whose articles were already purged stay NULL until a later sync observes
-- an article again.
ALTER TABLE feeds ADD COLUMN last_seen_article_at TEXT;

UPDATE feeds
SET last_seen_article_at = (
    SELECT MAX(a.published_at)
    FROM articles a
    WHERE a.feed_id = feeds.id
)
WHERE EXISTS (SELECT 1 FROM articles a WHERE a.feed_id = feeds.id);

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (30);
