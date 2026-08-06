import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import {
  articleListModeSchema,
  nonBlankTrimmedIdSchema,
  nonBlankTrimmedStringSchema,
  oldUnreadDaysSchema,
  oldUnreadScopeKindSchema,
  paginationLimitSchema,
  paginationOffsetSchema,
} from "./shared";

export const listArticlesArgs = v.pipe(
  s.object({
    feedId: nonBlankTrimmedIdSchema,
    unreadOnly: v.optional(v.boolean()),
    starredOnly: v.optional(v.boolean()),
    offset: v.optional(paginationOffsetSchema),
    limit: v.optional(paginationLimitSchema),
  }),
  v.forward(
    v.check(
      (args) => !(args.unreadOnly === true && args.starredOnly === true),
      "Article list filters are mutually exclusive",
    ),
    ["starredOnly"],
  ),
);

export const getArticleArgs = s.object({
  articleId: nonBlankTrimmedIdSchema,
});

export const listAccountArticlesArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
  unreadOnly: v.optional(v.boolean()),
  offset: v.optional(paginationOffsetSchema),
  limit: v.optional(paginationLimitSchema),
});

export const listFeedArticleSummariesArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
});

export const listFolderArticlesArgs = s.object({
  folderId: nonBlankTrimmedIdSchema,
  mode: v.optional(articleListModeSchema),
  offset: v.optional(paginationOffsetSchema),
  limit: v.optional(paginationLimitSchema),
});

export const listStarredArticlesArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
  offset: v.optional(paginationOffsetSchema),
  limit: v.optional(paginationLimitSchema),
});

export const listRecentArticlesArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
  mode: v.optional(articleListModeSchema),
  offset: v.optional(paginationOffsetSchema),
  limit: v.optional(paginationLimitSchema),
});

export const countAccountUnreadArticlesArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
});

export const countAccountStarredArticlesArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
});

export const markAccountReadArgs = s.object({ accountId: nonBlankTrimmedIdSchema });

export const oldUnreadArticlesArgs = s.object({
  scopeKind: oldUnreadScopeKindSchema,
  targetId: nonBlankTrimmedIdSchema,
  olderThanDays: oldUnreadDaysSchema,
});

export const unstarAccountArticlesArgs = s.object({ accountId: nonBlankTrimmedIdSchema });
export const cleanupFeedIntegrityOrphansArgs = s.object({
  dryRun: v.boolean(),
  orphanedArticleIds: v.optional(v.array(nonBlankTrimmedIdSchema)),
});

export const searchArticlesArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
  query: nonBlankTrimmedStringSchema,
  offset: v.optional(paginationOffsetSchema),
  limit: v.optional(paginationLimitSchema),
});

export const markArticleReadArgs = s.object({
  articleId: nonBlankTrimmedIdSchema,
  read: v.optional(v.boolean()),
});

export const recordArticleViewArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
  articleId: nonBlankTrimmedIdSchema,
});

export const clearArticleViewHistoryArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
});

export const markArticlesReadArgs = s.object({
  articleIds: v.pipe(v.array(nonBlankTrimmedIdSchema), v.minLength(1)),
});

export const toggleArticleStarArgs = s.object({
  articleId: nonBlankTrimmedIdSchema,
  starred: v.boolean(),
});

export const markFeedReadArgs = s.object({ feedId: nonBlankTrimmedIdSchema });
export const markFolderReadArgs = s.object({ folderId: nonBlankTrimmedIdSchema });
