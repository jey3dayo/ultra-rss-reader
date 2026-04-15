UPDATE tags
SET color = CASE lower(color)
  WHEN '#ef4444' THEN '#cf7868'
  WHEN '#f97316' THEN '#c88d62'
  WHEN '#eab308' THEN '#b59a64'
  WHEN '#22c55e' THEN '#5f9670'
  WHEN '#06b6d4' THEN '#5f9695'
  WHEN '#3b82f6' THEN '#6f8eb8'
  WHEN '#8b5cf6' THEN '#8c79b2'
  WHEN '#ec4899' THEN '#b97a90'
  WHEN '#6b7280' THEN '#726d66'
  ELSE color
END
WHERE color IS NOT NULL;

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (13);
