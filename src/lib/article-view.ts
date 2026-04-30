import { Result } from "@praha/byethrow";
import type { ArticleDto, FeedDto, FolderDto, TagDto } from "@/api/tauri-commands";
import { formatMediumDate, getDateInputTimeMs, parseDateInput } from "@/lib/datetime";
import { countFeedsInFolder } from "@/lib/sidebar";

export type FindSelectedArticleParams = {
  selectedArticleId: string | null;
  feedId: string | null;
  tagId: string | null;
  articles: ArticleDto[] | undefined;
  accountArticles: ArticleDto[] | undefined;
  tagArticles: ArticleDto[] | undefined;
};

export type LinkNavigationParams = {
  openLinks: string;
  metaKey: boolean;
  ctrlKey: boolean;
};

export type ArticleViewSummaryState =
  | {
      kind: "feed";
      feed: FeedDto;
      latestArticleTitle?: string | null;
      latestArticlePublishedAt?: string | null;
    }
  | {
      kind: "folder";
      folder: FolderDto;
      feedCount: number;
      unreadCount: number;
      latestArticlePublishedAt?: string | null;
    }
  | {
      kind: "tag";
      tag: TagDto;
      articleCount: number;
      feedCount: number;
      latestArticlePublishedAt?: string | null;
    }
  | {
      kind: "smart";
      smartKind: "unread" | "starred" | "recent";
      articleCount: number;
      feedCount: number;
      latestArticlePublishedAt?: string | null;
    };

export function findSelectedArticle(params: FindSelectedArticleParams): Result.Result<ArticleDto, "article_not_found"> {
  const { selectedArticleId, feedId, tagId, articles, accountArticles, tagArticles } = params;

  if (!selectedArticleId) {
    return Result.fail("article_not_found");
  }

  const sourceArticles = tagId ? tagArticles : feedId ? articles : accountArticles;
  const article = sourceArticles?.find((candidate) => candidate.id === selectedArticleId);

  return article ? Result.succeed(article) : Result.fail("article_not_found");
}

export function findLatestArticle(articles: ArticleDto[] | undefined): Result.Result<ArticleDto, "no_articles"> {
  if (!articles || articles.length === 0) {
    return Result.fail("no_articles");
  }

  const [firstArticle, ...restArticles] = articles;
  if (!firstArticle) {
    return Result.fail("no_articles");
  }

  const latest = restArticles.reduce<ArticleDto>((currentLatest, candidate) => {
    const latestTime = getDateInputTimeMs(currentLatest.published_at);
    const candidateTime = getDateInputTimeMs(candidate.published_at);

    if (latestTime === null) {
      return candidate;
    }

    if (candidateTime === null) {
      return currentLatest;
    }

    return candidateTime > latestTime ? candidate : currentLatest;
  }, firstArticle);

  return Result.succeed(latest);
}

export function shouldOpenArticleTitleInExternalBrowser(params: LinkNavigationParams): boolean {
  const { openLinks, metaKey, ctrlKey } = params;
  return metaKey || ctrlKey || openLinks === "default_browser";
}

export function resolveArticleDateLocale(locale: string | undefined): string {
  if (!locale) {
    return "en";
  }

  const normalized = locale.toLowerCase();
  if (normalized.startsWith("ja")) {
    return "ja";
  }

  if (normalized.startsWith("en")) {
    return locale;
  }

  return "en";
}

export function formatArticleDate(dateStr: string, locale = "en-US"): string {
  const date = parseDateInput(dateStr);
  if (date === null) {
    return dateStr;
  }

  const resolvedLocale = locale || "en-US";

  if (!resolvedLocale.toLowerCase().startsWith("en")) {
    return date.toLocaleString(resolvedLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    date
      .toLocaleDateString(resolvedLocale, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
      .toUpperCase() +
    " AT " +
    date.toLocaleTimeString(resolvedLocale, {
      hour: "numeric",
      minute: "2-digit",
    })
  );
}

export function formatArticleSummaryDate(value: string | null | undefined, locale: string): string {
  return formatMediumDate(value, locale) ?? "—";
}

export function resolveArticleSummaryWebsiteHref(feed: FeedDto): string | null {
  return feed.site_url || feed.url || null;
}

export function resolveArticleSummaryWebsiteLabel(feed: FeedDto): string | null {
  const href = resolveArticleSummaryWebsiteHref(feed);
  if (!href) {
    return null;
  }

  try {
    return new URL(href).host;
  } catch {
    return href;
  }
}

export function buildArticleViewSummary(params: {
  selection:
    | { type: "all" }
    | { type: "feed"; feedId: string }
    | { type: "folder"; folderId: string }
    | { type: "tag"; tagId: string }
    | { type: "smart"; kind: "unread" | "starred" | "recent" };
  selectedFeedId: string | null;
  feeds: FeedDto[] | undefined;
  folders: FolderDto[] | undefined;
  tags: TagDto[] | undefined;
  filteredArticles: ArticleDto[];
  allFeedArticles: ArticleDto[] | undefined;
}): ArticleViewSummaryState | undefined {
  const { selection, selectedFeedId, feeds, folders, tags, filteredArticles, allFeedArticles } = params;
  if (selection.type === "all") {
    return undefined;
  }

  const visibleFeedIds = new Set(filteredArticles.map((article) => article.feed_id));
  const latestVisibleArticleResult = findLatestArticle(filteredArticles);
  const latestVisibleArticle = Result.isSuccess(latestVisibleArticleResult)
    ? Result.unwrap(latestVisibleArticleResult)
    : null;

  if (selection.type === "feed") {
    const feed = selectedFeedId ? feeds?.find((candidate) => candidate.id === selectedFeedId) : undefined;
    const latestFeedArticleResult = findLatestArticle(allFeedArticles);
    const latestFeedArticle = Result.isSuccess(latestFeedArticleResult) ? Result.unwrap(latestFeedArticleResult) : null;

    return feed
      ? {
          kind: "feed",
          feed,
          latestArticleTitle: latestFeedArticle?.title ?? null,
          latestArticlePublishedAt: latestFeedArticle?.published_at ?? null,
        }
      : undefined;
  }

  if (selection.type === "folder") {
    const folder = folders?.find((candidate) => candidate.id === selection.folderId);
    if (!folder) {
      return undefined;
    }

    return {
      kind: "folder",
      folder,
      feedCount: countFeedsInFolder(feeds, folder.id),
      unreadCount: filteredArticles.filter((article) => !article.is_read).length,
      latestArticlePublishedAt: latestVisibleArticle?.published_at ?? null,
    };
  }

  if (selection.type === "tag") {
    const tag = tags?.find((candidate) => candidate.id === selection.tagId);
    if (!tag) {
      return undefined;
    }

    return {
      kind: "tag",
      tag,
      articleCount: filteredArticles.length,
      feedCount: visibleFeedIds.size,
      latestArticlePublishedAt: latestVisibleArticle?.published_at ?? null,
    };
  }

  return {
    kind: "smart",
    smartKind: selection.kind,
    articleCount: filteredArticles.length,
    feedCount: visibleFeedIds.size,
    latestArticlePublishedAt: latestVisibleArticle?.published_at ?? null,
  };
}
