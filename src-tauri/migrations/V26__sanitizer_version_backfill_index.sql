-- find_by_sanitizer_version_below() filters on `sanitizer_version < ?` and
-- orders by (sanitizer_version, fetched_at, id) with no feed_id/account_id
-- predicate, so a composite index matching that exact clause shape lets
-- SQLite satisfy both the WHERE and ORDER BY without a full table scan or a
-- separate sort step.
CREATE INDEX IF NOT EXISTS idx_articles_sanitizer_version_fetched_id
    ON articles(sanitizer_version, fetched_at, id);

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (26);
