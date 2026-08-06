import * as v from "valibot";
import {
  MAX_COMMAND_HISTORY,
  MAX_COMMAND_HISTORY_ENTRY_LENGTH,
  MAX_COMMAND_HISTORY_STORAGE_LENGTH,
  MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS,
  MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT,
  MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_STORAGE_LENGTH,
  SIDEBAR_EXPANDED_FOLDERS_STORAGE_VERSION,
  STORAGE_KEYS,
} from "@/constants/storage";
import * as s from "@/schemas/validation";

const CONTROL_CHARACTER_RANGES = "\\u0000-\\u001F\\u007F-\\u009F";
const CONTROL_CHARACTERS_PATTERN = new RegExp(`[${CONTROL_CHARACTER_RANGES}]`, "g");
const storageGraphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function normalizeStoredIdentity(value: string): string {
  return value.replace(CONTROL_CHARACTERS_PATTERN, "").trim();
}

function truncateAtGraphemeBoundary(value: string, maxCodeUnits: number): string {
  if (value.length <= maxCodeUnits) {
    return value;
  }

  let truncated = "";

  for (const { segment } of storageGraphemeSegmenter.segment(value)) {
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

export const CommandHistoryStorageSchema = v.pipe(
  v.array(v.unknown()),
  v.transform((items) => collectNormalizedUniqueStrings(items, normalizeCommandHistoryEntry, MAX_COMMAND_HISTORY)),
);

export type CommandHistoryStorage = v.InferOutput<typeof CommandHistoryStorageSchema>;

export const StoredSidebarExpandedFoldersSchema = v.pipe(
  v.custom<Record<string, unknown>>(isUnknownRecord),
  v.transform((parsed): Record<string, string[]> => {
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
  }),
);

export type StoredSidebarExpandedFolders = v.InferOutput<typeof StoredSidebarExpandedFoldersSchema>;

export const StoredSidebarExpandedFoldersStorageSchema = s.strictObject({
  version: v.literal(SIDEBAR_EXPANDED_FOLDERS_STORAGE_VERSION),
  accounts: StoredSidebarExpandedFoldersSchema,
});

export const SidebarExpandedFoldersStorageVersionMarkerSchema = s.looseObject({ version: v.unknown() });

export type SidebarExpandedFoldersStorage = v.InferOutput<typeof StoredSidebarExpandedFoldersStorageSchema>;

const DatabaseRestoreStorageReconciliationPolicySchemaBase = s.strictObject({
  removeKeys: v.tuple([
    v.literal(STORAGE_KEYS.commandHistory),
    v.literal(STORAGE_KEYS.sidebarExpandedFolders),
    v.literal(STORAGE_KEYS.startupSyncLastTriggeredAt),
  ]),
  retainKeys: v.tuple([v.literal(STORAGE_KEYS.theme)]),
});

export const DATABASE_RESTORE_STORAGE_RECONCILIATION_POLICY: v.InferInput<
  typeof DatabaseRestoreStorageReconciliationPolicySchemaBase
> = {
  removeKeys: [
    STORAGE_KEYS.commandHistory,
    STORAGE_KEYS.sidebarExpandedFolders,
    STORAGE_KEYS.startupSyncLastTriggeredAt,
  ],
  retainKeys: [STORAGE_KEYS.theme],
};

export const DatabaseRestoreStorageReconciliationPolicySchema = v.optional(
  DatabaseRestoreStorageReconciliationPolicySchemaBase,
  DATABASE_RESTORE_STORAGE_RECONCILIATION_POLICY,
);

export type DatabaseRestoreStorageReconciliationPolicy = v.InferOutput<
  typeof DatabaseRestoreStorageReconciliationPolicySchema
>;

export const STORAGE_SCHEMA_CAPACITY_FIXTURES = {
  commandHistory: {
    storageKey: STORAGE_KEYS.commandHistory,
    schemaName: "CommandHistoryStorageSchema",
    fallbackOwner: "command history localStorage explicit cleanup",
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
    fallbackOwner: "sidebar startup folder expansion localStorage cache recovery",
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

const StorageKeySchema = v.picklist([
  STORAGE_KEYS.theme,
  STORAGE_KEYS.commandHistory,
  STORAGE_KEYS.sidebarExpandedFolders,
  STORAGE_KEYS.startupSyncLastTriggeredAt,
]);

export const StorageCleanupPolicyConnectionsSchema = s.strictObject({
  settingsDataResetKeys: v.pipe(v.array(StorageKeySchema), v.readonly()),
  privateDataExportKeys: v.pipe(v.array(StorageKeySchema), v.readonly()),
});

export type StorageCleanupPolicyConnections = v.InferOutput<typeof StorageCleanupPolicyConnectionsSchema>;
