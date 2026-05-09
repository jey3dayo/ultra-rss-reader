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

export const MAX_COMMAND_HISTORY = 10;
