DELETE FROM accounts WHERE kind = 'Inoreader';

DELETE FROM preferences
WHERE key IN ('inoreader_app_id', 'inoreader_app_key');

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (15);
