import { Result } from "@praha/byethrow";
import type { ArticleDto } from "@/api/tauri-commands";

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
  smartViewKind?: "unread" | "starred" | null;
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

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const articleDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (articleDate.getTime() >= today.getTime()) return "TODAY";
  if (articleDate.getTime() >= yesterday.getTime()) return "YESTERDAY";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatArticleTime(dateStr: string): string {
  const date = new Date(dateStr);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
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
  smartViewKind: "unread" | "starred" | null | undefined,
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

  const direction = sortUnread === "oldest_first" ? 1 : -1;
  list.sort((a, b) => (new Date(a.published_at).getTime() - new Date(b.published_at).getTime()) * direction);
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

export function getAdjacentItemId(
  ids: readonly string[],
  selectedId: string | null,
  direction: 1 | -1,
): string | null {
  if (ids.length === 0) {
    return null;
  }

  const currentIndex = ids.indexOf(selectedId ?? "");
  const nextIndex = currentIndex === -1 ? 0 : Math.max(0, Math.min(ids.length - 1, currentIndex + direction));
  return ids[nextIndex] ?? null;
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

  if (!nextArticleId) {
    return Result.fail("no_articles");
  }

  return Result.succeed(nextArticleId);
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
