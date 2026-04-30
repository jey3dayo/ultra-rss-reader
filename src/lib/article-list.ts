import { Result } from "@praha/byethrow";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import {
  addLocalDays,
  compareDateInputsAsc,
  formatLocalHourMinute,
  getCurrentDate,
  getStartOfLocalDay,
  parseDateInput,
} from "@/lib/datetime";

type ViewMode = "all" | "unread" | "starred";

export type SelectVisibleArticlesParams = {
  articles: ArticleDto[] | undefined;
  accountArticles: ArticleDto[] | undefined;
  tagArticles: ArticleDto[] | undefined;
  searchResults: ArticleDto[] | undefined;
  feedId: string | null;
  tagId: string | null;
  folderFeedIds?: ReadonlySet<string> | null;
  viewMode: ViewMode;
  smartViewKind?: "unread" | "starred" | "recent" | null;
  showSearch: boolean;
  searchQuery: string;
  sortUnread: string;
  retainedArticleIds?: ReadonlySet<string>;
};

export type GroupArticlesParams = {
  articles: ArticleDto[];
  groupBy: string;
  feedNameMap: Map<string, string>;
};

export type CalculateArticleNavigationScrollTopParams = {
  currentScrollTop: number;
  viewportTop: number;
  viewportHeight: number;
  itemTop: number;
  itemHeight: number;
  direction: 1 | -1;
  stickyTopOffset?: number;
  edgePadding?: number;
  maxScrollTop?: number;
};

export type RetainedArticlesSnapshot = {
  contextKey: string;
  articles: ArticleDto[];
};

function getDateGroup(dateStr: string): string {
  const date = parseDateInput(dateStr);
  if (date === null) {
    return dateStr;
  }

  const today = getStartOfLocalDay(getCurrentDate());
  const yesterday = addLocalDays(today, -1);
  const articleDate = getStartOfLocalDay(date);

  if (compareDateInputsAsc(articleDate, today) >= 0) return "TODAY";
  if (compareDateInputsAsc(articleDate, yesterday) >= 0) return "YESTERDAY";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatArticleTime(dateStr: string): string {
  return formatLocalHourMinute(dateStr) ?? dateStr;
}

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

function filterByViewMode(
  articles: ArticleDto[],
  viewMode: ViewMode,
  smartViewKind: "unread" | "starred" | "recent" | null | undefined,
  retainedArticleIds: ReadonlySet<string> | undefined,
): ArticleDto[] {
  const starredSmartView = smartViewKind === "starred";

  // In unread/starred views, keep the current row visible until the user changes
  // screens. Marking an article read/starred should not make it disappear mid-click.
  if (starredSmartView) {
    const starred = articles.filter((article) => article.is_starred || retainedArticleIds?.has(article.id));
    return viewMode === "unread"
      ? starred.filter((article) => !article.is_read || retainedArticleIds?.has(article.id))
      : starred;
  }

  if (viewMode === "unread") {
    return articles.filter((article) => !article.is_read || retainedArticleIds?.has(article.id));
  }

  if (viewMode === "starred") {
    return articles.filter((article) => article.is_starred || retainedArticleIds?.has(article.id));
  }

  return [...articles];
}

export function areArticleListsEquivalent(left: ArticleDto[], right: ArticleDto[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((article, index) => {
    const candidate = right[index];
    return (
      candidate !== undefined &&
      article.id === candidate.id &&
      article.is_read === candidate.is_read &&
      article.is_starred === candidate.is_starred &&
      article.title === candidate.title
    );
  });
}

export function collectRetainedArticlesFromSources(params: {
  retainedArticleIds: ReadonlySet<string>;
  sources: Array<ArticleDto[] | undefined>;
}): ArticleDto[] {
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

export function mergeRetainedArticlesSnapshot(params: {
  previous: RetainedArticlesSnapshot | null;
  contextKey: string;
  retainedArticleIds: ReadonlySet<string>;
  currentRetainedArticles: ArticleDto[];
}): RetainedArticlesSnapshot | null {
  const { previous, contextKey, retainedArticleIds, currentRetainedArticles } = params;
  const preservedArticles =
    previous?.contextKey === contextKey
      ? previous.articles.filter((article) => retainedArticleIds.has(article.id))
      : [];
  const merged = new Map(preservedArticles.map((article) => [article.id, article]));
  for (const article of currentRetainedArticles) {
    merged.set(article.id, article);
  }

  if (merged.size === 0) {
    return null;
  }

  const nextSnapshot = {
    contextKey,
    articles: [...merged.values()],
  };

  if (
    previous?.contextKey === nextSnapshot.contextKey &&
    areArticleListsEquivalent(previous.articles, nextSnapshot.articles)
  ) {
    return previous;
  }

  return nextSnapshot;
}

export function mergeResolvedArticlesWithRetained(params: {
  resolvedPrimarySourceArticles: ArticleDto[] | undefined;
  retainedArticlesSnapshot: RetainedArticlesSnapshot | null;
  retainedArticleIds: ReadonlySet<string>;
  contextKey: string;
}): ArticleDto[] | undefined {
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
    smartViewKind,
    showSearch,
    searchQuery,
    sortUnread,
    retainedArticleIds,
  } = params;

  let list: ArticleDto[];
  if (showSearch && searchQuery.length > 0) {
    list = filterByViewMode(
      filterByFolderFeedIds([...(searchResults ?? [])], folderFeedIds),
      viewMode,
      smartViewKind,
      retainedArticleIds,
    );
  } else if (tagId) {
    list = [...(tagArticles ?? [])];
  } else {
    list = filterByViewMode(
      filterByFolderFeedIds(feedId ? (articles ?? []) : (accountArticles ?? []), folderFeedIds),
      viewMode,
      smartViewKind,
      retainedArticleIds,
    );
  }

  if (smartViewKind === "recent") {
    return list;
  }

  const direction = sortUnread === "oldest_first" ? 1 : -1;
  list.sort((a, b) => compareDateInputsAsc(a.published_at, b.published_at) * direction);
  return list;
}

export function countUnreadArticles(articles: ArticleDto[]): number {
  return articles.filter((article) => !article.is_read).length;
}

export function getUnreadArticleIds(articles: ArticleDto[]): string[] {
  return articles.filter((article) => !article.is_read).map((article) => article.id);
}

export function groupArticles(params: GroupArticlesParams): Record<string, ArticleDto[]> {
  const { articles, groupBy, feedNameMap } = params;

  if (groupBy === "none") {
    return { "": articles };
  }

  const groups: Record<string, ArticleDto[]> = {};
  for (const article of articles) {
    const group =
      groupBy === "feed"
        ? (feedNameMap.get(article.feed_id) ?? "__unknown_feed__")
        : getDateGroup(article.published_at);
    if (!groups[group]) groups[group] = [];
    groups[group].push(article);
  }
  return groups;
}

export function buildArticleListFeedNameMap(feeds: FeedDto[] | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const feed of feeds ?? []) {
    map.set(feed.id, feed.title);
  }
  return map;
}

export function buildFolderFeedIdSet(feeds: FeedDto[] | undefined, folderId: string | null): Set<string> | null {
  if (!folderId) {
    return null;
  }

  return new Set((feeds ?? []).filter((feed) => feed.folder_id === folderId).map((feed) => feed.id));
}

export function getAdjacentItemId(
  ids: readonly string[],
  selectedId: string | null,
  direction: 1 | -1,
): Result.Result<string, "no_items"> {
  if (ids.length === 0) {
    return Result.fail("no_items");
  }

  const currentIndex = ids.indexOf(selectedId ?? "");
  const nextIndex = currentIndex === -1 ? 0 : Math.max(0, Math.min(ids.length - 1, currentIndex + direction));
  const nextItemId = ids[nextIndex];

  if (!nextItemId) {
    return Result.fail("no_items");
  }

  return Result.succeed(nextItemId);
}

export function getAdjacentArticleId(
  articles: ArticleDto[],
  selectedArticleId: string | null,
  direction: 1 | -1,
): Result.Result<string, "no_articles"> {
  const nextArticleId = getAdjacentItemId(
    articles.map((article) => article.id),
    selectedArticleId,
    direction,
  );

  if (Result.isFailure(nextArticleId)) {
    return Result.fail("no_articles");
  }

  return Result.succeed(Result.unwrap(nextArticleId));
}

export function calculateArticleNavigationScrollTop(params: CalculateArticleNavigationScrollTopParams): number | null {
  const {
    currentScrollTop,
    viewportTop,
    viewportHeight,
    itemTop,
    itemHeight,
    direction,
    stickyTopOffset = 0,
    edgePadding = 12,
    maxScrollTop = Number.POSITIVE_INFINITY,
  } = params;

  const topBoundary = viewportTop + stickyTopOffset + edgePadding;
  const bottomBoundary = viewportTop + viewportHeight - edgePadding;
  const itemBottom = itemTop + itemHeight;

  let nextScrollTop: number | null = null;

  if (direction === -1) {
    nextScrollTop = currentScrollTop + (itemTop - topBoundary);
  } else if (itemBottom > bottomBoundary) {
    nextScrollTop = currentScrollTop + (itemBottom - bottomBoundary);
  } else if (itemTop < topBoundary) {
    nextScrollTop = currentScrollTop - (topBoundary - itemTop);
  }

  if (nextScrollTop === null) {
    return null;
  }

  const clampedScrollTop = Math.max(0, Math.min(maxScrollTop, nextScrollTop));
  return clampedScrollTop === currentScrollTop ? null : clampedScrollTop;
}
