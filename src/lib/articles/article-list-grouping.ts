import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import {
  addLocalDays,
  compareDateInputsAsc,
  formatLocalHourMinute,
  formatLongDate,
  getCurrentDate,
  getStartOfLocalDay,
  parseDateInput,
} from "@/lib/datetime";
import type { SmartViewKind } from "@/lib/sidebar/smart-view.types";

export type GroupArticlesParams = {
  articles: ArticleDto[];
  groupBy: string;
  feedNameMap: Map<string, string>;
};

export type ArticleGroupLabelToken = "today" | "yesterday" | "unknown_feed" | null;

type ArticleListMarkAllReadSelection =
  | { type: "feed"; feedId: string }
  | { type: "folder"; folderId: string }
  | { type: "smart"; kind: SmartViewKind }
  | { type: "tag"; tagId: string }
  | { type: "all" };

export type ArticleListMarkAllReadCountParams = {
  selection: ArticleListMarkAllReadSelection;
  selectedFeedUnreadCount: number;
  folderUnreadCount: number;
  filteredArticles: ArticleDto[];
};

export type BuildArticleGroupItemsParams = {
  articles: ArticleDto[];
  feedNameMap: Map<string, string>;
  selectedArticleId: string | null;
  recentlyReadIds: ReadonlySet<string>;
};

function getDateGroup(dateStr: string): string {
  const date = parseDateInput(dateStr);
  if (date === null) {
    return formatArticleDateGroupInvalidFallback(dateStr);
  }

  const today = getStartOfLocalDay(getCurrentDate());
  const yesterday = addLocalDays(today, -1);
  const articleDate = getStartOfLocalDay(date);

  if (compareDateInputsAsc(articleDate, today) >= 0) return "TODAY";
  if (compareDateInputsAsc(articleDate, yesterday) >= 0) return "YESTERDAY";
  return formatLongDate(date) ?? dateStr;
}

export function formatArticleTime(dateStr: string): string {
  return formatLocalHourMinute(dateStr) ?? formatArticleTimeInvalidFallback(dateStr);
}

function formatArticleDateGroupInvalidFallback(value: string): string {
  return value;
}

function formatArticleTimeInvalidFallback(value: string): string {
  return value;
}

export function countUnreadArticles(articles: ArticleDto[]): number {
  let count = 0;
  for (const article of articles) {
    if (!article.is_read) {
      count += 1;
    }
  }
  return count;
}

export function countStarredArticles(articles: ArticleDto[]): number {
  let count = 0;
  for (const article of articles) {
    if (article.is_starred) {
      count += 1;
    }
  }
  return count;
}

export function getUnreadArticleIds(articles: ArticleDto[]): string[] {
  const unreadArticleIds: string[] = [];
  for (const article of articles) {
    if (!article.is_read) {
      unreadArticleIds.push(article.id);
    }
  }
  return unreadArticleIds;
}

export function resolveArticleListMarkAllReadCount(params: ArticleListMarkAllReadCountParams): number {
  const { selection, selectedFeedUnreadCount, folderUnreadCount, filteredArticles } = params;

  if (selection.type === "feed") {
    return selectedFeedUnreadCount;
  }

  if (selection.type === "folder") {
    return folderUnreadCount;
  }

  return getUnreadArticleIds(filteredArticles).length;
}

export function canMarkArticleListSelectionRead(selection: ArticleListMarkAllReadSelection): boolean {
  return selection.type === "feed" || selection.type === "folder";
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

export function resolveArticleGroupLabelToken(groupLabel: string): ArticleGroupLabelToken {
  if (groupLabel === "TODAY") {
    return "today";
  }

  if (groupLabel === "YESTERDAY") {
    return "yesterday";
  }

  if (groupLabel === "__unknown_feed__") {
    return "unknown_feed";
  }

  return null;
}

export function buildArticleGroupItems(params: BuildArticleGroupItemsParams) {
  const { articles, feedNameMap, selectedArticleId, recentlyReadIds } = params;

  return articles.map((article) => ({
    article,
    feedName: feedNameMap.get(article.feed_id),
    isSelected: selectedArticleId === article.id,
    isRecentlyRead: recentlyReadIds.has(article.id),
  }));
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

  const feedIds = new Set<string>();
  for (const feed of feeds ?? []) {
    if (feed.folder_id === folderId) {
      feedIds.add(feed.id);
    }
  }
  return feedIds;
}
