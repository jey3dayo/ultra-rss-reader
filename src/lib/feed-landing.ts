import type { ArticleDto } from "@/api/tauri-commands";
import {
  type ResolvedArticleDisplay,
  resolveAppDefaultDisplayModes,
  resolveArticleDisplay,
  resolveFeedDisplayOverrides,
} from "@/lib/article-display";
import { selectVisibleArticles } from "@/lib/article-list";

export function resolveFeedLandingArticle(params: { articles: ArticleDto[]; sortUnread: string }): ArticleDto | null {
  const visibleArticles = selectVisibleArticles({
    articles: params.articles,
    accountArticles: undefined,
    tagArticles: undefined,
    searchResults: undefined,
    feedId: "__feed_landing__",
    tagId: null,
    viewMode: "unread",
    showSearch: false,
    searchQuery: "",
    sortUnread: params.sortUnread,
    retainedArticleIds: new Set<string>(),
  });

  return visibleArticles[0] ?? null;
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
