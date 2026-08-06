import * as s from "@/api/schemas/validation";
import { FeedDisplayModeSchema } from "../feed";
import { feedTitleSchema, folderNameSchema, nonBlankTrimmedIdSchema, nullableBlankStringToNullSchema } from "./shared";
import { httpCommandUrlSchema } from "./url";

export const listFoldersArgs = s.object({ accountId: nonBlankTrimmedIdSchema });
export const listFeedsArgs = s.object({ accountId: nonBlankTrimmedIdSchema });
export const syncFeedArgs = s.object({ feedId: nonBlankTrimmedIdSchema });
export const discoverFeedsArgs = s.object({ url: httpCommandUrlSchema });
export const addLocalFeedArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
  url: httpCommandUrlSchema,
});
export const createFolderArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
  name: folderNameSchema,
});
export const deleteFeedArgs = s.object({ feedId: nonBlankTrimmedIdSchema });
export const renameFeedArgs = s.object({
  feedId: nonBlankTrimmedIdSchema,
  title: feedTitleSchema,
});
export const updateFeedFolderArgs = s.object({
  feedId: nonBlankTrimmedIdSchema,
  folderId: nullableBlankStringToNullSchema,
});
export const updateFeedDisplaySettingsArgs = s.object({
  feedId: nonBlankTrimmedIdSchema,
  readerMode: FeedDisplayModeSchema,
  webPreviewMode: FeedDisplayModeSchema,
});
