import {
  exportOpmlToFileArgs,
  FeedDtoListSchema,
  importOpmlArgs,
  NullResponseSchema,
  SyncResultSchema,
  startupSyncArgs,
  syncAccountArgs,
  syncFeedArgs,
} from "@/api/schemas";
import { safeInvoke } from "./runtime";

export const triggerSync = () => safeInvoke("trigger_sync", { response: SyncResultSchema });

export const triggerStartupSync = (preferredAccountId?: string) =>
  safeInvoke(
    "trigger_startup_sync",
    { response: SyncResultSchema, args: startupSyncArgs },
    preferredAccountId === undefined ? undefined : { preferredAccountId },
  );

export const triggerAutomaticSync = () => safeInvoke("trigger_automatic_sync", { response: SyncResultSchema });

export const syncAccount = (accountId: string) =>
  safeInvoke("trigger_sync_account", { response: SyncResultSchema, args: syncAccountArgs }, { accountId });

export const syncFeed = (feedId: string) =>
  safeInvoke("trigger_sync_feed", { response: SyncResultSchema, args: syncFeedArgs }, { feedId });

export const exportOpmlToFile = (accountId: string, path: string) =>
  safeInvoke("export_opml_to_file", { response: NullResponseSchema, args: exportOpmlToFileArgs }, { accountId, path });

export const importOpml = (accountId: string, opmlContent: string) =>
  safeInvoke("import_opml", { response: FeedDtoListSchema, args: importOpmlArgs }, { accountId, opmlContent });
