export const STORAGE_KEYS = {
  theme: "ultra-rss:theme",
  commandHistory: "ultra-rss:command-history",
  sidebarExpandedFolders: "ultra-rss:sidebar-expanded-folders",
  startupSyncLastTriggeredAt: "ultra-rss:startup-sync-last-triggered-at",
} as const;
export type StorageKeyName = keyof typeof STORAGE_KEYS;
export type StorageKey = (typeof STORAGE_KEYS)[StorageKeyName];

export const LEGACY_STORAGE_KEYS = {
  startupSyncLastTriggeredAt: "startup-sync-last-triggered-at",
} as const;
export type LegacyStorageKeyName = keyof typeof LEGACY_STORAGE_KEYS;
export type LegacyStorageKey = (typeof LEGACY_STORAGE_KEYS)[LegacyStorageKeyName];

export const MAX_COMMAND_HISTORY = 10;
export const MAX_COMMAND_HISTORY_ENTRY_LENGTH = 200;
export const MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS = 100;
export const MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT = 500;
