import { useTranslation } from "react-i18next";
import { useArticleListData } from "@/components/reader/hooks/article-list/use-article-list-data";
import { useArticleListPresentation } from "@/components/reader/hooks/article-list/use-article-list-presentation";
import { useArticleListRuntime } from "@/components/reader/hooks/article-list/use-article-list-runtime";
import { useAccounts } from "@/hooks/use-accounts";
import { useUiStore } from "@/stores/ui-store";
import type { UseArticleListViewPropsResult } from "./article-list-controller.types";

export function useArticleListController(): UseArticleListViewPropsResult {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const { t: ts } = useTranslation("sidebar");
  const { data: accounts } = useAccounts();
  const openSubscriptionsIndex = useUiStore((state) => state.openSubscriptionsIndex);
  const {
    selection,
    selectedAccountId,
    focusedPane,
    selectedArticleId,
    selectArticle,
    clearArticle,
    openSidebar,
    toggleSidebar,
    sidebarOpen,
    setViewMode,
    layoutMode,
    recentlyReadIds,
    retainedArticleIds,
    keyboardPrefs,
    sortUnread,
    groupBy,
    dimArchived,
    textPreview,
    imagePreviews,
    selectionStyle,
    scrollToTopOnChange,
    feedId,
    folderId,
    tagId,
    sourcePlan,
    accountListScopeId,
    feeds,
    articles,
    accountArticles,
    tagArticles,
    isLoadingFeedArticles,
    isLoadingAccountArticles,
    isLoadingFolderArticles,
    isLoadingRecentArticles,
    isLoadingTagArticles,
    showSearch,
    searchQuery,
    searchInputRef,
    trimmedDebouncedQuery,
    searchResults,
    isSearching,
    openSearch,
    handleToggleSearch,
    handleCloseSearch,
    setSearchQuery,
  } = useArticleListRuntime();

  const {
    feedId: resolvedFeedId,
    tagId: resolvedTagId,
    accountListScopeId: resolvedAccountListScopeId,
    effectiveViewMode,
    feedNameMap,
    filteredArticles,
    groupedArticles,
    selectedFeed,
  } = useArticleListData({
    feedId,
    folderId,
    tagId,
    sourcePlan,
    accountListScopeId,
    selectedArticleId,
    retainedArticleIds,
    feeds,
    articles,
    accountArticles,
    tagArticles,
    searchResults,
    showSearch,
    trimmedDebouncedQuery,
    sortUnread,
    groupBy,
  });
  const onManageSelectedFeed =
    selectedAccountId !== null && selectedFeed
      ? () => {
          openSubscriptionsIndex({
            accountId: selectedAccountId,
            activeSummaryFilter: "all",
            selectedFeedId: selectedFeed.id,
            expandedGroups: {},
            listScrollTop: {
              scrollTop: 0,
              layoutGeneration: "reader-feed-manage-link",
              viewportHeight: 0,
            },
            keptFeedIds: [],
            deferredFeedIds: [],
          });
        }
      : null;

  return useArticleListPresentation({
    t,
    tc,
    ts,
    selection,
    focusedPane,
    selectedAccountId,
    accountCount: accounts?.length,
    feeds,
    feedId: resolvedFeedId,
    tagId: resolvedTagId,
    accountListScopeId: resolvedAccountListScopeId,
    isLoadingFeedArticles,
    isLoadingAccountArticles,
    isLoadingFolderArticles,
    isLoadingRecentArticles,
    isLoadingTagArticles,
    showSearch,
    trimmedDebouncedQuery,
    searchResults,
    isSearching,
    filteredArticles,
    groupedArticles,
    groupBy,
    feedNameMap,
    selectedArticleId,
    recentlyReadIds,
    selectedFeed,
    onManageSelectedFeed,
    layoutMode,
    sidebarOpen,
    openSidebar,
    toggleSidebar,
    selectArticle,
    clearArticle,
    openSearch,
    keyboardPrefs,
    scrollToTopOnChange,
    dimArchived,
    textPreview,
    imagePreviews,
    selectionStyle,
    effectiveViewMode,
    setViewMode,
    searchQuery,
    searchInputRef,
    handleToggleSearch,
    handleCloseSearch,
    setSearchQuery,
  });
}
