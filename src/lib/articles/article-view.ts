import { Result } from "@praha/byethrow";
import type { ArticleDto, FeedDto, FolderDto, TagDto } from "@/api/tauri-commands";
import { normalizeReaderContentImageUrl } from "@/lib/content/html";
import { formatMediumDateOrDash, getDateInputTimeMs, parseDateInput, resolveDateTimeLocale } from "@/lib/datetime";
import { resolveFeedWebsiteHref, resolveSiteHostLabel } from "@/lib/feed/feed";
import { countFeedsInFolder } from "@/lib/sidebar/sidebar";
import type { SmartViewKind } from "@/lib/sidebar/smart-view.types";

export type LinkNavigationParams = {
  openLinks: string;
  metaKey: boolean;
  ctrlKey: boolean;
};

export type ArticleViewSummaryState =
  | {
      kind: "feed";
      feed: FeedDto;
      articleCount: number;
      feedCount: number;
      todayArticleCount: number;
      weekArticleCount: number;
      recentFeeds: ArticleViewSummaryFeed[];
      latestArticleTitle?: string | null;
      latestArticlePublishedAt?: string | null;
    }
  | {
      kind: "folder";
      folder: FolderDto;
      feedCount: number;
      unreadCount: number;
      articleCount: number;
      todayArticleCount: number;
      weekArticleCount: number;
      recentFeeds: ArticleViewSummaryFeed[];
      latestArticlePublishedAt?: string | null;
    }
  | {
      kind: "tag";
      tag: TagDto;
      articleCount: number;
      feedCount: number;
      unreadCount: number;
      todayArticleCount: number;
      weekArticleCount: number;
      recentFeeds: ArticleViewSummaryFeed[];
      latestArticlePublishedAt?: string | null;
    }
  | {
      kind: "smart";
      smartKind: SmartViewKind;
      articleCount: number;
      feedCount: number;
      unreadCount: number;
      todayArticleCount: number;
      weekArticleCount: number;
      recentFeeds: ArticleViewSummaryFeed[];
      latestArticlePublishedAt?: string | null;
    };

type ArticleViewSummaryStats = {
  articleCount: number;
  feedCount: number;
  todayArticleCount: number;
  weekArticleCount: number;
  latestArticlePublishedAt: string | null;
};

type ArticleViewSummarySelection =
  | { type: "feed"; feedId: string }
  | { type: "folder"; folderId: string }
  | { type: "smart"; kind: SmartViewKind }
  | { type: "tag"; tagId: string }
  | { type: "all" };

export type ArticleViewSummaryFeed = Pick<FeedDto, "id" | "title" | "url" | "site_url" | "unread_count">;

export type BuildArticleViewSummaryParams = {
  selection: ArticleViewSummarySelection;
  selectedFeedId: string | null;
  feeds: FeedDto[] | undefined;
  folders: FolderDto[] | undefined;
  tags: TagDto[] | undefined;
  filteredArticles: ArticleDto[];
  summaryArticles?: ArticleDto[] | undefined;
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
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - 6);
  const todayStartTime = todayStart.getTime();
  const weekStartTime = weekStart.getTime();
  const todayArticleCount = filteredArticles.filter((article) => {
    const publishedTime = getDateInputTimeMs(article.published_at);
    return publishedTime !== null && publishedTime >= todayStartTime;
  }).length;
  const weekArticleCount = filteredArticles.filter((article) => {
    const publishedTime = getDateInputTimeMs(article.published_at);
    return publishedTime !== null && publishedTime >= weekStartTime;
  }).length;

  return {
    articleCount: filteredArticles.length,
    feedCount: visibleFeedIds.size,
    todayArticleCount,
    weekArticleCount,
    latestArticlePublishedAt: latestVisibleArticle?.published_at ?? null,
  };
}

function countUnreadFeedsInFolder(feeds: FeedDto[] | undefined, folderId: string): number {
  return (feeds ?? []).reduce((total, feed) => {
    if (feed.folder_id !== folderId) {
      return total;
    }

    return total + feed.unread_count;
  }, 0);
}

function buildLatestArticleTimeByFeedId(articles: ArticleDto[]): Map<string, number> {
  const latestTimeByFeedId = new Map<string, number>();

  for (const article of articles) {
    const articleTime = getDateInputTimeMs(article.published_at);
    if (articleTime === null) {
      continue;
    }

    const currentLatestTime = latestTimeByFeedId.get(article.feed_id);
    if (currentLatestTime === undefined || articleTime > currentLatestTime) {
      latestTimeByFeedId.set(article.feed_id, articleTime);
    }
  }

  return latestTimeByFeedId;
}

function buildRecentSummaryFeeds({
  feeds,
  feedIds,
  articles,
}: {
  feeds: FeedDto[] | undefined;
  feedIds: Set<string> | undefined;
  articles: ArticleDto[];
}): ArticleViewSummaryFeed[] {
  const candidates = feeds?.filter((feed) => (feedIds ? feedIds.has(feed.id) : true)) ?? [];
  const latestTimeByFeedId = buildLatestArticleTimeByFeedId(articles);

  return candidates
    .toSorted((a, b) => {
      const aLatestTime = latestTimeByFeedId.get(a.id) ?? Number.NEGATIVE_INFINITY;
      const bLatestTime = latestTimeByFeedId.get(b.id) ?? Number.NEGATIVE_INFINITY;
      if (aLatestTime !== bLatestTime) {
        return bLatestTime - aLatestTime;
      }

      return a.title.localeCompare(b.title);
    })
    .slice(0, 6)
    .map((feed) => ({
      id: feed.id,
      title: feed.title,
      url: feed.url,
      site_url: feed.site_url,
      unread_count: feed.unread_count,
    }));
}

function buildFeedIdsFromArticles(articles: ArticleDto[]): Set<string> {
  return new Set(articles.map((article) => article.feed_id));
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

    if (latestTime === null && candidateTime === null) {
      return currentLatest;
    }

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

function findLatestArticle(articles: ArticleDto[] | undefined): Result.Result<ArticleDto, "no_articles"> {
  const latestArticle = findLatestArticleOrNull(articles);
  return latestArticle ? Result.succeed(latestArticle) : Result.fail("no_articles");
}

export function shouldOpenArticleTitleInExternalBrowser(params: LinkNavigationParams): boolean {
  const { openLinks, metaKey, ctrlKey } = params;
  return metaKey || ctrlKey || openLinks === "default_browser";
}

export function normalizeArticleRemoteImageUrl(value: string | null | undefined): string | null {
  return normalizeReaderContentImageUrl(value);
}

export function resolveArticleDateLocale(locale: string | undefined): string {
  if (!locale) {
    return "en";
  }

  const safeLocale = resolveSafeArticleDateLocale(locale);
  const normalized = locale.toLowerCase();

  if (safeLocale === ARTICLE_DATE_LOCALE_FALLBACK) {
    return safeLocale;
  }

  if (normalized.startsWith("ja")) {
    return "ja";
  }

  if (normalized.startsWith("en")) {
    return locale;
  }

  return "en";
}

const ARTICLE_DATE_LOCALE_FALLBACK = "en-US";

function resolveSafeArticleDateLocale(locale: string): string {
  return resolveDateTimeLocale(locale, ARTICLE_DATE_LOCALE_FALLBACK) ?? ARTICLE_DATE_LOCALE_FALLBACK;
}

export function formatArticleDate(dateStr: string, locale = "en-US"): string {
  const date = parseDateInput(dateStr);
  if (date === null) {
    return formatArticleDateInvalidFallback(dateStr);
  }

  const resolvedLocale = resolveSafeArticleDateLocale(locale || ARTICLE_DATE_LOCALE_FALLBACK);

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

function formatArticleDateInvalidFallback(value: string): string {
  return value;
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

  const summaryArticles = params.summaryArticles ?? filteredArticles;
  const summaryStats = buildArticleViewSummaryStats(summaryArticles);

  if (selection.type === "feed") {
    const feed = feeds?.find((candidate) => candidate.id === selection.feedId);
    const latestFeedArticleResult = findLatestArticle(
      allFeedArticles?.filter((article) => article.feed_id === selection.feedId),
    );
    const latestFeedArticle = Result.isSuccess(latestFeedArticleResult) ? Result.unwrap(latestFeedArticleResult) : null;

    return feed
      ? Result.succeed({
          kind: "feed",
          feed,
          articleCount: summaryStats.articleCount,
          feedCount: 1,
          todayArticleCount: summaryStats.todayArticleCount,
          weekArticleCount: summaryStats.weekArticleCount,
          recentFeeds: buildRecentSummaryFeeds({
            feeds,
            feedIds: new Set([feed.id]),
            articles: summaryArticles,
          }),
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
      unreadCount: countUnreadFeedsInFolder(feeds, folder.id),
      articleCount: summaryStats.articleCount,
      todayArticleCount: summaryStats.todayArticleCount,
      weekArticleCount: summaryStats.weekArticleCount,
      recentFeeds: buildRecentSummaryFeeds({
        feeds,
        feedIds: new Set((feeds ?? []).filter((feed) => feed.folder_id === folder.id).map((feed) => feed.id)),
        articles: summaryArticles,
      }),
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
      unreadCount: filteredArticles.filter((article) => !article.is_read).length,
      recentFeeds: buildRecentSummaryFeeds({
        feeds,
        feedIds: buildFeedIdsFromArticles(summaryArticles),
        articles: summaryArticles,
      }),
    });
  }

  return Result.succeed({
    kind: "smart",
    smartKind: selection.kind,
    ...summaryStats,
    unreadCount: filteredArticles.filter((article) => !article.is_read).length,
    recentFeeds: buildRecentSummaryFeeds({
      feeds,
      feedIds: buildFeedIdsFromArticles(summaryArticles),
      articles: summaryArticles,
    }),
  });
}

export function buildArticleViewSummary(params: BuildArticleViewSummaryParams): ArticleViewSummaryState | undefined {
  const result = buildArticleViewSummaryResult(params);
  return Result.isSuccess(result) ? Result.unwrap(result) : undefined;
}
