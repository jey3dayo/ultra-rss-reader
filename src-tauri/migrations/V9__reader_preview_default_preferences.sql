INSERT OR IGNORE INTO preferences (key, value)
SELECT 'reader_mode_default', 'true'
WHERE EXISTS (SELECT 1 FROM preferences WHERE key = 'reader_view');

INSERT OR IGNORE INTO preferences (key, value)
SELECT
  'web_preview_mode_default',
  CASE
    WHEN value IN ('widescreen', 'on', 'fullscreen') THEN 'true'
    ELSE 'false'
  END
FROM preferences
WHERE key = 'reader_view';

DELETE FROM preferences WHERE key = 'reader_view';

DELETE FROM schema_version WHERE version < 9;
INSERT OR REPLACE INTO schema_version VALUES (9);
