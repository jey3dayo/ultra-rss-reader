import { Result } from "@praha/byethrow";
import type { ArticleDto, FeedDto, FolderDto, TagDto } from "@/api/tauri-commands";
import { countUnreadArticles } from "@/lib/articles/article-list";
import { formatMediumDateOrDash, getDateInputTimeMs, parseDateInput } from "@/lib/datetime";
import { resolveFeedWebsiteHref, resolveSiteHostLabel } from "@/lib/feed/feed";
import type { ReaderSelection } from "@/lib/reader/reader-selection.types";
import { countFeedsInFolder } from "@/lib/sidebar/sidebar";
import type { SmartViewKind } from "@/lib/sidebar/smart-view.types";

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
      smartKind: SmartViewKind;
      articleCount: number;
      feedCount: number;
      latestArticlePublishedAt?: string | null;
    };

type ArticleViewSummaryStats = {
  articleCount: number;
  feedCount: number;
  latestArticlePublishedAt: string | null;
};

export type BuildArticleViewSummaryParams = {
  selection: ReaderSelection;
  selectedFeedId: string | null;
  feeds: FeedDto[] | undefined;
  folders: FolderDto[] | undefined;
  tags: TagDto[] | undefined;
  filteredArticles: ArticleDto[];
  allFeedArticles: ArticleDto[] | undefined;
};

export type BuildArticleViewSummaryError =
  | "summary_not_available"
  | "feed_not_found"
  | "folder_not_found"
  | "tag_not_found";

function buildArticleViewSummaryStats(filteredArticles: ArticleDto[]): ArticleViewSummaryStats {
  const visibleFeedIds = new Set(filteredArticles.map((article) => article.feed_id));
  const latestVisibleArticleResult = findLatestArticle(filteredArticles);
  const latestVisibleArticle = Result.isSuccess(latestVisibleArticleResult)
    ? Result.unwrap(latestVisibleArticleResult)
    : null;

  return {
    articleCount: filteredArticles.length,
    feedCount: visibleFeedIds.size,
    latestArticlePublishedAt: latestVisibleArticle?.published_at ?? null,
  };
}

export function findSelectedArticle(params: FindSelectedArticleParams): Result.Result<ArticleDto, "article_not_found"> {
  const { selectedArticleId, feedId, tagId, articles, accountArticles, tagArticles } = params;

  if (!selectedArticleId) {
    return Result.fail("article_not_found");
  }

  const sourceArticles = tagId ? tagArticles : feedId ? articles : accountArticles;
  const article = sourceArticles?.find((candidate) => candidate.id === selectedArticleId);

  return article ? Result.succeed(article) : Result.fail("article_not_found");
}

export function findLatestArticleOrNull(articles: ArticleDto[] | undefined): ArticleDto | null {
  if (!articles || articles.length === 0) {
    return null;
  }

  const [firstArticle, ...restArticles] = articles;
  if (!firstArticle) {
    return null;
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

  return latest;
}

export function findLatestArticle(articles: ArticleDto[] | undefined): Result.Result<ArticleDto, "no_articles"> {
  const latestArticle = findLatestArticleOrNull(articles);
  return latestArticle ? Result.succeed(latestArticle) : Result.fail("no_articles");
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
  return formatMediumDateOrDash(value, locale);
}

export function resolveArticleSummaryWebsiteHref(feed: FeedDto): string | null {
  return resolveFeedWebsiteHref(feed.site_url, feed.url);
}

export function resolveArticleSummaryWebsiteLabel(feed: FeedDto): string | null {
  const href = resolveArticleSummaryWebsiteHref(feed);
  return href ? resolveSiteHostLabel(feed.site_url, feed.url) : null;
}

export function buildArticleViewSummaryResult(
  params: BuildArticleViewSummaryParams,
): Result.Result<ArticleViewSummaryState, BuildArticleViewSummaryError> {
  const { selection, feeds, folders, tags, filteredArticles, allFeedArticles } = params;
  if (selection.type === "all") {
    return Result.fail("summary_not_available");
  }

  const summaryStats = buildArticleViewSummaryStats(filteredArticles);

  if (selection.type === "feed") {
    const feed = feeds?.find((candidate) => candidate.id === selection.feedId);
    const latestFeedArticleResult = findLatestArticle(allFeedArticles);
    const latestFeedArticle = Result.isSuccess(latestFeedArticleResult) ? Result.unwrap(latestFeedArticleResult) : null;

    return feed
      ? Result.succeed({
          kind: "feed",
          feed,
          latestArticleTitle: latestFeedArticle?.title ?? null,
          latestArticlePublishedAt: latestFeedArticle?.published_at ?? null,
        })
      : Result.fail("feed_not_found");
  }

  if (selection.type === "folder") {
    const folder = folders?.find((candidate) => candidate.id === selection.folderId);
    if (!folder) {
      return Result.fail("folder_not_found");
    }

    return Result.succeed({
      kind: "folder",
      folder,
      feedCount: countFeedsInFolder(feeds, folder.id),
      unreadCount: countUnreadArticles(filteredArticles),
      latestArticlePublishedAt: summaryStats.latestArticlePublishedAt,
    });
  }

  if (selection.type === "tag") {
    const tag = tags?.find((candidate) => candidate.id === selection.tagId);
    if (!tag) {
      return Result.fail("tag_not_found");
    }

    return Result.succeed({
      kind: "tag",
      tag,
      ...summaryStats,
    });
  }

  return Result.succeed({
    kind: "smart",
    smartKind: selection.kind,
    ...summaryStats,
  });
}

export function buildArticleViewSummary(params: BuildArticleViewSummaryParams): ArticleViewSummaryState | undefined {
  const result = buildArticleViewSummaryResult(params);
  return Result.isSuccess(result) ? Result.unwrap(result) : undefined;
}
