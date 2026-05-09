import { Result } from "@praha/byethrow";
import type { PreferencesDto } from "@/api/schemas/preferences";
import type { ArticleDto } from "@/api/tauri-commands";
import {
  type ResolvedArticleDisplay,
  resolveAppDefaultDisplayModes,
  resolveArticleDisplay,
  resolveFeedDisplayOverrides,
} from "@/lib/articles/article-display";
import { selectVisibleArticles } from "@/lib/articles/article-list";
import type { ReaderFilter } from "@/lib/reader/reader-query";

export type ResolveFeedLandingArticleError = "no_visible_article";

export function hasWebPreviewUrl(articleUrl: string | null | undefined): boolean {
  if (articleUrl === null || articleUrl === undefined) {
    return false;
  }

  try {
    const parsedUrl = new URL(articleUrl.trim());
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
  } catch {
    return false;
  }
}

export function resolveFeedLandingArticleResult(params: {
  articles: ArticleDto[];
  sortUnread: string;
  viewMode?: ReaderFilter;
}): Result.Result<ArticleDto, ResolveFeedLandingArticleError> {
  const visibleArticles = selectVisibleArticles({
    articles: undefined,
    accountArticles: params.articles,
    tagArticles: undefined,
    searchResults: undefined,
    feedId: null,
    tagId: null,
    viewMode: params.viewMode ?? "unread",
    sourceFilter: null,
    showSearch: false,
    searchQuery: "",
    sortUnread: params.sortUnread,
    retainedArticleIds: new Set<string>(),
  });

  const landingArticle = visibleArticles[0];
  return landingArticle ? Result.succeed(landingArticle) : Result.fail("no_visible_article");
}

export function resolveFeedLandingArticle(params: {
  articles: ArticleDto[];
  sortUnread: string;
  viewMode?: ReaderFilter;
}): ArticleDto | null {
  const result = resolveFeedLandingArticleResult(params);
  return Result.isSuccess(result) ? Result.unwrap(result) : null;
}

export function resolveFeedLandingDisplay(params: {
  feed:
    | {
        reader_mode?: string | null;
        web_preview_mode?: string | null;
      }
    | null
    | undefined;
  prefs: PreferencesDto;
  articleUrl: string | null | undefined;
}): ResolvedArticleDisplay {
  return resolveArticleDisplay({
    appDefault: resolveAppDefaultDisplayModes(params.prefs),
    feedOverride: resolveFeedDisplayOverrides(params.feed),
    temporaryOverride: { readerMode: null, webPreviewMode: null },
    articleCapabilities: { hasWebPreview: hasWebPreviewUrl(params.articleUrl) },
  });
}
