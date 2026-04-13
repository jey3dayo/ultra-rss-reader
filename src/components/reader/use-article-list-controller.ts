import { useTranslation } from "react-i18next";
import { useArticleListData } from "./use-article-list-data";
import { useArticleListEffects } from "./use-article-list-effects";
import { useArticleListGroups } from "./use-article-list-groups";
import { useArticleListHeaderActions } from "./use-article-list-header-actions";
import { useArticleListHeaderControls } from "./use-article-list-header-controls";
import { useArticleListInteractions } from "./use-article-list-interactions";
import { useArticleListSearch } from "./use-article-list-search";
import { useArticleListSources } from "./use-article-list-sources";
import { useArticleListUiState } from "./use-article-list-ui-state";
import { useArticleListViewProps } from "./use-article-list-view-props";
import { useArticleListViewState } from "./use-article-list-view-state";

export function useArticleListController() {
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

  const { contextStripContext, footerModes, isPrimarySourceLoading, isSearchLoading, isSearchEmptyState } =
    useArticleListViewState({
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

  const { selectedFeedDisplayPreset, displayPresetOptions, handleSetDisplayMode, handleMarkAllRead } =
    useArticleListHeaderActions({
      feedId: resolvedFeedId,
      selectedFeed,
      filteredArticles,
    });

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
    isPrimarySourceLoading,
    clearArticle,
  });

  const {
    showSidebarButton,
    sidebarButtonLabel,
    sidebarButtonText,
    isSidebarVisible,
    feedModeControl,
    handleSidebarToggle,
  } = useArticleListHeaderControls({
    layoutMode,
    sidebarOpen,
    sidebarSubscriptionsLabel: ts("subscriptions"),
    feedDisplayLabel: t("display_mode"),
    showSidebarLabel: t("show_sidebar"),
    hideSidebarLabel: t("hide_sidebar"),
    resolvedFeedId,
    selectedFeedDisplayPreset,
    displayPresetOptions,
    onSetDisplayMode: (value) => {
      void handleSetDisplayMode(value);
    },
    openSidebar,
    toggleSidebar,
  });

  return useArticleListViewProps({
    t,
    tc,
    layoutMode,
    showSearch,
    searchQuery,
    searchInputRef,
    showSidebarButton,
    sidebarButtonLabel,
    sidebarButtonText,
    isSidebarVisible,
    feedModeControl,
    handleMarkAllRead,
    handleSidebarToggle,
    handleToggleSearch,
    handleCloseSearch,
    setSearchQuery,
    contextStripContext,
    listRef,
    viewportRef,
    handleListKeyDownCapture,
    isLoading,
    isLoadingAccountArticles,
    isLoadingTagArticles,
    isSearchLoading,
    isSearchEmptyState,
    trimmedDebouncedQuery,
    articleGroups,
    dimArchived,
    textPreview,
    imagePreviews,
    selectionStyle,
    selectArticle,
    effectiveViewMode,
    footerModes,
    setViewMode,
  });
}
