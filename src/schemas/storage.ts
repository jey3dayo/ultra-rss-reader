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

const CONTROL_CHARACTER_RANGES = "\\u0000-\\u001F\\u007F-\\u009F";
const CONTROL_CHARACTERS_PATTERN = new RegExp(`[${CONTROL_CHARACTER_RANGES}]`, "g");

function normalizeStoredIdentity(value: string): string {
  return value.replace(CONTROL_CHARACTERS_PATTERN, "").trim();
}

function truncateAtGraphemeBoundary(value: string, maxCodeUnits: number): string {
  if (value.length <= maxCodeUnits) {
    return value;
  }

  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let truncated = "";

  for (const { segment } of segmenter.segment(value)) {
    if (truncated.length + segment.length > maxCodeUnits) {
      break;
    }
    truncated += segment;
  }

  return truncated;
}

function normalizeCommandHistoryEntry(value: string): string {
  return truncateAtGraphemeBoundary(normalizeStoredIdentity(value), MAX_COMMAND_HISTORY_ENTRY_LENGTH);
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  .unknown()
  .refine(isUnknownRecord)
  .transform((parsed): Record<string, string[]> => {
    const expandedFolders: Record<string, string[]> = Object.create(null);
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

      Object.defineProperty(expandedFolders, normalizedAccountId, {
        configurable: true,
        enumerable: true,
        value: normalizedFolderIds,
        writable: true,
      });
      accountCount += 1;

      if (accountCount >= MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS) {
        break;
      }
    }

    return expandedFolders;
  });

export type StoredSidebarExpandedFolders = z.output<typeof StoredSidebarExpandedFoldersSchema>;

const DatabaseRestoreStorageReconciliationPolicySchemaBase = z
  .object({
    removeKeys: z.tuple([
      z.literal(STORAGE_KEYS.commandHistory),
      z.literal(STORAGE_KEYS.sidebarExpandedFolders),
      z.literal(STORAGE_KEYS.startupSyncLastTriggeredAt),
    ]),
    retainKeys: z.tuple([z.literal(STORAGE_KEYS.theme)]),
  })
  .strict();

export const DATABASE_RESTORE_STORAGE_RECONCILIATION_POLICY: z.input<
  typeof DatabaseRestoreStorageReconciliationPolicySchemaBase
> = {
  removeKeys: [
    STORAGE_KEYS.commandHistory,
    STORAGE_KEYS.sidebarExpandedFolders,
    STORAGE_KEYS.startupSyncLastTriggeredAt,
  ],
  retainKeys: [STORAGE_KEYS.theme],
};

export const DatabaseRestoreStorageReconciliationPolicySchema =
  DatabaseRestoreStorageReconciliationPolicySchemaBase.default(DATABASE_RESTORE_STORAGE_RECONCILIATION_POLICY);

export type DatabaseRestoreStorageReconciliationPolicy = z.output<
  typeof DatabaseRestoreStorageReconciliationPolicySchema
>;

export const STORAGE_SCHEMA_CAPACITY_FIXTURES = {
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
