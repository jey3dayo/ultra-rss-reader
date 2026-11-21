export const STORAGE_KEYS = {
  theme: "ultra-rss:theme",
  commandHistory: "ultra-rss:command-history",
  sidebarExpandedFolders: "ultra-rss:sidebar-expanded-folders",
  startupSyncLastTriggeredAt: "ultra-rss:startup-sync-last-triggered-at",
  subscriptionReviewDecisions: "ultra-rss:subscription-review-decisions",
} as const;
export type StorageKeyName = keyof typeof STORAGE_KEYS;
export type StorageKey = (typeof STORAGE_KEYS)[StorageKeyName];

export type StorageKeySchemaPolicy =
  | "theme-preference"
  | "command-history-json"
  | "sidebar-expanded-folders-json"
  | "startup-sync-timestamp"
  | "subscription-review-decisions-json";
export type StorageKeyCleanupPolicy = "mirror-retained" | "user-clearable" | "startup-window-expiring";
export type StorageKeyOwner =
  | "preferences-store"
  | "command-palette-history"
  | "sidebar-startup-folder-expansion"
  | "startup-sync-storage"
  | "subscription-review-store";

export const STORAGE_KEY_POLICIES = {
  theme: {
    owner: "preferences-store",
    schema: "theme-preference",
    cleanup: "mirror-retained",
  },
  commandHistory: {
    owner: "command-palette-history",
    schema: "command-history-json",
    cleanup: "user-clearable",
  },
  sidebarExpandedFolders: {
    owner: "sidebar-startup-folder-expansion",
    schema: "sidebar-expanded-folders-json",
    cleanup: "user-clearable",
  },
  startupSyncLastTriggeredAt: {
    owner: "startup-sync-storage",
    schema: "startup-sync-timestamp",
    cleanup: "startup-window-expiring",
  },
  subscriptionReviewDecisions: {
    owner: "subscription-review-store",
    schema: "subscription-review-decisions-json",
    cleanup: "user-clearable",
  },
} as const satisfies Record<
  StorageKeyName,
  {
    owner: StorageKeyOwner;
    schema: StorageKeySchemaPolicy;
    cleanup: StorageKeyCleanupPolicy;
  }
>;

export const LEGACY_STORAGE_KEYS = {
  startupSyncLastTriggeredAt: "startup-sync-last-triggered-at",
} as const;
type LegacyStorageKeyName = keyof typeof LEGACY_STORAGE_KEYS;
export type LegacyStorageKey = (typeof LEGACY_STORAGE_KEYS)[LegacyStorageKeyName];

export const SETTINGS_DATA_RESET_STORAGE_CLEANUP_POLICIES = [
  "user-clearable",
  "startup-window-expiring",
] as const satisfies readonly StorageKeyCleanupPolicy[];

export const PRIVATE_DATA_EXPORT_STORAGE_CLEANUP_POLICIES = [
  "mirror-retained",
  "user-clearable",
  "startup-window-expiring",
] as const satisfies readonly StorageKeyCleanupPolicy[];

function storageKeysForCleanupPolicies(cleanupPolicies: readonly StorageKeyCleanupPolicy[]): readonly StorageKey[] {
  const cleanupPolicySet = new Set<StorageKeyCleanupPolicy>(cleanupPolicies);

  return Object.entries(STORAGE_KEYS).flatMap(([name, key]) =>
    cleanupPolicySet.has(STORAGE_KEY_POLICIES[name as StorageKeyName].cleanup) ? [key] : [],
  );
}

export const STORAGE_CLEANUP_POLICY_CONNECTIONS = {
  settingsDataResetKeys: storageKeysForCleanupPolicies(SETTINGS_DATA_RESET_STORAGE_CLEANUP_POLICIES),
  privateDataExportKeys: storageKeysForCleanupPolicies(PRIVATE_DATA_EXPORT_STORAGE_CLEANUP_POLICIES),
} as const satisfies {
  settingsDataResetKeys: readonly StorageKey[];
  privateDataExportKeys: readonly StorageKey[];
};

export const MAX_COMMAND_HISTORY = 10;
export const MAX_COMMAND_HISTORY_ENTRY_LENGTH = 200;
export const MAX_COMMAND_HISTORY_STORAGE_LENGTH = 10_000;
export const MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS = 100;
export const MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT = 500;
export const MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_STORAGE_LENGTH = 2_000_000;
export const SIDEBAR_EXPANDED_FOLDERS_STORAGE_VERSION = 1;
export const MAX_STORED_SUBSCRIPTION_REVIEW_ACCOUNTS = 100;
export const MAX_STORED_SUBSCRIPTION_REVIEW_FEEDS_PER_ACCOUNT = 500;
export const MAX_STORED_SUBSCRIPTION_REVIEW_STORAGE_LENGTH = 2_000_000;
export const SUBSCRIPTION_REVIEW_DECISIONS_STORAGE_VERSION = 1;
