CREATE TABLE preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

UPDATE schema_version SET version = 2 WHERE version = 1;
INSERT OR IGNORE INTO schema_version VALUES (2);
