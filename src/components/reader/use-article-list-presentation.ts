import type { TFunction } from "i18next";
import type { UseArticleListViewPropsResult } from "./article-list.types";
import { useArticleListEffects } from "./use-article-list-effects";
import { useArticleListGroups } from "./use-article-list-groups";
import { useArticleListHeaderController } from "./use-article-list-header-controller";
import { useArticleListInteractions } from "./use-article-list-interactions";
import { useArticleListViewProps } from "./use-article-list-view-props";
import { useArticleListViewState } from "./use-article-list-view-state";

type UseArticleListPresentationParams = {
  t: TFunction<"reader">;
  tc: TFunction<"common">;
  ts: TFunction<"sidebar">;
  selection: Parameters<typeof useArticleListViewState>[0]["selection"];
  feedId: string | null;
  tagId: string | null;
  accountListScopeId: string | null;
  isLoading: boolean;
  isLoadingAccountArticles: boolean;
  isLoadingTagArticles: boolean;
  showSearch: boolean;
  trimmedDebouncedQuery: string;
  searchResults: Parameters<typeof useArticleListViewState>[0]["searchResults"];
  isSearching: boolean;
  filteredArticles: Parameters<typeof useArticleListEffects>[0]["filteredArticles"];
  groupedArticles: Parameters<typeof useArticleListGroups>[0]["groupedArticles"];
  groupBy: Parameters<typeof useArticleListGroups>[0]["groupBy"];
  feedNameMap: Parameters<typeof useArticleListGroups>[0]["feedNameMap"];
  selectedArticleId: string | null;
  recentlyReadIds: Parameters<typeof useArticleListGroups>[0]["recentlyReadIds"];
  selectedFeed: Parameters<typeof useArticleListHeaderController>[0]["selectedFeed"];
  layoutMode: Parameters<typeof useArticleListHeaderController>[0]["layoutMode"];
  sidebarOpen: boolean;
  openSidebar: () => void;
  toggleSidebar: () => void;
  selectArticle: (articleId: string) => void;
  clearArticle: () => void;
  openSearch: () => void;
  keyboardPrefs: Parameters<typeof useArticleListInteractions>[0]["keyboardPrefs"];
  scrollToTopOnChange: string;
  dimArchived: string;
  textPreview: string;
  imagePreviews: string;
  selectionStyle: string;
  effectiveViewMode: Parameters<typeof useArticleListViewProps>[0]["effectiveViewMode"];
  setViewMode: Parameters<typeof useArticleListViewProps>[0]["setViewMode"];
  searchQuery: string;
  searchInputRef: Parameters<typeof useArticleListViewProps>[0]["searchInputRef"];
  handleToggleSearch: () => void;
  handleCloseSearch: () => void;
  setSearchQuery: (value: string) => void;
};

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
