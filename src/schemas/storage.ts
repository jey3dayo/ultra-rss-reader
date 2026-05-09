import { z } from "zod";
import { MAX_COMMAND_HISTORY } from "@/constants/storage";

export const CommandHistoryStorageSchema = z
  .array(z.unknown())
  .transform((items) =>
    items
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .slice(0, MAX_COMMAND_HISTORY),
  );

export type CommandHistoryStorage = z.output<typeof CommandHistoryStorageSchema>;

export const StoredSidebarExpandedFoldersSchema = z
  .record(z.string(), z.unknown())
  .transform(
    (parsed): Record<string, string[]> =>
      Object.fromEntries(
        Object.entries(parsed).flatMap(
          ([accountId, folderIds]): Array<[string, string[]]> =>
            Array.isArray(folderIds)
              ? [
                  [
                    accountId,
                    [...new Set(folderIds.filter((folderId): folderId is string => typeof folderId === "string"))],
                  ],
                ]
              : [],
        ),
      ),
  );

export type StoredSidebarExpandedFolders = z.output<typeof StoredSidebarExpandedFoldersSchema>;
