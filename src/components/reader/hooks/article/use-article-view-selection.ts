import { Result } from "@praha/byethrow";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import { useArticleListData } from "@/components/reader/hooks/article-list/use-article-list-data";
import { useArticleListSources } from "@/components/reader/hooks/article-list/use-article-list-sources";
import { useAccounts } from "@/hooks/use-accounts";
import { useArticle, useArticles, useFolderArticles, useRecentArticles } from "@/hooks/use-articles";
import { useFolders } from "@/hooks/use-folders";
import { useArticlesByTag, useTags } from "@/hooks/use-tags";
import { type ArticleViewSummaryState, buildArticleViewSummaryResult } from "@/lib/articles/article-view";
import { resolveFeedLandingDisplay } from "@/lib/feed/feed-landing";
import { resolveReaderSelectionSourceKind, resolveReaderSourceArticles } from "@/lib/reader/reader-source-articles";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

type ArticleViewEmptyState = {
  kind: "empty";
  emptyReason: "default" | "no-accounts" | "no-feeds";
  summary?: ArticleViewSummaryState;
  landingCandidate?: ArticleViewLandingCandidate;
};

export type ArticleViewSelectionState =
  | { kind: "subscriptions-index" }
  | { kind: "browser-only"; browserUrl: string }
  | ArticleViewEmptyState
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "article"; article: ArticleDto; feed?: FeedDto };

export type ArticleViewLandingCandidate = {
  article: ArticleDto;
  feed?: FeedDto;
  browserUrl: string | null;
};

function resolveEmptyArticleViewState(params: {
  accountsCount: number | undefined;
  selectedAccountId: string | null;
  feeds: FeedDto[] | undefined;
  summary: ArticleViewSummaryState | undefined;
  landingCandidate: ArticleViewLandingCandidate | undefined;
}): ArticleViewEmptyState {
  const { accountsCount, selectedAccountId, feeds, summary, landingCandidate } = params;

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
    landingCandidate,
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
  const webPreviewSessionMode = useUiStore((s) => s.webPreviewSessionMode);
  const selectedFeedId = selection.type === "feed" ? selection.feedId : null;
  const selectedFolderId = selection.type === "folder" ? selection.folderId : null;
  const selectedTagId = selection.type === "tag" ? selection.tagId : null;
  const isRecentSmartView = selection.type === "smart" && selection.kind === "recent";
  const { data: accounts } = useAccounts();
  const { data: folders } = useFolders(selectedAccountId);
  const { data: tags } = useTags();
  const { data: allFeedArticles } = useArticles(selectedFeedId, {
    mode: "all",
  });
  const { data: allFolderArticles } = useFolderArticles(selectedFolderId, {
    mode: "all",
  });
  const { data: allTagArticles } = useArticlesByTag(selectedTagId, selectedAccountId, { mode: "all" });
  const { data: allRecentArticles } = useRecentArticles(isRecentSmartView ? selectedAccountId : null, {
    mode: "all",
  });
  const { data: fullSelectedArticle, isPending: isSelectedArticlePending } = useArticle(selectedArticleId);
  const prefs = usePreferencesStore((s) => s.prefs);
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
      summaryArticles: resolveReaderSourceArticles({
        sourceKind: resolveReaderSelectionSourceKind(selection),
        feedArticles: allFeedArticles,
        folderArticles: allFolderArticles,
        tagArticles: allTagArticles,
        recentArticles: allRecentArticles,
      }),
      allFeedArticles,
    });
    const summary = Result.isSuccess(summaryResult) ? Result.unwrap(summaryResult) : undefined;
    const landingArticle = selection.type === "all" ? undefined : data.filteredArticles[0];
    const landingFeed = landingArticle
      ? sources.feeds?.find((candidate) => candidate.id === landingArticle.feed_id)
      : undefined;
    const landingDisplay = landingArticle
      ? resolveFeedLandingDisplay({
          feed: landingFeed,
          prefs,
          articleUrl: landingArticle.url,
          webPreviewSessionMode,
        })
      : null;
    const landingCandidate = landingArticle
      ? {
          article: landingArticle,
          feed: landingFeed,
          browserUrl: landingDisplay?.webPreviewMode && landingArticle.url ? landingArticle.url : null,
        }
      : undefined;

    return resolveEmptyArticleViewState({
      accountsCount: accounts?.length,
      selectedAccountId,
      feeds: sources.feeds,
      summary,
      landingCandidate,
    });
  }

  // The by-id fetch is the single source of truth for the opened article, so it works
  // regardless of which source (feed, folder, tag, smart view, search, ...) the row came
  // from. The current list is only a source-agnostic cache used for an instant render
  // while that fetch is still loading; it must never gate whether the article can open.
  const listArticle = data.filteredArticles.find((candidate) => candidate.id === selectedArticleId);
  const article = fullSelectedArticle ?? listArticle;

  if (!article) {
    if (contentMode === "browser" && browserUrl) {
      return { kind: "browser-only", browserUrl };
    }
    return isSelectedArticlePending ? { kind: "loading" } : { kind: "not-found" };
  }

  const feed = sources.feeds?.find((candidate) => candidate.id === article.feed_id);

  return { kind: "article", article, feed };
}
