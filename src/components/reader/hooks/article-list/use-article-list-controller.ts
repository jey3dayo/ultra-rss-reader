import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { useArticleListData } from "@/components/reader/hooks/article-list/use-article-list-data";
import { useArticleListPresentation } from "@/components/reader/hooks/article-list/use-article-list-presentation";
import { useArticleListRuntime } from "@/components/reader/hooks/article-list/use-article-list-runtime";
import { useAccounts } from "@/hooks/use-accounts";
import type { UseArticleListViewPropsResult } from "./article-list-controller.types";

export function useArticleListController(): UseArticleListViewPropsResult {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const { t: ts } = useTranslation("sidebar");
  const { data: accounts } = useAccounts();
  const [feedEditState, setFeedEditState] = useState<{ feedSnapshot: FeedDto; open: boolean } | null>(null);
  const {
    selection,
    selectedAccountId,
    focusedPane,
    selectedArticleId,
    contentMode,
    selectArticle,
    clearArticle,
    closeBrowser,
    openSidebar,
    toggleSidebar,
    setWebPreviewSessionMode,
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
    source,
    showSearch,
    searchQuery,
    searchInputRef,
    trimmedDebouncedQuery,
    searchResults,
    isSearching,
    isSearchError,
    searchError,
    openSearch,
    handleToggleSearch,
    handleCloseSearch,
    setSearchQuery,
  } = useArticleListRuntime();
  const isActivePane = focusedPane === "list";

  const {
    feedId: resolvedFeedId,
    effectiveViewMode,
    feedNameMap,
    filteredArticles,
    groupedArticles,
    selectedFeed,
  } = useArticleListData({
    source,
    selectedArticleId,
    retainedArticleIds,
    searchResults,
    showSearch,
    trimmedDebouncedQuery,
    sortUnread,
    groupBy,
  });
  const { feeds, isLoadingArticles, isArticlesError, articlesError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    source;
  const onManageSelectedFeed =
    selectedAccountId !== null && selectedFeed
      ? () => {
          setFeedEditState({ feedSnapshot: selectedFeed, open: true });
        }
      : null;

  const viewProps = useArticleListPresentation({
    translators: { t, tc, ts },
    source: {
      selection,
      selectedAccountId,
      accountCount: accounts?.length,
      feeds,
      isLoadingArticles,
      isArticlesError,
      articlesError,
      feedId: resolvedFeedId,
      filteredArticles,
      groupedArticles,
      groupBy,
      feedNameMap,
      selectedFeed,
      effectiveViewMode,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
    },
    search: {
      showSearch,
      searchQuery,
      searchInputRef,
      trimmedDebouncedQuery,
      isSearching,
      isSearchError,
      searchError,
      openSearch,
      handleToggleSearch,
      handleCloseSearch,
      setSearchQuery,
    },
    selectionState: {
      selectedArticleId,
      recentlyReadIds,
      focusedPane,
      contentMode,
      layoutMode,
      sidebarOpen,
    },
    paneActions: {
      selectArticle,
      clearArticle,
      closeBrowser,
      openSidebar,
      toggleSidebar,
      setWebPreviewSessionMode,
      setViewMode,
      onManageSelectedFeed,
    },
    viewPrefs: {
      keyboardPrefs,
      scrollToTopOnChange,
      isActivePane,
      dimArchived,
      textPreview,
      imagePreviews,
      selectionStyle,
    },
  });

  return {
    ...viewProps,
    feedEditDialogProps: feedEditState
      ? {
          feed: feedEditState.feedSnapshot,
          open: feedEditState.open,
          onOpenChange: (open) => setFeedEditState((previous) => (previous ? { ...previous, open } : null)),
        }
      : undefined,
  };
}
