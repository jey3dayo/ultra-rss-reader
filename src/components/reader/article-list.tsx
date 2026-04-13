import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { ArticleListBody } from "./article-list-body";
import { ArticleListContextStrip } from "./article-list-context-strip";
import { ArticleListFooter } from "./article-list-footer";
import { ArticleListHeader } from "./article-list-header";
import { useArticleListData } from "./use-article-list-data";
import { useArticleListEffects } from "./use-article-list-effects";
import { useArticleListGroups } from "./use-article-list-groups";
import { useArticleListHeaderActions } from "./use-article-list-header-actions";
import { useArticleListHeaderControls } from "./use-article-list-header-controls";
import { useArticleListInteractions } from "./use-article-list-interactions";
import { useArticleListSearch } from "./use-article-list-search";
import { useArticleListSources } from "./use-article-list-sources";
import { useArticleListViewState } from "./use-article-list-view-state";

export function ArticleList() {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const { t: ts } = useTranslation("sidebar");
  const selection = useUiStore((s) => s.selection);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectedArticleId = useUiStore((s) => s.selectedArticleId);
  const selectArticle = useUiStore((s) => s.selectArticle);
  const clearArticle = useUiStore((s) => s.clearArticle);
  const openSidebar = useUiStore((s) => s.openSidebar);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const layoutMode = useUiStore((s) => s.layoutMode);
  const sortUnread = usePreferencesStore((s) => s.prefs.reading_sort ?? s.prefs.sort_unread ?? "newest_first");
  const groupBy = usePreferencesStore((s) => s.prefs.group_by ?? "date");
  const keyboardPrefs = usePreferencesStore((s) => s.prefs);
  const dimArchived = usePreferencesStore((s) => s.prefs.dim_archived ?? "true");
  const textPreview = usePreferencesStore((s) => s.prefs.text_preview ?? "true");
  const imagePreviews = usePreferencesStore((s) => s.prefs.image_previews ?? "medium");
  const selectionStyle = usePreferencesStore((s) => s.prefs.list_selection_style ?? "modern");
  const recentlyReadIds = useUiStore((s) => s.recentlyReadIds);
  const retainedArticleIds = useUiStore((s) => s.retainedArticleIds);
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

  const scrollToTopOnChange = usePreferencesStore((s) => s.prefs.scroll_to_top_on_change ?? "true");
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

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-border bg-card",
        layoutMode === "mobile" ? "w-full" : "w-[380px]",
      )}
    >
      <ArticleListHeader
        showSearch={showSearch}
        searchQuery={searchQuery}
        searchInputRef={searchInputRef}
        showSidebarButton={showSidebarButton}
        sidebarButtonLabel={sidebarButtonLabel}
        sidebarButtonText={sidebarButtonText}
        isSidebarVisible={isSidebarVisible}
        feedModeControl={feedModeControl}
        onMarkAllRead={handleMarkAllRead}
        onToggleSidebar={handleSidebarToggle}
        onToggleSearch={handleToggleSearch}
        onCloseSearch={handleCloseSearch}
        onSearchQueryChange={setSearchQuery}
      />
      <ArticleListContextStrip
        primaryLabel={contextStripContext.primaryLabel}
        secondaryLabel={contextStripContext.secondaryLabel}
        tone={contextStripContext.tone}
      />
      <ArticleListBody
        listAriaLabel={t("article_list")}
        listRef={listRef}
        viewportRef={viewportRef}
        onListKeyDownCapture={handleListKeyDownCapture}
        isLoading={isLoading || isLoadingAccountArticles || isLoadingTagArticles || isSearchLoading}
        loadingMessage={tc("loading")}
        emptyMessage={
          isSearchEmptyState ? t("search_no_results_title", { query: trimmedDebouncedQuery }) : t("no_articles")
        }
        emptyDescription={isSearchEmptyState ? t("search_no_results_description") : undefined}
        emptyActionLabel={isSearchEmptyState ? t("clear_search_action") : undefined}
        onEmptyAction={isSearchEmptyState ? handleCloseSearch : undefined}
        groups={articleGroups}
        dimArchived={dimArchived}
        textPreview={textPreview}
        imagePreviews={imagePreviews}
        selectionStyle={selectionStyle}
        onSelectArticle={selectArticle}
        markAllReadLabel={t("mark_all_as_read")}
        onMarkAllRead={handleMarkAllRead}
      />

      <ArticleListFooter viewMode={effectiveViewMode} modes={footerModes} onSetViewMode={setViewMode} />
    </div>
  );
}
