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

function uniqueEntries(values: string[]): string[] {
  return [...new Set(values)];
}

export const CommandHistoryStorageSchema = z.array(z.unknown()).transform((items) =>
  uniqueEntries(
    items
      .filter((item): item is string => typeof item === "string")
      .map(normalizeCommandHistoryEntry)
      .filter((item) => item.length > 0),
  ).slice(0, MAX_COMMAND_HISTORY),
);

export type CommandHistoryStorage = z.output<typeof CommandHistoryStorageSchema>;

export const StoredSidebarExpandedFoldersSchema = z.record(z.string(), z.unknown()).transform(
  (parsed): Record<string, string[]> =>
    Object.fromEntries(
      Object.entries(parsed)
        .flatMap(([accountId, folderIds]): Array<[string, string[]]> => {
          const normalizedAccountId = normalizeStoredIdentity(accountId);
          if (!normalizedAccountId || !Array.isArray(folderIds)) {
            return [];
          }

          const normalizedFolderIds = uniqueEntries(
            folderIds
              .filter((folderId): folderId is string => typeof folderId === "string")
              .map(normalizeStoredIdentity)
              .filter((folderId) => folderId.length > 0),
          ).slice(0, MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT);

          return normalizedFolderIds.length > 0 ? [[normalizedAccountId, normalizedFolderIds]] : [];
        })
        .slice(0, MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS),
    ),
);

export type StoredSidebarExpandedFolders = z.output<typeof StoredSidebarExpandedFoldersSchema>;
