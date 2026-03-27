import { Result } from "@praha/byethrow";
import type { ArticleDto } from "@/api/tauri-commands";

type ViewMode = "all" | "unread" | "starred";

type SelectVisibleArticlesParams = {
  articles: ArticleDto[] | undefined;
  accountArticles: ArticleDto[] | undefined;
  tagArticles: ArticleDto[] | undefined;
  searchResults: ArticleDto[] | undefined;
  feedId: string | null;
  tagId: string | null;
  viewMode: ViewMode;
  showSearch: boolean;
  searchQuery: string;
  sortUnread: string;
};

type GroupArticlesParams = {
  articles: ArticleDto[];
  groupBy: string;
  feedNameMap: Map<string, string>;
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

export function selectVisibleArticles(params: SelectVisibleArticlesParams): ArticleDto[] {
  const {
    articles,
    accountArticles,
    tagArticles,
    searchResults,
    feedId,
    tagId,
    viewMode,
    showSearch,
    searchQuery,
    sortUnread,
  } = params;

  let list: ArticleDto[];
  if (showSearch && searchQuery.length > 0) {
    list = [...(searchResults ?? [])];
  } else if (tagId) {
    list = [...(tagArticles ?? [])];
  } else {
    const all = feedId ? (articles ?? []) : (accountArticles ?? []);
    if (viewMode === "unread") list = all.filter((article) => !article.is_read);
    else if (viewMode === "starred") list = all.filter((article) => article.is_starred);
    else list = [...all];
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
      groupBy === "feed" ? (feedNameMap.get(article.feed_id) ?? "Unknown Feed") : getDateGroup(article.published_at);
    if (!groups[group]) groups[group] = [];
    groups[group].push(article);
  }
  return groups;
}

export function getAdjacentArticleId(
  articles: ArticleDto[],
  selectedArticleId: string | null,
  direction: 1 | -1,
): Result.Result<string, "no_articles"> {
  if (articles.length === 0) {
    return Result.fail("no_articles");
  }

  const currentIndex = articles.findIndex((article) => article.id === selectedArticleId);
  const nextIndex = currentIndex === -1 ? 0 : Math.max(0, Math.min(articles.length - 1, currentIndex + direction));

  return Result.succeed(articles[nextIndex].id);
}
