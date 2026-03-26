CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    server_url TEXT,
    username TEXT,
    sync_interval_secs INTEGER NOT NULL DEFAULT 3600,
    sync_on_wake INTEGER NOT NULL DEFAULT 0,
    keep_read_items_days INTEGER NOT NULL DEFAULT 30
);

CREATE TABLE folders (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    remote_id TEXT,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE(account_id, remote_id)
);

CREATE TABLE feeds (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
    remote_id TEXT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    site_url TEXT NOT NULL DEFAULT '',
    icon BLOB,
    unread_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(account_id, remote_id),
    UNIQUE(account_id, url)
);

CREATE TABLE articles (
    id TEXT PRIMARY KEY,
    feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    remote_id TEXT,
    title TEXT NOT NULL,
    content_raw TEXT NOT NULL DEFAULT '',
    content_sanitized TEXT NOT NULL DEFAULT '',
    sanitizer_version INTEGER NOT NULL DEFAULT 1,
    summary TEXT,
    url TEXT,
    author TEXT,
    published_at TEXT NOT NULL,
    thumbnail TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    is_starred INTEGER NOT NULL DEFAULT 0,
    fetched_at TEXT NOT NULL
);

CREATE TABLE sync_state (
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    scope_key TEXT NOT NULL DEFAULT '',
    continuation TEXT,
    etag TEXT,
    last_modified TEXT,
    last_success_at TEXT,
    last_error TEXT,
    error_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TEXT,
    PRIMARY KEY (account_id, scope_key)
);

CREATE TABLE pending_mutations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    mutation_type TEXT NOT NULL,
    remote_entry_id TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE feed_http_cache (
    feed_id TEXT PRIMARY KEY REFERENCES feeds(id) ON DELETE CASCADE,
    etag TEXT,
    last_modified TEXT,
    last_fetched_at TEXT NOT NULL
);

CREATE INDEX idx_articles_feed_id ON articles(feed_id);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_is_read ON articles(feed_id, is_read);
CREATE INDEX idx_articles_is_starred ON articles(is_starred) WHERE is_starred = 1;
CREATE INDEX idx_articles_remote_id ON articles(remote_id);
CREATE INDEX idx_feeds_remote_id ON feeds(account_id, remote_id);
CREATE INDEX idx_folders_remote_id ON folders(account_id, remote_id);

CREATE TABLE schema_version (version INTEGER NOT NULL);
INSERT INTO schema_version VALUES (1);
