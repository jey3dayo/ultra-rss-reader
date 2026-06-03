CREATE INDEX idx_articles_feed_published_fetched_id
    ON articles(feed_id, published_at DESC, fetched_at DESC, id DESC);

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (19);
