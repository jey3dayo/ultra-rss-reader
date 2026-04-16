import { Result } from "@praha/byethrow";
import type { ArticleDto } from "@/api/tauri-commands";

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

export function findSelectedArticle(params: FindSelectedArticleParams): Result.Result<ArticleDto, "article_not_found"> {
  const { selectedArticleId, feedId, tagId, articles, accountArticles, tagArticles } = params;

  if (!selectedArticleId) {
    return Result.fail("article_not_found");
  }

  const sourceArticles = tagId ? tagArticles : feedId ? articles : accountArticles;
  const article = sourceArticles?.find((candidate) => candidate.id === selectedArticleId);

  return article ? Result.succeed(article) : Result.fail("article_not_found");
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
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return dateStr;
  }

  const resolvedLocale = locale || "en-US";

  if (!resolvedLocale.toLowerCase().startsWith("en")) {
    return date.toLocaleString(resolvedLocale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
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
