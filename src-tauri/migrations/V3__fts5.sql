CREATE VIRTUAL TABLE articles_fts USING fts5(
  title,
  content_sanitized,
  content='articles',
  content_rowid='rowid'
);

-- Populate from existing data
INSERT INTO articles_fts(rowid, title, content_sanitized)
  SELECT rowid, title, content_sanitized FROM articles;

-- Triggers to keep FTS index in sync
CREATE TRIGGER articles_ai AFTER INSERT ON articles BEGIN
  INSERT INTO articles_fts(rowid, title, content_sanitized)
    VALUES (new.rowid, new.title, new.content_sanitized);
END;

CREATE TRIGGER articles_ad AFTER DELETE ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, title, content_sanitized)
    VALUES ('delete', old.rowid, old.title, old.content_sanitized);
END;

CREATE TRIGGER articles_au AFTER UPDATE ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, title, content_sanitized)
    VALUES ('delete', old.rowid, old.title, old.content_sanitized);
  INSERT INTO articles_fts(rowid, title, content_sanitized)
    VALUES (new.rowid, new.title, new.content_sanitized);
END;

DELETE FROM schema_version WHERE version < 3;
INSERT OR REPLACE INTO schema_version VALUES (3);
