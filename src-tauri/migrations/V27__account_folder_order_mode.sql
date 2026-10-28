ALTER TABLE accounts ADD COLUMN folder_order_mode TEXT NOT NULL DEFAULT 'name' CHECK (folder_order_mode IN ('name', 'manual'));
