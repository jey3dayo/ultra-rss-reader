CREATE TABLE preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

DELETE FROM schema_version WHERE version < 2;
INSERT OR REPLACE INTO schema_version VALUES (2);
