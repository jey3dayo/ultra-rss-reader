import { z } from "zod";
import {
  MAX_COMMAND_HISTORY,
  MAX_COMMAND_HISTORY_ENTRY_LENGTH,
  MAX_COMMAND_HISTORY_STORAGE_LENGTH,
  MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS,
  MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT,
  MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_STORAGE_LENGTH,
  STORAGE_KEYS,
} from "@/constants/storage";

const CONTROL_CHARACTER_RANGES = "\\u0000-\\u001F\\u007F";
const CONTROL_CHARACTERS_PATTERN = new RegExp(`[${CONTROL_CHARACTER_RANGES}]`, "g");

function normalizeStoredIdentity(value: string): string {
  return value.replace(CONTROL_CHARACTERS_PATTERN, "").trim();
}

function normalizeCommandHistoryEntry(value: string): string {
  return normalizeStoredIdentity(value).slice(0, MAX_COMMAND_HISTORY_ENTRY_LENGTH);
}

function collectNormalizedUniqueStrings(
  values: readonly unknown[],
  normalize: (value: string) => string,
  maxEntries: number,
): string[] {
  const seen = new Set<string>();
  const entries: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const normalizedValue = normalize(value);
    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    entries.push(normalizedValue);

    if (entries.length >= maxEntries) {
      break;
    }
  }

  return entries;
}

export const CommandHistoryStorageSchema = z
  .array(z.unknown())
  .transform((items) => collectNormalizedUniqueStrings(items, normalizeCommandHistoryEntry, MAX_COMMAND_HISTORY));

export type CommandHistoryStorage = z.output<typeof CommandHistoryStorageSchema>;

export const StoredSidebarExpandedFoldersSchema = z
  .record(z.string(), z.unknown())
  .transform((parsed): Record<string, string[]> => {
    const expandedFolders: Record<string, string[]> = {};
    let accountCount = 0;

    for (const [accountId, folderIds] of Object.entries(parsed)) {
      const normalizedAccountId = normalizeStoredIdentity(accountId);
      if (!normalizedAccountId || !Array.isArray(folderIds)) {
        continue;
      }

      const normalizedFolderIds = collectNormalizedUniqueStrings(
        folderIds,
        normalizeStoredIdentity,
        MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT,
      );
      if (normalizedFolderIds.length === 0) {
        continue;
      }

      expandedFolders[normalizedAccountId] = normalizedFolderIds;
      accountCount += 1;

      if (accountCount >= MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS) {
        break;
      }
    }

    return expandedFolders;
  });

export type StoredSidebarExpandedFolders = z.output<typeof StoredSidebarExpandedFoldersSchema>;

export const STORAGE_SCHEMA_CAPACITY_FIXTURES = {
  commandHistory: {
    storageKey: STORAGE_KEYS.commandHistory,
    schemaName: "CommandHistoryStorageSchema",
    entryCountCap: MAX_COMMAND_HISTORY,
    entryLengthCap: MAX_COMMAND_HISTORY_ENTRY_LENGTH,
    rawJsonByteCap: MAX_COMMAND_HISTORY_STORAGE_LENGTH,
    unitPolicy: {
      entryCountCap: "entries",
      entryLengthCap: "UTF-16 code units after control-character stripping and trimming",
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
    },
  },
} as const;

const StorageKeySchema = z.enum([
  STORAGE_KEYS.theme,
  STORAGE_KEYS.commandHistory,
  STORAGE_KEYS.sidebarExpandedFolders,
  STORAGE_KEYS.startupSyncLastTriggeredAt,
]);

export const StorageCleanupPolicyConnectionsSchema = z.object({
  settingsDataResetKeys: z.array(StorageKeySchema).readonly(),
  privateDataExportKeys: z.array(StorageKeySchema).readonly(),
});

export type StorageCleanupPolicyConnections = z.output<typeof StorageCleanupPolicyConnectionsSchema>;
