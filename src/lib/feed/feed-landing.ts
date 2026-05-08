import { Result } from "@praha/byethrow";
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
  prefs: Record<string, string>;
  articleUrl: string | null | undefined;
}): ResolvedArticleDisplay {
  return resolveArticleDisplay({
    appDefault: resolveAppDefaultDisplayModes(params.prefs),
    feedOverride: resolveFeedDisplayOverrides(params.feed),
    temporaryOverride: { readerMode: null, webPreviewMode: null },
    articleCapabilities: { hasWebPreview: Boolean(params.articleUrl) },
  });
}
