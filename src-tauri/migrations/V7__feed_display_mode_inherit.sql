UPDATE feeds
SET display_mode = 'inherit'
WHERE display_mode = 'normal';

INSERT INTO schema_version VALUES (7);
