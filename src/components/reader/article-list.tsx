import { ContextMenu } from "@base-ui/react/context-menu";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccountArticles, useArticles, useMarkAllRead } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { useFeeds } from "@/hooks/use-feeds";
import { useArticlesByTag } from "@/hooks/use-tags";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import {
  displayPresetToTriStateModes,
  feedModesToDisplayPresetOption,
  resolveFeedDisplayOverrides,
} from "@/lib/article-display";
import { getUnreadArticleIds, groupArticles, selectVisibleArticles } from "@/lib/article-list";
import { buildKeyToActionMap } from "@/lib/keyboard-shortcuts";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { ArticleContextMenu } from "./article-context-menu";
import { ArticleListContextStrip } from "./article-list-context-strip";
import { ArticleListFooter } from "./article-list-footer";
import { ArticleListHeader } from "./article-list-header";
import { ArticleListScreenView } from "./article-list-screen-view";
import { contextMenuStyles } from "./context-menu-styles";
import { useArticleListGroups } from "./use-article-list-groups";
import { useArticleListInteractions } from "./use-article-list-interactions";
import { useArticleListSearch } from "./use-article-list-search";
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
  const confirmMarkAllRead = useConfirmMarkAllRead();
  const updateFeedDisplaySettings = useUpdateFeedDisplaySettings();
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const folderId = selection.type === "folder" ? selection.folderId : null;
  const tagId = selection.type === "tag" ? selection.tagId : null;
  const smartViewKind = selection.type === "smart" ? selection.kind : null;
  const accountListScopeId = feedId || tagId ? null : selectedAccountId;
  const { data: articles, isLoading } = useArticles(feedId);
  const { data: accountArticles, isLoading: isLoadingAccountArticles } = useAccountArticles(accountListScopeId);
  const { data: tagArticles, isLoading: isLoadingTagArticles } = useArticlesByTag(tagId, selectedAccountId);
  const { data: feeds } = useFeeds(selectedAccountId);
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
  const effectiveViewMode = useMemo<"all" | "unread" | "starred">(() => {
    if (smartViewKind === "unread") {
      return "unread";
    }

    if (smartViewKind === "starred") {
      return viewMode === "unread" ? "unread" : "all";
    }

    return viewMode;
  }, [smartViewKind, viewMode]);
  const effectiveRetainedArticleIds = useMemo(() => {
    if (
      selection.type === "smart" &&
      selection.kind === "starred" &&
      effectiveViewMode === "all" &&
      selectedArticleId
    ) {
      return new Set([...retainedArticleIds, selectedArticleId]);
    }

    return retainedArticleIds;
  }, [effectiveViewMode, retainedArticleIds, selectedArticleId, selection]);

  const feedNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of feeds ?? []) map.set(f.id, f.title);
    return map;
  }, [feeds]);
  const folderFeedIds = useMemo(() => {
    if (!folderId) return null;
    return new Set((feeds ?? []).filter((feed) => feed.folder_id === folderId).map((feed) => feed.id));
  }, [feeds, folderId]);

  const filteredArticles = useMemo(() => {
    return selectVisibleArticles({
      articles,
      accountArticles,
      tagArticles,
      searchResults,
      feedId,
      tagId,
      folderFeedIds,
      viewMode: effectiveViewMode,
      smartViewKind,
      showSearch,
      searchQuery: trimmedDebouncedQuery,
      sortUnread,
      retainedArticleIds: effectiveRetainedArticleIds,
    });
  }, [
    effectiveRetainedArticleIds,
    accountArticles,
    articles,
    feedId,
    folderFeedIds,
    tagArticles,
    tagId,
    effectiveViewMode,
    smartViewKind,
    showSearch,
    trimmedDebouncedQuery,
    searchResults,
    sortUnread,
  ]);

  const groupedArticles = useMemo(() => {
    return groupArticles({
      articles: filteredArticles,
      groupBy,
      feedNameMap,
    });
  }, [filteredArticles, groupBy, feedNameMap]);
  const keyToAction = useMemo(() => buildKeyToActionMap(keyboardPrefs), [keyboardPrefs]);

  const { contextStripContext, footerModes, isPrimarySourceLoading, isSearchLoading, isSearchEmptyState } =
    useArticleListViewState({
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

  useEffect(() => {
    if (!selectedArticleId || isPrimarySourceLoading) {
      return;
    }

    const isSelectedArticleVisible = filteredArticles.some((article) => article.id === selectedArticleId);
    if (!isSelectedArticleVisible) {
      clearArticle();
    }
  }, [clearArticle, filteredArticles, isPrimarySourceLoading, selectedArticleId]);

  const articleGroups = useArticleListGroups({
    groupedArticles,
    groupBy,
    feedNameMap,
    selectedArticleId,
    recentlyReadIds,
    t,
  });

  const listRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollToTopOnChange = usePreferencesStore((s) => s.prefs.scroll_to_top_on_change ?? "true");
  const markAllRead = useMarkAllRead();

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to top when selection changes
  useEffect(() => {
    if (scrollToTopOnChange === "true" && viewportRef.current) {
      viewportRef.current.scrollTop = 0;
    }
  }, [selection, scrollToTopOnChange]);

  const selectedFeed = useMemo(() => feeds?.find((f) => f.id === feedId), [feeds, feedId]);
  const selectedFeedDisplayPreset = feedModesToDisplayPresetOption(
    resolveFeedDisplayOverrides(selectedFeed).readerMode,
    resolveFeedDisplayOverrides(selectedFeed).webPreviewMode,
  );
  const displayPresetOptions = useMemo(
    () => [
      { value: "default", label: t("display_mode_default") },
      { value: "standard", label: t("display_mode_standard") },
      { value: "preview", label: t("display_mode_preview") },
    ],
    [t],
  );

  const handleSetDisplayMode = useCallback(
    async (nextPreset: "default" | "standard" | "preview") => {
      if (!feedId) return;
      const nextModes = displayPresetToTriStateModes(nextPreset);
      await updateFeedDisplaySettings(feedId, nextModes.readerMode, nextModes.webPreviewMode);
    },
    [feedId, updateFeedDisplaySettings],
  );

  const doMarkAllRead = useCallback(() => {
    const unreadIds = getUnreadArticleIds(filteredArticles);
    markAllRead.mutate(unreadIds);
  }, [filteredArticles, markAllRead]);

  const handleMarkAllRead = useCallback(() => {
    const unreadIds = getUnreadArticleIds(filteredArticles);
    confirmMarkAllRead({ count: unreadIds.length, onConfirm: doMarkAllRead });
  }, [filteredArticles, confirmMarkAllRead, doMarkAllRead]);

  const handleSidebarToggle = useCallback(() => {
    if (layoutMode === "wide") {
      toggleSidebar();
      return;
    }
    openSidebar();
  }, [layoutMode, openSidebar, toggleSidebar]);
  const { handleListKeyDownCapture } = useArticleListInteractions({
    filteredArticles,
    selectedArticleId,
    selectArticle,
    clearArticle,
    openSidebar,
    toggleSidebar,
    openSearch,
    handleMarkAllRead,
    keyToAction,
    listRef,
    viewportRef,
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
        showSidebarButton={layoutMode === "mobile" || layoutMode === "wide" || layoutMode === "compact"}
        sidebarButtonLabel={
          layoutMode === "wide" ? t(sidebarOpen ? "hide_sidebar" : "show_sidebar") : t("show_sidebar")
        }
        sidebarButtonText={layoutMode === "compact" ? ts("subscriptions") : undefined}
        isSidebarVisible={layoutMode === "wide" ? sidebarOpen : undefined}
        feedModeControl={
          feedId ? (
            <Select
              name="feed-display-preset"
              value={selectedFeedDisplayPreset}
              onValueChange={(value) =>
                value !== null && void handleSetDisplayMode(value as typeof selectedFeedDisplayPreset)
              }
            >
              <SelectTrigger aria-label={t("display_mode")} className="min-w-[168px]">
                <SelectValue>
                  {(value: string | null) =>
                    displayPresetOptions.find((option) => option.value === (value ?? ""))?.label ?? value ?? ""
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {displayPresetOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          ) : null
        }
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

      {/* Article List */}
      <ContextMenu.Root>
        <ContextMenu.Trigger render={<div />} className="flex-1 overflow-hidden">
          <ArticleListScreenView
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
            renderRow={({ article, content }) => <ArticleContextMenu article={article}>{content}</ArticleContextMenu>}
          />
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup className={contextMenuStyles.popup}>
              <ContextMenu.Item className={contextMenuStyles.item} onClick={handleMarkAllRead}>
                {t("mark_all_as_read")}
              </ContextMenu.Item>
            </ContextMenu.Popup>
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      <ArticleListFooter viewMode={effectiveViewMode} modes={footerModes} onSetViewMode={setViewMode} />
    </div>
  );
}
