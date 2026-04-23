import { Result } from "@praha/byethrow";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import { useAccounts } from "@/hooks/use-accounts";
import { findSelectedArticle } from "@/lib/article-view";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { getPrimarySourceContext } from "./article-selection-context";
import { useArticleListData } from "./use-article-list-data";
import { useArticleListSources } from "./use-article-list-sources";

export type ArticleViewSelectionState =
  | { kind: "subscriptions-index" }
  | { kind: "feed-cleanup" }
  | { kind: "browser-only"; browserUrl: string }
  | { kind: "empty"; emptyReason: "default" | "no-accounts" | "no-feeds" }
  | { kind: "not-found" }
  | { kind: "article"; article: ArticleDto; feed?: FeedDto };

export function useArticleViewSelection(): ArticleViewSelectionState {
  const contentMode = useUiStore((s) => s.contentMode);
  const browserUrl = useUiStore((s) => s.browserUrl);
  const subscriptionsWorkspace = useUiStore((s) => s.subscriptionsWorkspace);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectedArticleId = useUiStore((s) => s.selectedArticleId);
  const selection = useUiStore((s) => s.selection);
  const retainedArticleIds = useUiStore((s) => s.retainedArticleIds);
  const viewMode = useUiStore((s) => s.viewMode);
  const { data: accounts } = useAccounts();
  const sortUnread = usePreferencesStore((s) => s.prefs.reading_sort ?? s.prefs.sort_unread ?? "newest_first");
  const groupBy = usePreferencesStore((s) => s.prefs.group_by ?? "date");
  const selectionContext = getPrimarySourceContext(selection, selectedAccountId);
  const sources = useArticleListSources({
    selection,
    selectionContext,
    selectedAccountId,
    selectedArticleId,
    retainedArticleIds,
    viewMode,
  });
  const data = useArticleListData({
    selection,
    feedId: sources.feedId,
    folderId: sources.folderId,
    tagId: sources.tagId,
    smartViewKind: sources.smartViewKind,
    accountListScopeId: sources.accountListScopeId,
    viewMode,
    selectedArticleId,
    retainedArticleIds,
    feeds: sources.feeds,
    articles: sources.articles,
    accountArticles: sources.accountArticles,
    tagArticles: sources.tagArticles,
    searchResults: undefined,
    showSearch: false,
    trimmedDebouncedQuery: "",
    sortUnread,
    groupBy,
  });

  if (subscriptionsWorkspace?.kind === "index") {
    return { kind: "subscriptions-index" };
  }

  if (subscriptionsWorkspace?.kind === "cleanup") {
    return { kind: "feed-cleanup" };
  }

  if (contentMode === "browser" && browserUrl && !selectedArticleId) {
    return { kind: "browser-only", browserUrl };
  }

  if (contentMode === "empty" || !selectedArticleId) {
    if (accounts?.length === 0) {
      return { kind: "empty", emptyReason: "no-accounts" };
    }

    if (selectedAccountId !== null && sources.feeds !== undefined && sources.feeds.length === 0) {
      return { kind: "empty", emptyReason: "no-feeds" };
    }

    return { kind: "empty", emptyReason: "default" };
  }

  const articleResult = findSelectedArticle({
    selectedArticleId,
    feedId: data.feedId,
    tagId: data.tagId,
    articles: data.filteredArticles,
    accountArticles: data.filteredArticles,
    tagArticles: data.filteredArticles,
  });

  if (Result.isFailure(articleResult)) {
    if (contentMode === "browser" && browserUrl) {
      return { kind: "browser-only", browserUrl };
    }
    return { kind: "not-found" };
  }

  const article = Result.unwrap(articleResult);
  const feed = sources.feeds?.find((candidate) => candidate.id === article.feed_id);

  return { kind: "article", article, feed };
}
