import { useTranslation } from "react-i18next";
import { useArticleListData } from "./use-article-list-data";
import { useArticleListEffects } from "./use-article-list-effects";
import { useArticleListGroups } from "./use-article-list-groups";
import { useArticleListHeaderController } from "./use-article-list-header-controller";
import { useArticleListInteractions } from "./use-article-list-interactions";
import { useArticleListSearch } from "./use-article-list-search";
import { useArticleListSources } from "./use-article-list-sources";
import { useArticleListUiState } from "./use-article-list-ui-state";
import { type UseArticleListViewPropsResult, useArticleListViewProps } from "./use-article-list-view-props";
import { useArticleListViewState } from "./use-article-list-view-state";

export function useArticleListController(): UseArticleListViewPropsResult {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const { t: ts } = useTranslation("sidebar");
  const uiState = useArticleListUiState();
  const {
    selection,
    selectedAccountId,
    selectedArticleId,
    selectArticle,
    clearArticle,
    openSidebar,
    toggleSidebar,
    sidebarOpen,
    viewMode,
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
  } = uiState;

  const {
    feedId,
    folderId,
    tagId,
    smartViewKind,
    accountListScopeId,
    feeds,
    articles,
    accountArticles,
    tagArticles,
    isLoading,
    isLoadingAccountArticles,
    isLoadingTagArticles,
  } = useArticleListSources({
    selection,
    selectedAccountId,
  });

  const {
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
  } = useArticleListSearch({ selectedAccountId });

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
    selection,
    feedId,
    folderId,
    tagId,
    smartViewKind,
    accountListScopeId,
    viewMode,
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

  const viewState = useArticleListViewState({
    selection,
    t,
    feedId: resolvedFeedId,
    tagId: resolvedTagId,
    accountListScopeId: resolvedAccountListScopeId,
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
    feedId: resolvedFeedId,
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
