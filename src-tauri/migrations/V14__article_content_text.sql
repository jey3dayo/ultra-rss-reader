ALTER TABLE articles ADD COLUMN content_text TEXT NOT NULL DEFAULT '';

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (14);
