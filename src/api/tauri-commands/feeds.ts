import {
  addLocalFeedArgs,
  cleanupFeedIntegrityOrphansArgs,
  createFolderArgs,
  DiscoveredFeedDtoListSchema,
  deleteFeedArgs,
  discoverFeedsArgs,
  FeedArticleSummaryDtoListSchema,
  FeedDtoListSchema,
  FeedDtoSchema,
  FeedIntegrityCleanupDtoSchema,
  FeedIntegrityReportDtoSchema,
  FolderDtoListSchema,
  FolderDtoSchema,
  listFeedArticleSummariesArgs,
  listFeedsArgs,
  listFoldersArgs,
  markFeedReadArgs,
  markFolderReadArgs,
  NullResponseSchema,
  renameFeedArgs,
  updateFeedDisplaySettingsArgs,
  updateFeedFolderArgs,
} from "@/api/schemas";
import { safeInvoke } from "./runtime";

export const listFolders = (accountId: string) =>
  safeInvoke("list_folders", { response: FolderDtoListSchema, args: listFoldersArgs }, { accountId });

export const listFeeds = (accountId: string) =>
  safeInvoke("list_feeds", { response: FeedDtoListSchema, args: listFeedsArgs }, { accountId });

export const listFeedArticleSummaries = (accountId: string) =>
  safeInvoke(
    "list_feed_article_summaries",
    {
      response: FeedArticleSummaryDtoListSchema,
      args: listFeedArticleSummariesArgs,
    },
    { accountId },
  );

export const getFeedIntegrityReport = () =>
  safeInvoke("get_feed_integrity_report", {
    response: FeedIntegrityReportDtoSchema,
  });

export const cleanupFeedIntegrityOrphans = (dryRun: boolean, orphanedArticleIds?: readonly string[]) =>
  safeInvoke(
    "cleanup_feed_integrity_orphans",
    {
      response: FeedIntegrityCleanupDtoSchema,
      args: cleanupFeedIntegrityOrphansArgs,
    },
    {
      dryRun,
      orphanedArticleIds: orphanedArticleIds ? [...orphanedArticleIds] : undefined,
    },
  );

export const markFeedRead = (feedId: string) =>
  safeInvoke("mark_feed_read", { response: NullResponseSchema, args: markFeedReadArgs }, { feedId });

export const markFolderRead = (folderId: string) =>
  safeInvoke("mark_folder_read", { response: NullResponseSchema, args: markFolderReadArgs }, { folderId });

export const discoverFeeds = (url: string) =>
  safeInvoke("discover_feeds", { response: DiscoveredFeedDtoListSchema, args: discoverFeedsArgs }, { url });

export const addLocalFeed = (accountId: string, url: string) =>
  safeInvoke("add_local_feed", { response: FeedDtoSchema, args: addLocalFeedArgs }, { accountId, url });

export const createFolder = (accountId: string, name: string) =>
  safeInvoke("create_folder", { response: FolderDtoSchema, args: createFolderArgs }, { accountId, name });

export const deleteFeed = (feedId: string) =>
  safeInvoke("delete_feed", { response: NullResponseSchema, args: deleteFeedArgs }, { feedId });

export const renameFeed = (feedId: string, title: string) =>
  safeInvoke("rename_feed", { response: NullResponseSchema, args: renameFeedArgs }, { feedId, title });

export const updateFeedFolder = (feedId: string, folderId: string | null) =>
  safeInvoke("update_feed_folder", { response: NullResponseSchema, args: updateFeedFolderArgs }, { feedId, folderId });

export const updateFeedDisplaySettings = (feedId: string, readerMode: string, webPreviewMode: string) =>
  safeInvoke(
    "update_feed_display_settings",
    { response: NullResponseSchema, args: updateFeedDisplaySettingsArgs },
    { feedId, readerMode, webPreviewMode },
  );
