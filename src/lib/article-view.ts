import { Result } from "@praha/byethrow";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";

type FindSelectedArticleParams = {
  selectedArticleId: string | null;
  feedId: string | null;
  tagId: string | null;
  articles: ArticleDto[] | undefined;
  accountArticles: ArticleDto[] | undefined;
  tagArticles: ArticleDto[] | undefined;
};

type LinkNavigationParams = {
  openLinks: string;
  cmdClickBrowser: string;
  metaKey: boolean;
  ctrlKey: boolean;
};

type ResolveFeedDisplayModeParams = FindSelectedArticleParams & {
  selectionFeedId: string | null;
  feeds: FeedDto[] | undefined;
};

export function resolveEffectiveDisplayMode(
  feedDisplayMode: string | null | undefined,
  defaultDisplayMode: string,
): "normal" | "widescreen" {
  if (feedDisplayMode === "normal" || feedDisplayMode === "widescreen") {
    return feedDisplayMode;
  }

  return defaultDisplayMode === "widescreen" ? "widescreen" : "normal";
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

export function resolveSelectedFeedId(params: Omit<ResolveFeedDisplayModeParams, "feeds">): string | null {
  const { selectionFeedId, ...articleParams } = params;
  const articleResult = findSelectedArticle(articleParams);

  return selectionFeedId ?? (Result.isSuccess(articleResult) ? Result.unwrap(articleResult).feed_id : null);
}

export function resolveSelectedFeedDisplayMode(params: ResolveFeedDisplayModeParams): string {
  const { feeds, ...feedParams } = params;
  const resolvedFeedId = resolveSelectedFeedId(feedParams);

  if (!resolvedFeedId || !feeds) {
    return "normal";
  }

  return feeds.find((feed) => feed.id === resolvedFeedId)?.display_mode ?? "normal";
}

export function shouldOpenExternalBrowser(params: LinkNavigationParams): boolean {
  const { openLinks, cmdClickBrowser, metaKey, ctrlKey } = params;
  return (cmdClickBrowser === "true" && (metaKey || ctrlKey)) || openLinks === "default_browser";
}

export function formatArticleDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return dateStr;
  }
  return (
    date
      .toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
      .toUpperCase() +
    " AT " +
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
  );
}
