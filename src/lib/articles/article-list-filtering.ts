import type { ArticleDto } from "@/api/tauri-commands";
import { getDateInputTimeMs } from "@/lib/datetime";
import type { ReaderSourcePlan } from "@/lib/reader/reader-query";
import type { ViewMode } from "@/lib/reader/view-mode.types";

export const MAX_RETAINED_ARTICLES_SNAPSHOT_SIZE = 50;

export type SelectVisibleArticlesParams = {
  articles: ArticleDto[] | undefined;
  accountArticles: ArticleDto[] | undefined;
  tagArticles: ArticleDto[] | undefined;
  searchResults: ArticleDto[] | undefined;
  feedId: string | null;
  tagId: string | null;
  folderFeedIds?: ReadonlySet<string> | null;
  viewMode: ViewMode;
  sourceFilter: ViewMode | null;
  preservesSourceOrder?: boolean;
  showSearch: boolean;
  searchQuery: string;
  sortUnread: string;
  retainedArticleIds?: ReadonlySet<string>;
};

export type RetainedArticlesSnapshot = {
  contextKey: string;
  articles: ArticleDto[];
};

function filterByFolderFeedIds(
  articles: ArticleDto[],
  folderFeedIds: ReadonlySet<string> | null | undefined,
): ArticleDto[] {
  if (!folderFeedIds) {
    return articles;
  }

  if (folderFeedIds.size === 0) {
    return [];
  }

  return articles.filter((article) => folderFeedIds.has(article.feed_id));
}

function filterByFeedId(articles: ArticleDto[], feedId: string | null): ArticleDto[] {
  if (!feedId) {
    return articles;
  }

  return articles.filter((article) => article.feed_id === feedId);
}

function filterByTagArticles(
  articles: ArticleDto[],
  tagId: string | null,
  tagArticles: ArticleDto[] | undefined,
): ArticleDto[] {
  if (!tagId) {
    return articles;
  }

  if (tagArticles === undefined) {
    return [];
  }

  const taggedArticleIds = new Set(tagArticles.map((article) => article.id));
  return articles.filter((article) => taggedArticleIds.has(article.id));
}

function filterByViewMode(
  articles: ArticleDto[],
  viewMode: ViewMode,
  sourceFilter: ViewMode | null,
  retainedArticleIds: ReadonlySet<string> | undefined,
): ArticleDto[] {
  // In unread/starred views, keep the current row visible until the user changes
  // screens. Marking an article read/starred should not make it disappear mid-click.
  const applyMode = (candidates: ArticleDto[], mode: ViewMode): ArticleDto[] => {
    if (mode === "unread") {
      return candidates.filter((article) => !article.is_read || retainedArticleIds?.has(article.id));
    }

    if (mode === "starred") {
      return candidates.filter((article) => article.is_starred || retainedArticleIds?.has(article.id));
    }

    return candidates;
  };

  let filtered = articles;
  if (sourceFilter !== null && sourceFilter !== "all") {
    filtered = applyMode(filtered, sourceFilter);
  }

  if (viewMode !== sourceFilter && viewMode !== "all") {
    filtered = applyMode(filtered, viewMode);
  }

  return [...filtered];
}

function shouldPreserveArticleListSourceOrder(params: {
  preservesSourceOrder: boolean | undefined;
  isActiveSearch: boolean;
}): boolean {
  return params.preservesSourceOrder === true || params.isActiveSearch;
}

type ArticlePublishedAtTimeMap = ReadonlyMap<ArticleDto, number | null>;

function buildArticlePublishedAtTimeMap(articles: ArticleDto[]): ArticlePublishedAtTimeMap {
  const map = new Map<ArticleDto, number | null>();
  for (const article of articles) {
    map.set(article, getDateInputTimeMs(article.published_at));
  }
  return map;
}

function compareArticlesByPublishedAt(params: {
  left: ArticleDto;
  right: ArticleDto;
  direction: 1 | -1;
  publishedAtTimeByArticle: ArticlePublishedAtTimeMap;
}): number {
  const { left, right, direction, publishedAtTimeByArticle } = params;
  const leftTime = publishedAtTimeByArticle.get(left) ?? null;
  const rightTime = publishedAtTimeByArticle.get(right) ?? null;

  if (leftTime !== null && rightTime !== null) {
    const dateOrder = leftTime < rightTime ? -1 : leftTime > rightTime ? 1 : 0;
    if (dateOrder !== 0) {
      return dateOrder * direction;
    }

    return left.id.localeCompare(right.id);
  }

  if (leftTime !== null && rightTime === null) {
    return -1;
  }

  if (leftTime === null && rightTime !== null) {
    return 1;
  }

  return left.id.localeCompare(right.id);
}

export function areArticleListsEquivalent(left: ArticleDto[], right: ArticleDto[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const article = left[index];
    const candidate = right[index];
    if (
      article === undefined ||
      candidate === undefined ||
      article.id !== candidate.id ||
      article.is_read !== candidate.is_read ||
      article.is_starred !== candidate.is_starred ||
      article.title !== candidate.title
    ) {
      return false;
    }
  }

  return true;
}

export type CollectRetainedArticlesFromSourcesParams = {
  retainedArticleIds: ReadonlySet<string>;
  sources: Array<ArticleDto[] | undefined>;
};

export type MergeRetainedArticlesSnapshotParams = {
  previous: RetainedArticlesSnapshot | null;
  contextKey: string;
  retainedArticleIds: ReadonlySet<string>;
  currentRetainedArticles: ArticleDto[];
};

export type MergeResolvedArticlesWithRetainedParams = {
  resolvedPrimarySourceArticles: ArticleDto[] | undefined;
  retainedArticlesSnapshot: RetainedArticlesSnapshot | null;
  retainedArticleIds: ReadonlySet<string>;
  contextKey: string;
};

export type ResolveEffectiveRetainedArticleIdsParams = {
  sourcePlan?: ReaderSourcePlan;
  sourceFilter?: ViewMode | null;
  effectiveViewMode?: ViewMode;
  retainedArticleIds: ReadonlySet<string>;
  selectedArticleId: string | null;
};

export function collectRetainedArticlesFromSources(params: CollectRetainedArticlesFromSourcesParams): ArticleDto[] {
  const { retainedArticleIds, sources } = params;
  if (retainedArticleIds.size === 0) {
    return [];
  }

  const merged = new Map<string, ArticleDto>();
  for (const source of sources) {
    if (!Array.isArray(source)) {
      continue;
    }
    for (const article of source) {
      if (retainedArticleIds.has(article.id)) {
        merged.set(article.id, article);
      }
    }
  }

  return [...merged.values()];
}

export function mergeRetainedArticlesSnapshot(
  params: MergeRetainedArticlesSnapshotParams,
): RetainedArticlesSnapshot | null {
  const { previous, contextKey, retainedArticleIds, currentRetainedArticles } = params;
  const cappedRetainedArticleIds = [...retainedArticleIds].slice(-MAX_RETAINED_ARTICLES_SNAPSHOT_SIZE);
  const preservedArticles =
    previous?.contextKey === contextKey
      ? previous.articles.filter((article) => cappedRetainedArticleIds.includes(article.id))
      : [];
  const merged = new Map(preservedArticles.map((article) => [article.id, article]));
  for (const article of currentRetainedArticles) {
    if (retainedArticleIds.has(article.id)) {
      merged.set(article.id, article);
    }
  }
  const cappedArticles = cappedRetainedArticleIds
    .map((articleId) => merged.get(articleId))
    .filter((article): article is ArticleDto => article !== undefined);

  if (cappedArticles.length === 0) {
    return null;
  }

  const nextSnapshot = {
    contextKey,
    articles: cappedArticles,
  };

  if (
    previous?.contextKey === nextSnapshot.contextKey &&
    areArticleListsEquivalent(previous.articles, nextSnapshot.articles)
  ) {
    return previous;
  }

  return nextSnapshot;
}

export function buildArticleListSourcePlanKey(sourcePlan: ReaderSourcePlan): string {
  const sourceFilter = sourcePlan.query?.filter ?? "none";
  const sourceOrder = sourcePlan.preservesRecentOrder ? "source" : "sorted";

  return [sourcePlan.sourceKey, sourcePlan.sourceKind, sourceFilter, sourcePlan.effectiveViewMode, sourceOrder].join(
    "|",
  );
}

export function mergeResolvedArticlesWithRetained(
  params: MergeResolvedArticlesWithRetainedParams,
): ArticleDto[] | undefined {
  const { resolvedPrimarySourceArticles, retainedArticlesSnapshot, retainedArticleIds, contextKey } = params;
  if (retainedArticleIds.size === 0 || resolvedPrimarySourceArticles === undefined) {
    return resolvedPrimarySourceArticles;
  }

  const retainedArticles =
    retainedArticlesSnapshot?.contextKey === contextKey
      ? retainedArticlesSnapshot.articles.filter((article) => retainedArticleIds.has(article.id))
      : [];
  if (retainedArticles.length === 0) {
    return resolvedPrimarySourceArticles;
  }

  const currentIds = new Set(resolvedPrimarySourceArticles.map((article) => article.id));
  const missingRetainedArticles = retainedArticles.filter((article) => !currentIds.has(article.id));
  return missingRetainedArticles.length === 0
    ? resolvedPrimarySourceArticles
    : [...missingRetainedArticles, ...resolvedPrimarySourceArticles];
}

export function selectVisibleArticles(params: SelectVisibleArticlesParams): ArticleDto[] {
  const {
    articles,
    accountArticles,
    tagArticles,
    searchResults,
    feedId,
    tagId,
    folderFeedIds,
    viewMode,
    sourceFilter,
    preservesSourceOrder,
    showSearch,
    searchQuery,
    sortUnread,
    retainedArticleIds,
  } = params;

  let list: ArticleDto[];
  const isActiveSearch = showSearch && searchQuery.length > 0;
  if (isActiveSearch) {
    list = filterByViewMode(
      filterByTagArticles(
        filterByFeedId(filterByFolderFeedIds([...(searchResults ?? [])], folderFeedIds), feedId),
        tagId,
        tagArticles,
      ),
      viewMode,
      sourceFilter,
      retainedArticleIds,
    );
  } else if (tagId) {
    list = filterByViewMode([...(tagArticles ?? [])], viewMode, sourceFilter, retainedArticleIds);
  } else {
    list = filterByViewMode(
      filterByFeedId(filterByFolderFeedIds(feedId ? (articles ?? []) : (accountArticles ?? []), folderFeedIds), feedId),
      viewMode,
      sourceFilter,
      retainedArticleIds,
    );
  }

  if (
    shouldPreserveArticleListSourceOrder({
      preservesSourceOrder,
      isActiveSearch,
    })
  ) {
    return list;
  }

  const direction = sortUnread === "oldest_first" ? 1 : -1;
  const publishedAtTimeByArticle = buildArticlePublishedAtTimeMap(list);
  list.sort((left, right) => compareArticlesByPublishedAt({ left, right, direction, publishedAtTimeByArticle }));
  return list;
}

export function resolveEffectiveRetainedArticleIds(
  params: ResolveEffectiveRetainedArticleIdsParams,
): ReadonlySet<string> {
  const sourceFilter = params.sourceFilter ?? params.sourcePlan?.query?.filter ?? null;
  const effectiveViewMode = params.effectiveViewMode ?? params.sourcePlan?.effectiveViewMode;
  const { retainedArticleIds, selectedArticleId } = params;
  if (sourceFilter === "starred" && effectiveViewMode === "all" && selectedArticleId) {
    const retainedSnapshot = [...retainedArticleIds].slice(-Math.max(0, MAX_RETAINED_ARTICLES_SNAPSHOT_SIZE - 1));
    return new Set([...retainedSnapshot, selectedArticleId]);
  }

  return retainedArticleIds;
}
