CREATE TABLE IF NOT EXISTS mute_keywords (
  id TEXT PRIMARY KEY,
  keyword TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('title', 'body', 'title_and_body')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mute_keywords_created_at
  ON mute_keywords(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mute_keywords_normalized_keyword_scope
  ON mute_keywords(lower(trim(keyword)), scope);

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (12);
