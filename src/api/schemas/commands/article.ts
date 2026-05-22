import { z } from "zod";
import {
  articleListModeSchema,
  nonBlankTrimmedIdSchema,
  nonBlankTrimmedStringSchema,
  oldUnreadDaysSchema,
  oldUnreadScopeKindSchema,
  paginationLimitSchema,
  paginationOffsetSchema,
} from "./shared";

export const listArticlesArgs = z
  .object({
    feedId: nonBlankTrimmedIdSchema,
    unreadOnly: z.boolean().optional(),
    starredOnly: z.boolean().optional(),
    offset: paginationOffsetSchema.optional(),
    limit: paginationLimitSchema.optional(),
  })
  .refine((args) => !(args.unreadOnly === true && args.starredOnly === true), {
    message: "Article list filters are mutually exclusive",
    path: ["starredOnly"],
  });

export const listAccountArticlesArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  unreadOnly: z.boolean().optional(),
  offset: paginationOffsetSchema.optional(),
  limit: paginationLimitSchema.optional(),
});

export const listFeedArticleSummariesArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
});

export const listFolderArticlesArgs = z.object({
  folderId: nonBlankTrimmedIdSchema,
  mode: articleListModeSchema.optional(),
  offset: paginationOffsetSchema.optional(),
  limit: paginationLimitSchema.optional(),
});

export const listStarredArticlesArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  offset: paginationOffsetSchema.optional(),
  limit: paginationLimitSchema.optional(),
});

export const listRecentArticlesArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  mode: articleListModeSchema.optional(),
  offset: paginationOffsetSchema.optional(),
  limit: paginationLimitSchema.optional(),
});

export const countAccountUnreadArticlesArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
});

export const countAccountStarredArticlesArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
});

export const markAccountReadArgs = z.object({ accountId: nonBlankTrimmedIdSchema });

export const oldUnreadArticlesArgs = z.object({
  scopeKind: oldUnreadScopeKindSchema,
  targetId: nonBlankTrimmedIdSchema,
  olderThanDays: oldUnreadDaysSchema,
});

export const unstarAccountArticlesArgs = z.object({ accountId: nonBlankTrimmedIdSchema });
export const cleanupFeedIntegrityOrphansArgs = z.object({
  dryRun: z.boolean(),
  orphanedArticleIds: z.array(nonBlankTrimmedIdSchema).optional(),
});

export const searchArticlesArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  query: nonBlankTrimmedStringSchema,
  offset: paginationOffsetSchema.optional(),
  limit: paginationLimitSchema.optional(),
});

export const markArticleReadArgs = z.object({
  articleId: nonBlankTrimmedIdSchema,
  read: z.boolean().optional(),
});

export const recordArticleViewArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  articleId: nonBlankTrimmedIdSchema,
});

export const clearArticleViewHistoryArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
});

export const markArticlesReadArgs = z.object({
  articleIds: z.array(nonBlankTrimmedIdSchema).nonempty(),
});

export const toggleArticleStarArgs = z.object({
  articleId: nonBlankTrimmedIdSchema,
  starred: z.boolean(),
});

export const markFeedReadArgs = z.object({ feedId: nonBlankTrimmedIdSchema });
export const markFolderReadArgs = z.object({ folderId: nonBlankTrimmedIdSchema });
