import { z } from "zod";
import { FeedDisplayModeSchema } from "../feed";
import { feedTitleSchema, folderNameSchema, nonBlankTrimmedIdSchema, nullableBlankStringToNullSchema } from "./shared";
import { httpCommandUrlSchema } from "./url";

export const listFoldersArgs = z.object({ accountId: nonBlankTrimmedIdSchema });
export const listFeedsArgs = z.object({ accountId: nonBlankTrimmedIdSchema });
export const syncFeedArgs = z.object({ feedId: nonBlankTrimmedIdSchema });
export const discoverFeedsArgs = z.object({ url: httpCommandUrlSchema });
export const addLocalFeedArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  url: httpCommandUrlSchema,
});
export const createFolderArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  name: folderNameSchema,
});
export const deleteFeedArgs = z.object({ feedId: nonBlankTrimmedIdSchema });
export const renameFeedArgs = z.object({
  feedId: nonBlankTrimmedIdSchema,
  title: feedTitleSchema,
});
export const updateFeedFolderArgs = z.object({
  feedId: nonBlankTrimmedIdSchema,
  folderId: nullableBlankStringToNullSchema,
});
export const updateFeedDisplaySettingsArgs = z.object({
  feedId: nonBlankTrimmedIdSchema,
  readerMode: FeedDisplayModeSchema,
  webPreviewMode: FeedDisplayModeSchema,
});
