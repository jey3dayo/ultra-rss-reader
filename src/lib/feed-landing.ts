import type { ArticleDto } from "@/api/tauri-commands";
import { selectVisibleArticles } from "@/lib/article-list";
import { resolveEffectiveDisplayMode } from "@/lib/article-view";

export function resolveFeedLandingArticle(params: {
  articles: ArticleDto[];
  sortUnread: string;
}): ArticleDto | null {
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

export function resolveFeedLandingMode(params: {
  feedDisplayMode: string | null | undefined;
  defaultDisplayMode: string;
  articleUrl: string | null | undefined;
}): "reader" | "browser" {
  if (!params.articleUrl) {
    return "reader";
  }

  return resolveEffectiveDisplayMode(params.feedDisplayMode, params.defaultDisplayMode) === "widescreen"
    ? "browser"
    : "reader";
}
