import { Result } from "@praha/byethrow";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import { useArticleListData } from "@/components/reader/hooks/article-list/use-article-list-data";
import { useArticleListSources } from "@/components/reader/hooks/article-list/use-article-list-sources";
import { useAccounts } from "@/hooks/use-accounts";
import { useArticles } from "@/hooks/use-articles";
import { useFolders } from "@/hooks/use-folders";
import { useTags } from "@/hooks/use-tags";
import {
  type ArticleViewSummaryState,
  buildArticleViewSummaryResult,
  findSelectedArticle,
} from "@/lib/articles/article-view";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

type ArticleViewEmptyState = {
  kind: "empty";
  emptyReason: "default" | "no-accounts" | "no-feeds";
  summary?: ArticleViewSummaryState;
};

export type ArticleViewSelectionState =
  | { kind: "subscriptions-index" }
  | { kind: "browser-only"; browserUrl: string }
  | ArticleViewEmptyState
  | { kind: "not-found" }
  | { kind: "article"; article: ArticleDto; feed?: FeedDto };

function resolveEmptyArticleViewState(params: {
  accountsCount: number | undefined;
  selectedAccountId: string | null;
  feeds: FeedDto[] | undefined;
  summary: ArticleViewSummaryState | undefined;
}): ArticleViewEmptyState {
  const { accountsCount, selectedAccountId, feeds, summary } = params;

  if (accountsCount === 0) {
    return { kind: "empty", emptyReason: "no-accounts" };
  }

  if (selectedAccountId !== null && feeds !== undefined && feeds.length === 0) {
    return { kind: "empty", emptyReason: "no-feeds" };
  }

  return {
    kind: "empty",
    emptyReason: "default",
    summary,
  };
}

export function useArticleViewSelection(): ArticleViewSelectionState {
  const contentMode = useUiStore((s) => s.contentMode);
  const browserUrl = useUiStore((s) => s.browserUrl);
  const subscriptionsWorkspace = useUiStore((s) => s.subscriptionsWorkspace);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectedArticleId = useUiStore((s) => s.selectedArticleId);
  const selection = useUiStore((s) => s.selection);
  const retainedArticleIds = useUiStore((s) => s.retainedArticleIds);
  const viewMode = useUiStore((s) => s.viewMode);
  const selectedFeedId = selection.type === "feed" ? selection.feedId : null;
  const { data: accounts } = useAccounts();
  const { data: folders } = useFolders(selectedAccountId);
  const { data: tags } = useTags();
  const { data: allFeedArticles } = useArticles(selectedFeedId);
  const sortUnread = usePreferencesStore((s) => s.prefs.reading_sort ?? s.prefs.sort_unread ?? "newest_first");
  const groupBy = usePreferencesStore((s) => s.prefs.group_by ?? "date");
  const sources = useArticleListSources({
    selection,
    selectedAccountId,
    selectedArticleId,
    retainedArticleIds,
    viewMode,
  });
  const data = useArticleListData({
    feedId: sources.feedId,
    folderId: sources.folderId,
    tagId: sources.tagId,
    sourcePlan: sources.sourcePlan,
    accountListScopeId: sources.accountListScopeId,
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

  if (contentMode === "browser" && browserUrl && !selectedArticleId) {
    return { kind: "browser-only", browserUrl };
  }

  if (contentMode === "empty" || !selectedArticleId) {
    const summaryResult = buildArticleViewSummaryResult({
      selection,
      selectedFeedId,
      feeds: sources.feeds,
      folders,
      tags,
      filteredArticles: data.filteredArticles,
      allFeedArticles,
    });
    const summary = Result.isSuccess(summaryResult) ? Result.unwrap(summaryResult) : undefined;

    return resolveEmptyArticleViewState({
      accountsCount: accounts?.length,
      selectedAccountId,
      feeds: sources.feeds,
      summary,
    });
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
