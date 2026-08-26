/**
 * Cache projection lifecycle owned by the article hook layer.
 *
 * Keep this co-located with use-articles while it has one production consumer
 * and mutates QueryClient state directly. Promote it to src/lib/articles only
 * after a second production owner needs the same cache contract and the
 * lifecycle boundary can remain unambiguous.
 */

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { ArticleDto } from "@/api/schemas/article";
import { shouldKeepArticleInListQuery } from "@/lib/articles/article-read-projection";
import { ARTICLE_CACHE_QUERY_ROOTS, getReaderArticleQueryMode, queryKeys } from "@/lib/query/query-invalidation";

type CachedArticleInsertOptions = {
  insertIfMissing: boolean;
};

const READER_FILTERS = ["all", "unread", "starred"] as const;

function patchCachedArticleState(
  qc: QueryClient,
  articleId: string,
  resolveNextArticle: (article: ArticleDto) => ArticleDto,
) {
  const cachedArticle = findCachedArticle(qc, articleId);
  if (cachedArticle === null) {
    return;
  }

  const nextArticle = resolveNextArticle(cachedArticle);
  const accountIds = resolveAccountIdsForArticle(qc, cachedArticle);

  qc.setQueryData(queryKeys.articles.byId(articleId), nextArticle);
  patchArticleListQueries(qc, nextArticle, { insertIfMissing: false });

  if (accountIds.length > 0) {
    for (const accountId of accountIds) {
      patchKnownAccountArticleCaches(qc, accountId, nextArticle);
    }
    return;
  }

  patchUnknownAccountArticleCaches(qc, nextArticle);
}

export function patchCachedArticleReadState(qc: QueryClient, articleId: string, read: boolean) {
  patchCachedArticleState(qc, articleId, (cachedArticle) => ({ ...cachedArticle, is_read: read }));
}

function isArticleDto(candidate: unknown): candidate is ArticleDto {
  return (
    !!candidate &&
    typeof candidate === "object" &&
    "id" in candidate &&
    "is_read" in candidate &&
    "is_starred" in candidate
  );
}

function indexArticleDtosById(data: unknown): Map<string, ArticleDto> {
  const articlesById = new Map<string, ArticleDto>();
  if (!Array.isArray(data)) {
    return articlesById;
  }

  for (const candidate of data) {
    if (isArticleDto(candidate) && !articlesById.has(candidate.id)) {
      articlesById.set(candidate.id, candidate);
    }
  }

  return articlesById;
}

function findCachedArticle(qc: QueryClient, articleId: string): ArticleDto | null {
  for (const queryKey of ARTICLE_CACHE_QUERY_ROOTS) {
    const matches = qc.getQueriesData<unknown>({ queryKey });
    for (const [, data] of matches) {
      const article = indexArticleDtosById(data).get(articleId);
      if (article) {
        return article;
      }
    }
  }

  return null;
}

function indexFeedAccountIdsByFeedId(data: unknown): Map<string, string> {
  const accountIdsByFeedId = new Map<string, string>();
  if (!Array.isArray(data)) {
    return accountIdsByFeedId;
  }

  for (const candidate of data) {
    if (
      candidate &&
      typeof candidate === "object" &&
      "id" in candidate &&
      typeof candidate.id === "string" &&
      "account_id" in candidate &&
      typeof candidate.account_id === "string" &&
      !accountIdsByFeedId.has(candidate.id)
    ) {
      accountIdsByFeedId.set(candidate.id, candidate.account_id);
    }
  }

  return accountIdsByFeedId;
}

function resolveArticleAccountIdFromScopedQuery(queryKey: QueryKey, data: unknown, articleId: string): string | null {
  const accountId = queryKey[2];
  if (typeof accountId !== "string" || !indexArticleDtosById(data).has(articleId)) {
    return null;
  }

  return accountId;
}

function resolveAccountIdsForArticle(qc: QueryClient, article: ArticleDto): string[] {
  const accountIds = new Set<string>();

  for (const [, data] of qc.getQueriesData<unknown>({
    queryKey: queryKeys.feeds.root,
  })) {
    const accountId = indexFeedAccountIdsByFeedId(data).get(article.feed_id);
    if (accountId) {
      accountIds.add(accountId);
    }
  }

  for (const [queryKey, data] of qc.getQueriesData<unknown>({
    queryKey: queryKeys.accountArticles.root,
  })) {
    const accountId = resolveArticleAccountIdFromScopedQuery(queryKey, data, article.id);
    if (accountId) {
      accountIds.add(accountId);
    }
  }

  for (const [queryKey, data] of qc.getQueriesData<unknown>({
    queryKey: queryKeys.starredArticles.root,
  })) {
    const accountId = resolveArticleAccountIdFromScopedQuery(queryKey, data, article.id);
    if (accountId) {
      accountIds.add(accountId);
    }
  }

  return Array.from(accountIds);
}

export function isAccountKnownDeleted(qc: QueryClient, accountId: string): boolean {
  const accounts = qc.getQueryData<unknown>(queryKeys.accounts.root);
  if (!Array.isArray(accounts)) {
    return false;
  }

  return !accounts.some(
    (account): account is { id: string } =>
      typeof account === "object" &&
      account !== null &&
      "id" in account &&
      typeof account.id === "string" &&
      account.id === accountId,
  );
}

export function shouldInvalidateAfterRecordArticleView(qc: QueryClient, accountId: string): boolean {
  return !isAccountKnownDeleted(qc, accountId);
}

export function getRecentArticleQueryKeysForAccount(accountId: string) {
  return READER_FILTERS.map((mode) => queryKeys.recentArticles.byAccount(accountId, mode));
}

function shouldKeepArticleInQuery(queryKey: QueryKey, nextArticle: ArticleDto): boolean {
  return shouldKeepArticleInListQuery(getReaderArticleQueryMode(queryKey), nextArticle);
}

function updateCachedArticleArray(
  current: unknown,
  nextArticle: ArticleDto,
  options?: { insertIfMissing?: boolean; queryKey?: QueryKey },
) {
  const shouldKeepArticle = options?.queryKey ? shouldKeepArticleInQuery(options.queryKey, nextArticle) : true;

  if (!Array.isArray(current)) {
    return options?.insertIfMissing && shouldKeepArticle ? [nextArticle] : current;
  }

  let found = false;
  const nextArray = current.flatMap((candidate) => {
    if (isArticleDto(candidate) && candidate.id === nextArticle.id) {
      found = true;
      return shouldKeepArticle ? [nextArticle] : [];
    }

    return [candidate];
  });

  if (!found && options?.insertIfMissing && shouldKeepArticle) {
    return [nextArticle, ...nextArray];
  }

  return nextArray;
}

function shouldInsertMissingAccountArticle(queryKey: QueryKey, nextArticle: ArticleDto): boolean {
  return shouldKeepArticleInQuery(queryKey, nextArticle);
}

function updateCachedStarredArticleArray(
  current: unknown,
  nextArticle: ArticleDto,
  options: CachedArticleInsertOptions,
) {
  if (!Array.isArray(current)) {
    if (nextArticle.is_starred) {
      return options.insertIfMissing ? [nextArticle] : current;
    }

    return options.insertIfMissing ? [] : current;
  }

  const starredArticles = current.filter(isArticleDto);
  const hasArticle = starredArticles.some((article) => article.id === nextArticle.id);

  if (!nextArticle.is_starred) {
    return starredArticles.filter((article) => article.id !== nextArticle.id);
  }

  if (hasArticle) {
    return starredArticles.map((article) => (article.id === nextArticle.id ? nextArticle : article));
  }

  return options.insertIfMissing ? [nextArticle, ...starredArticles] : starredArticles;
}

function patchKnownAccountArticleCaches(qc: QueryClient, accountId: string, nextArticle: ArticleDto) {
  const accountArticleQueries = qc.getQueriesData<unknown>({
    queryKey: queryKeys.accountArticles.byAccountPrefix(accountId),
  });

  if (accountArticleQueries.length === 0) {
    qc.setQueryData(queryKeys.accountArticles.byAccount(accountId, "all"), [nextArticle]);
  } else {
    for (const [queryKey] of accountArticleQueries) {
      qc.setQueryData(queryKey, (current: unknown) =>
        updateCachedArticleArray(current, nextArticle, {
          insertIfMissing: shouldInsertMissingAccountArticle(queryKey, nextArticle),
          queryKey,
        }),
      );
    }
  }

  qc.setQueryData(queryKeys.starredArticles.byAccount(accountId), (current: unknown) =>
    updateCachedStarredArticleArray(current, nextArticle, { insertIfMissing: true }),
  );
}

function patchUnknownAccountArticleCaches(qc: QueryClient, nextArticle: ArticleDto) {
  for (const [queryKey] of qc.getQueriesData<unknown>({ queryKey: queryKeys.accountArticles.root })) {
    qc.setQueryData(queryKey, (current: unknown) =>
      updateCachedArticleArray(current, nextArticle, { insertIfMissing: false, queryKey }),
    );
  }
  qc.setQueriesData({ queryKey: queryKeys.starredArticles.root }, (current: unknown) =>
    updateCachedStarredArticleArray(current, nextArticle, { insertIfMissing: false }),
  );
}

function patchArticleListQueries(qc: QueryClient, nextArticle: ArticleDto, options: CachedArticleInsertOptions) {
  for (const queryRoot of [
    queryKeys.articles.root,
    queryKeys.folderArticles.root,
    queryKeys.articlesByTag.root,
    queryKeys.search.root,
    queryKeys.recentArticles.root,
  ] as const) {
    for (const [queryKey] of qc.getQueriesData<unknown>({ queryKey: queryRoot })) {
      qc.setQueryData(queryKey, (current: unknown) =>
        updateCachedArticleArray(current, nextArticle, {
          insertIfMissing: options.insertIfMissing,
          queryKey,
        }),
      );
    }
  }
}

export function patchCachedArticleStarState(qc: QueryClient, articleId: string, starred: boolean) {
  patchCachedArticleState(qc, articleId, (cachedArticle) => ({ ...cachedArticle, is_starred: starred }));
}

// Single-pass bulk variant of patchCachedArticleReadState: bulk mark-read never
// needs insertIfMissing, so one sweep over the cached list queries stays O(queries
// × articles) instead of O(ids × queries × articles) for large folders.
export function patchCachedArticlesMarkedRead(qc: QueryClient, markedArticleIds: ReadonlySet<string>) {
  for (const queryRoot of ARTICLE_CACHE_QUERY_ROOTS) {
    for (const [queryKey, data] of qc.getQueriesData<unknown>({ queryKey: queryRoot })) {
      if (!Array.isArray(data)) {
        continue;
      }

      let changed = false;
      const nextData = data.flatMap((candidate) => {
        if (!isArticleDto(candidate) || !markedArticleIds.has(candidate.id) || candidate.is_read) {
          return [candidate];
        }

        changed = true;
        const nextArticle = { ...candidate, is_read: true };
        return shouldKeepArticleInQuery(queryKey, nextArticle) ? [nextArticle] : [];
      });

      if (changed) {
        qc.setQueryData(queryKey, nextData);
      }
    }
  }

  for (const articleId of markedArticleIds) {
    qc.setQueryData(queryKeys.articles.byId(articleId), (current: ArticleDto | undefined) =>
      current === undefined ? undefined : { ...current, is_read: true },
    );
  }
}
