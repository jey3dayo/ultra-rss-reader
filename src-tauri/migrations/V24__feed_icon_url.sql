ALTER TABLE feeds ADD COLUMN icon_url TEXT;

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (24);
