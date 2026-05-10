ALTER TABLE feeds ADD COLUMN reader_mode TEXT NOT NULL DEFAULT 'inherit' CHECK (reader_mode IN ('inherit', 'on', 'off'));
ALTER TABLE feeds ADD COLUMN web_preview_mode TEXT NOT NULL DEFAULT 'inherit' CHECK (web_preview_mode IN ('inherit', 'on', 'off'));

UPDATE feeds
SET
  reader_mode = CASE
    WHEN display_mode = 'normal' THEN 'on'
    WHEN display_mode = 'widescreen' THEN 'on'
    ELSE 'inherit'
  END,
  web_preview_mode = CASE
    WHEN display_mode = 'normal' THEN 'off'
    WHEN display_mode = 'widescreen' THEN 'on'
    ELSE 'inherit'
  END;

INSERT INTO schema_version (version) VALUES (8);
