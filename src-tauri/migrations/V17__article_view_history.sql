CREATE TABLE article_view_history (
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    viewed_at TEXT NOT NULL,
    PRIMARY KEY (account_id, article_id)
);

CREATE INDEX idx_article_view_history_account_viewed_at
    ON article_view_history(account_id, viewed_at DESC);

DELETE FROM schema_version;
INSERT INTO schema_version VALUES (17);
