import { z } from "zod";
import {
  MAX_COMMAND_HISTORY,
  MAX_COMMAND_HISTORY_ENTRY_LENGTH,
  MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS,
  MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT,
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
