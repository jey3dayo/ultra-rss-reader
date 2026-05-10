import { describe, expect, it } from "vitest";
import {
  MAX_COMMAND_HISTORY,
  MAX_COMMAND_HISTORY_ENTRY_LENGTH,
  MAX_COMMAND_HISTORY_STORAGE_LENGTH,
  MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS,
  MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT,
  MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_STORAGE_LENGTH,
  PRIVATE_DATA_EXPORT_STORAGE_CLEANUP_POLICIES,
  SETTINGS_DATA_RESET_STORAGE_CLEANUP_POLICIES,
  STORAGE_CLEANUP_POLICY_CONNECTIONS,
  STORAGE_KEY_POLICIES,
  STORAGE_KEYS,
} from "@/constants/storage";
import { STORAGE_SCHEMA_CAPACITY_FIXTURES } from "@/schemas/storage";

describe("storage constants", () => {
  it("keeps writable localStorage keys under the ultra-rss prefix", () => {
    const writableStorageKeys = Object.values(STORAGE_KEYS);

    expect(writableStorageKeys).not.toHaveLength(0);
    expect(writableStorageKeys.every((key) => key.startsWith("ultra-rss:"))).toBe(true);
  });

  it("keeps every writable localStorage key assigned to a schema owner and cleanup policy", () => {
    const storageKeyNames = Object.keys(STORAGE_KEYS);

    expect(Object.keys(STORAGE_KEY_POLICIES)).toEqual(storageKeyNames);
    expect(Object.values(STORAGE_KEY_POLICIES)).toEqual([
      {
        owner: "preferences-store",
        schema: "theme-preference",
        cleanup: "mirror-retained",
      },
      {
        owner: "command-palette-history",
        schema: "command-history-json",
        cleanup: "user-clearable",
      },
      {
        owner: "sidebar-startup-folder-expansion",
        schema: "sidebar-expanded-folders-json",
        cleanup: "user-clearable",
      },
      {
        owner: "startup-sync-storage",
        schema: "startup-sync-timestamp",
        cleanup: "startup-window-expiring",
      },
    ]);
  });

  it("connects cleanup policy buckets to settings data reset and private data export", () => {
    expect(SETTINGS_DATA_RESET_STORAGE_CLEANUP_POLICIES).toEqual(["user-clearable", "startup-window-expiring"]);
    expect(PRIVATE_DATA_EXPORT_STORAGE_CLEANUP_POLICIES).toEqual([
      "mirror-retained",
      "user-clearable",
      "startup-window-expiring",
    ]);
    expect(STORAGE_CLEANUP_POLICY_CONNECTIONS).toEqual({
      settingsDataResetKeys: [
        STORAGE_KEYS.commandHistory,
        STORAGE_KEYS.sidebarExpandedFolders,
        STORAGE_KEYS.startupSyncLastTriggeredAt,
      ],
      privateDataExportKeys: [
        STORAGE_KEYS.theme,
        STORAGE_KEYS.commandHistory,
        STORAGE_KEYS.sidebarExpandedFolders,
        STORAGE_KEYS.startupSyncLastTriggeredAt,
      ],
    });
  });

  it("keeps storage normalization limits positive and bounded", () => {
    expect(MAX_COMMAND_HISTORY).toBeGreaterThan(0);
    expect(MAX_COMMAND_HISTORY_ENTRY_LENGTH).toBeGreaterThan(0);
    expect(MAX_COMMAND_HISTORY_STORAGE_LENGTH).toBeGreaterThan(MAX_COMMAND_HISTORY * MAX_COMMAND_HISTORY_ENTRY_LENGTH);
    expect(MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS).toBeGreaterThan(0);
    expect(MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT).toBeGreaterThan(0);
    expect(MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_STORAGE_LENGTH).toBeGreaterThan(
      MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS * MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT,
    );
  });

  it("documents storage schema entry and raw JSON caps in fixture form", () => {
    expect(STORAGE_SCHEMA_CAPACITY_FIXTURES).toEqual({
      commandHistory: {
        storageKey: STORAGE_KEYS.commandHistory,
        schemaName: "CommandHistoryStorageSchema",
        entryCountCap: MAX_COMMAND_HISTORY,
        entryLengthCap: MAX_COMMAND_HISTORY_ENTRY_LENGTH,
        rawJsonByteCap: MAX_COMMAND_HISTORY_STORAGE_LENGTH,
        unitPolicy: {
          entryCountCap: "entries",
          entryLengthCap:
            "UTF-16 code units after control-character stripping and trimming, truncated at grapheme boundaries",
          rawJsonByteCap: "JSON string length before parsing",
        },
      },
      sidebarExpandedFolders: {
        storageKey: STORAGE_KEYS.sidebarExpandedFolders,
        schemaName: "StoredSidebarExpandedFoldersSchema",
        accountEntryCountCap: MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS,
        folderEntryCountCap: MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT,
        rawJsonByteCap: MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_STORAGE_LENGTH,
        unitPolicy: {
          accountEntryCountCap: "account map entries after account id normalization",
          folderEntryCountCap: "folder id entries per account after folder id normalization",
          rawJsonByteCap: "JSON string length before parsing",
          controlCharacterPolicy: "strip C0, DEL, and C1 controls from account and folder ids before trimming",
          accountPruningPriority:
            "schema preserves insertion order and caps after normalization; storage writes insert the active account first before stale accounts",
        },
      },
    });
  });
});
