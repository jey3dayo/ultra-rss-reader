import type { Result } from "@praha/byethrow";
import {
  type AppError,
  type ArticleDto,
  ArticleDtoListSchema,
  ArticleDtoSchema,
  type ArticleListMode,
  CountResponseSchema,
  clearArticleViewHistoryArgs,
  countAccountStarredArticlesArgs,
  countAccountUnreadArticlesArgs,
  getArticleArgs,
  listAccountArticlesArgs,
  listArticlesArgs,
  listFolderArticlesArgs,
  listRecentArticlesArgs,
  listStarredArticlesArgs,
  markAccountReadArgs,
  markArticleReadArgs,
  markArticlesReadArgs,
  NonnegativeIntResponseSchema,
  NullableStarredArticlesSchema,
  NullableStarredCountSchema,
  NullResponseSchema,
  type OldUnreadDays,
  type OldUnreadScopeKind,
  oldUnreadArticlesArgs,
  recordArticleViewArgs,
  searchArticlesArgs,
  toggleArticleStarArgs,
  unstarAccountArticlesArgs,
} from "@/api/schemas";
import { safeInvoke } from "./runtime";

type ListArticlesParams = {
  feedId: string;
  unreadOnly?: boolean;
  offset?: number;
  limit?: number;
};
type ListAccountArticlesParams = {
  accountId: string;
  unreadOnly?: boolean;
  offset?: number;
  limit?: number;
};

export const getArticle = (articleId: string) =>
  safeInvoke("get_article", { response: ArticleDtoSchema, args: getArticleArgs }, { articleId });

function resolveListArticlesArgs(
  feedIdOrParams: string | ListArticlesParams,
  unreadOnlyOrOffset?: boolean | number,
  offsetOrLimit?: number,
  limit?: number,
): ListArticlesParams {
  if (typeof feedIdOrParams !== "string") {
    return feedIdOrParams;
  }
  const unreadOnly = typeof unreadOnlyOrOffset === "boolean" ? unreadOnlyOrOffset : undefined;
  const offset = typeof unreadOnlyOrOffset === "number" ? unreadOnlyOrOffset : offsetOrLimit;
  const resolvedLimit = typeof unreadOnlyOrOffset === "number" ? offsetOrLimit : limit;
  return { feedId: feedIdOrParams, unreadOnly, offset, limit: resolvedLimit };
}

export function listArticles(
  feedId: string,
  unreadOnly?: boolean,
  offset?: number,
  limit?: number,
): Result.ResultAsync<ArticleDto[], AppError>;
export function listArticles(
  feedId: string,
  offset?: number,
  limit?: number,
): Result.ResultAsync<ArticleDto[], AppError>;
export function listArticles(params: ListArticlesParams): Result.ResultAsync<ArticleDto[], AppError>;
export function listArticles(
  feedIdOrParams: string | ListArticlesParams,
  unreadOnlyOrOffset?: boolean | number,
  offsetOrLimit?: number,
  limit?: number,
) {
  const args = resolveListArticlesArgs(feedIdOrParams, unreadOnlyOrOffset, offsetOrLimit, limit);

  return safeInvoke("list_articles", { response: ArticleDtoListSchema, args: listArticlesArgs }, args);
}

export const listFeedStarredArticles = (feedId: string, offset?: number, limit?: number) =>
  safeInvoke(
    "list_articles",
    { response: ArticleDtoListSchema, args: listArticlesArgs },
    { feedId, starredOnly: true, offset, limit },
  );

function resolveListAccountArticlesArgs(
  accountIdOrParams: string | ListAccountArticlesParams,
  unreadOnlyOrOffset?: boolean | number,
  offsetOrLimit?: number,
  limit?: number,
): ListAccountArticlesParams {
  if (typeof accountIdOrParams !== "string") {
    return accountIdOrParams;
  }
  const unreadOnly = typeof unreadOnlyOrOffset === "boolean" ? unreadOnlyOrOffset : undefined;
  const offset = typeof unreadOnlyOrOffset === "number" ? unreadOnlyOrOffset : offsetOrLimit;
  const resolvedLimit = typeof unreadOnlyOrOffset === "number" ? offsetOrLimit : limit;
  return {
    accountId: accountIdOrParams,
    unreadOnly,
    offset,
    limit: resolvedLimit,
  };
}

export function listAccountArticles(
  accountId: string,
  unreadOnly?: boolean,
  offset?: number,
  limit?: number,
): Result.ResultAsync<ArticleDto[], AppError>;
export function listAccountArticles(
  accountId: string,
  offset?: number,
  limit?: number,
): Result.ResultAsync<ArticleDto[], AppError>;
export function listAccountArticles(params: ListAccountArticlesParams): Result.ResultAsync<ArticleDto[], AppError>;
export function listAccountArticles(
  accountIdOrParams: string | ListAccountArticlesParams,
  unreadOnlyOrOffset?: boolean | number,
  offsetOrLimit?: number,
  limit?: number,
) {
  const args = resolveListAccountArticlesArgs(accountIdOrParams, unreadOnlyOrOffset, offsetOrLimit, limit);

  return safeInvoke("list_account_articles", { response: ArticleDtoListSchema, args: listAccountArticlesArgs }, args);
}

export const listFolderArticles = (folderId: string, mode: ArticleListMode = "all", offset?: number, limit?: number) =>
  safeInvoke(
    "list_folder_articles",
    { response: ArticleDtoListSchema, args: listFolderArticlesArgs },
    { folderId, mode, offset, limit },
  );

export const listStarredArticles = (accountId: string, offset?: number, limit?: number) =>
  safeInvoke(
    "list_starred_articles",
    { response: NullableStarredArticlesSchema, args: listStarredArticlesArgs },
    { accountId, offset, limit },
  );

export const listRecentArticles = (accountId: string, offset?: number, limit?: number, mode?: ArticleListMode) =>
  safeInvoke(
    "list_recent_articles",
    { response: ArticleDtoListSchema, args: listRecentArticlesArgs },
    { accountId, offset, limit, mode },
  );

export const countAccountUnreadArticles = (accountId: string) =>
  safeInvoke(
    "count_account_unread_articles",
    { response: CountResponseSchema, args: countAccountUnreadArticlesArgs },
    { accountId },
  );

export const countAccountStarredArticles = (accountId: string) =>
  safeInvoke(
    "count_account_starred_articles",
    {
      response: NullableStarredCountSchema,
      args: countAccountStarredArticlesArgs,
    },
    { accountId },
  );

export const markAccountRead = (accountId: string) =>
  safeInvoke("mark_account_read", { response: NullResponseSchema, args: markAccountReadArgs }, { accountId });

export const markAccountStarredRead = (accountId: string) =>
  safeInvoke("mark_account_starred_read", { response: NullResponseSchema, args: markAccountReadArgs }, { accountId });

export const countOldUnreadArticles = (scopeKind: OldUnreadScopeKind, targetId: string, olderThanDays: OldUnreadDays) =>
  safeInvoke(
    "count_old_unread_articles",
    { response: CountResponseSchema, args: oldUnreadArticlesArgs },
    { scopeKind, targetId, olderThanDays },
  );

export const markOldUnreadRead = (scopeKind: OldUnreadScopeKind, targetId: string, olderThanDays: OldUnreadDays) =>
  safeInvoke(
    "mark_old_unread_read",
    { response: NullResponseSchema, args: oldUnreadArticlesArgs },
    { scopeKind, targetId, olderThanDays },
  );

export const unstarAccountArticles = (accountId: string) =>
  safeInvoke(
    "unstar_account_articles",
    { response: NullResponseSchema, args: unstarAccountArticlesArgs },
    { accountId },
  );

export const markArticleRead = (articleId: string, read = true) =>
  safeInvoke("mark_article_read", { response: NullResponseSchema, args: markArticleReadArgs }, { articleId, read });

export const recordArticleView = (accountId: string, articleId: string) =>
  safeInvoke(
    "record_article_view",
    { response: NullResponseSchema, args: recordArticleViewArgs },
    { accountId, articleId },
  );

export const clearArticleViewHistory = (accountId: string) =>
  safeInvoke(
    "clear_article_view_history",
    {
      response: NonnegativeIntResponseSchema,
      args: clearArticleViewHistoryArgs,
    },
    { accountId },
  );

export const markArticlesRead = (articleIds: string[]) =>
  safeInvoke("mark_articles_read", { response: NullResponseSchema, args: markArticlesReadArgs }, { articleIds });

export const toggleArticleStar = (articleId: string, starred: boolean) =>
  safeInvoke(
    "toggle_article_star",
    { response: NullResponseSchema, args: toggleArticleStarArgs },
    { articleId, starred },
  );

export const searchArticles = (accountId: string, query: string, offset?: number, limit?: number) =>
  safeInvoke(
    "search_articles",
    { response: ArticleDtoListSchema, args: searchArticlesArgs },
    { accountId, query, offset, limit },
  );
