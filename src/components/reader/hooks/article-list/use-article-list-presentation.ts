import { useArticleListEffects } from "@/components/reader/hooks/article-list/use-article-list-effects";
import { useArticleListGroups } from "@/components/reader/hooks/article-list/use-article-list-groups";
import { useArticleListHeaderController } from "@/components/reader/hooks/article-list/use-article-list-header-controller";
import { useArticleListInteractions } from "@/components/reader/hooks/article-list/use-article-list-interactions";
import { useArticleListViewProps } from "@/components/reader/hooks/article-list/use-article-list-view-props";
import { useArticleListViewState } from "@/components/reader/hooks/article-list/use-article-list-view-state";
import type {
  ArticleListSelection,
  UseArticleListPresentationParams,
  UseArticleListViewPropsResult,
} from "./article-list-controller.types";

function getArticleListSelectionMotionKey(selection: ArticleListSelection): string {
  switch (selection.type) {
    case "feed":
      return `feed:${selection.feedId}`;
    case "folder":
      return `folder:${selection.folderId}`;
    case "smart":
      return `smart:${selection.kind}`;
    case "tag":
      return `tag:${selection.tagId}`;
    case "all":
      return "all";
  }
}

export function useArticleListPresentation({
  translators: { t, tc, ts },
  source: {
    selection,
    selectedAccountId,
    accountCount,
    feeds,
    feedId,
    tagId,
    accountListScopeId,
    filteredArticles,
    groupedArticles,
    groupBy,
    feedNameMap,
    selectedFeed,
    effectiveViewMode,
  },
  loading: {
    isLoadingFeedArticles,
    isLoadingAccountArticles,
    isLoadingFolderArticles,
    isLoadingRecentArticles,
    isLoadingTagArticles,
  },
  search: {
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
  },
  selectionState: { selectedArticleId, recentlyReadIds, focusedPane, contentMode, layoutMode, sidebarOpen },
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
  viewPrefs: { keyboardPrefs, scrollToTopOnChange, dimArchived, textPreview, imagePreviews, selectionStyle },
}: UseArticleListPresentationParams): UseArticleListViewPropsResult {
  const viewState = useArticleListViewState({
    selection,
    selectedAccountId,
    feedId,
    tagId,
    accountListScopeId,
    accountCount,
    feedCount: feeds?.length,
    isLoadingFeedArticles,
    isLoadingAccountArticles,
    isLoadingFolderArticles,
    isLoadingRecentArticles,
    isLoadingTagArticles,
    showSearch,
    trimmedDebouncedQuery,
    searchResults,
    isSearching,
    filteredArticleCount: filteredArticles.length,
  });

  const articleGroups = useArticleListGroups({
    groupedArticles,
    groupBy,
    feedNameMap,
    selectedArticleId,
    recentlyReadIds,
    t,
  });

  const headerController = useArticleListHeaderController({
    selection,
    feeds,
    feedId,
    selectedFeed,
    filteredArticles,
    layoutMode,
    sidebarOpen,
    showSearch,
    contentMode,
    sidebarSubscriptionsLabel: ts("subscriptions"),
    showSidebarLabel: t("show_sidebar"),
    hideSidebarLabel: t("hide_sidebar"),
    openSidebar,
    toggleSidebar,
    setWebPreviewSessionMode,
  });
  const { handleMarkAllRead, ...headerControls } = headerController;
  const contentMotionKey = [
    getArticleListSelectionMotionKey(selection),
    effectiveViewMode,
    showSearch ? `search:${trimmedDebouncedQuery}` : "browse",
  ].join("|");

  const { listRef, viewportRef, handleListKeyDownCapture } = useArticleListInteractions({
    filteredArticles,
    selectedArticleId,
    selectArticle,
    clearArticle,
    openSidebar,
    toggleSidebar,
    openSearch,
    handleMarkAllRead,
    keyboardPrefs,
  });

  useArticleListEffects({
    selection,
    scrollToTopOnChange,
    listRef,
    viewportRef,
    filteredArticles,
    focusedPane,
    contentMode,
    selectedArticleId,
    isPrimarySourceLoading: viewState.isPrimarySourceLoading,
    isSearchLoading: viewState.isSearchLoading,
    clearArticle,
    closeBrowser,
  });

  return useArticleListViewProps({
    t,
    tc,
    selection,
    layoutMode,
    contentMode,
    showSearch,
    searchQuery,
    searchInputRef,
    handleMarkAllRead,
    handleToggleSearch,
    handleCloseSearch,
    setSearchQuery,
    listRef,
    viewportRef,
    handleListKeyDownCapture,
    isLoadingFeedArticles,
    isLoadingAccountArticles,
    isLoadingFolderArticles,
    isLoadingRecentArticles,
    isLoadingTagArticles,
    trimmedDebouncedQuery,
    contentMotionKey,
    articleGroups,
    feeds,
    dimArchived,
    textPreview,
    imagePreviews,
    selectionStyle,
    selectArticle,
    onManageSelectedFeed,
    effectiveViewMode,
    setViewMode,
    ...headerControls,
    ...viewState,
  });
}
