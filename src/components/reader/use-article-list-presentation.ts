import type { UseArticleListPresentationParams, UseArticleListViewPropsResult } from "./article-list.types";
import { useArticleListEffects } from "./use-article-list-effects";
import { useArticleListGroups } from "./use-article-list-groups";
import { useArticleListHeaderController } from "./use-article-list-header-controller";
import { useArticleListInteractions } from "./use-article-list-interactions";
import { useArticleListViewProps } from "./use-article-list-view-props";
import { useArticleListViewState } from "./use-article-list-view-state";

export function useArticleListPresentation({
  t,
  tc,
  ts,
  selection,
  feedId,
  tagId,
  accountListScopeId,
  isLoading,
  isLoadingAccountArticles,
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
}: UseArticleListPresentationParams): UseArticleListViewPropsResult {
  const viewState = useArticleListViewState({
    selection,
    t,
    feedId,
    tagId,
    accountListScopeId,
    isLoading,
    isLoadingAccountArticles,
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
    feedId,
    selectedFeed,
    filteredArticles,
    layoutMode,
    sidebarOpen,
    sidebarSubscriptionsLabel: ts("subscriptions"),
    feedDisplayLabel: t("display_mode"),
    showSidebarLabel: t("show_sidebar"),
    hideSidebarLabel: t("hide_sidebar"),
    openSidebar,
    toggleSidebar,
  });
  const { handleMarkAllRead, ...headerControls } = headerController;

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
    viewportRef,
    filteredArticles,
    selectedArticleId,
    isPrimarySourceLoading: viewState.isPrimarySourceLoading,
    clearArticle,
  });

  return useArticleListViewProps({
    t,
    tc,
    layoutMode,
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
    isLoading,
    isLoadingAccountArticles,
    isLoadingTagArticles,
    trimmedDebouncedQuery,
    articleGroups,
    dimArchived,
    textPreview,
    imagePreviews,
    selectionStyle,
    selectArticle,
    effectiveViewMode,
    setViewMode,
    ...headerControls,
    ...viewState,
  });
}
