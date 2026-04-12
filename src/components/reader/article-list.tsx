import { ContextMenu } from "@base-ui/react/context-menu";
import { Result } from "@praha/byethrow";
import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APP_EVENTS } from "@/constants/events";
import { useAccountArticles, useArticles, useMarkAllRead, useSearchArticles } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { useFeeds } from "@/hooks/use-feeds";
import { useArticlesByTag } from "@/hooks/use-tags";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import {
  displayPresetToTriStateModes,
  feedModesToDisplayPresetOption,
  resolveFeedDisplayOverrides,
} from "@/lib/article-display";
import { executeAction } from "@/lib/actions";
import {
  calculateArticleNavigationScrollTop,
  getAdjacentArticleId,
  getUnreadArticleIds,
  groupArticles,
  selectVisibleArticles,
} from "@/lib/article-list";
import { emitDebugInputTrace } from "@/lib/debug-input-trace";
import { buildKeyToActionMap, keyboardEvents, resolveKeyboardAction } from "@/lib/keyboard-shortcuts";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { ArticleContextMenu } from "./article-context-menu";
import type { ArticleGroupsViewGroup } from "./article-groups-view";
import { ArticleListContextStrip } from "./article-list-context-strip";
import { ArticleListFooter } from "./article-list-footer";
import { ArticleListHeader } from "./article-list-header";
import { ArticleListScreenView } from "./article-list-screen-view";
import { contextMenuStyles } from "./context-menu-styles";

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
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search query to avoid excessive IPC calls
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const trimmedDebouncedQuery = debouncedQuery.trim();
  const { data: searchResults, isFetching: isSearching } = useSearchArticles(selectedAccountId, trimmedDebouncedQuery);
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

  const contextStripContext = useMemo(() => {
    if (selection.type !== "smart") {
      return { primaryLabel: null, secondaryLabel: null, tone: null };
    }

    if (selection.kind === "unread") {
      return { primaryLabel: t("unread"), secondaryLabel: null, tone: "unread" as const };
    }

    return {
      primaryLabel: t("starred"),
      secondaryLabel: null,
      tone: "starred" as const,
    };
  }, [selection, t]);

  const footerModes = useMemo<ReadonlyArray<"all" | "unread" | "starred">>(() => {
    if (selection.type !== "smart") {
      return ["unread", "all", "starred"];
    }

    if (selection.kind === "unread") {
      return [];
    }

    return ["unread", "all"];
  }, [selection]);

  const isPrimarySourceLoading = feedId
    ? isLoading
    : tagId
      ? isLoadingTagArticles
      : accountListScopeId != null && isLoadingAccountArticles;

  const isSearchLoading = showSearch && trimmedDebouncedQuery.length > 0 && searchResults === undefined && isSearching;
  const isSearchEmptyState =
    showSearch && trimmedDebouncedQuery.length > 0 && !isSearchLoading && filteredArticles.length === 0;

  useEffect(() => {
    if (!selectedArticleId || isPrimarySourceLoading) {
      return;
    }

    const isSelectedArticleVisible = filteredArticles.some((article) => article.id === selectedArticleId);
    if (!isSelectedArticleVisible) {
      clearArticle();
    }
  }, [clearArticle, filteredArticles, isPrimarySourceLoading, selectedArticleId]);

  const articleGroups = useMemo<ArticleGroupsViewGroup[]>(() => {
    return Object.entries(groupedArticles).map(([groupLabel, groupArticles]) => ({
      id: groupLabel,
      label:
        groupLabel === "TODAY"
          ? t("today")
          : groupLabel === "YESTERDAY"
            ? t("yesterday")
            : groupLabel === "__unknown_feed__"
              ? t("unknown_feed")
              : groupLabel,
      showLabel: groupBy !== "none",
      items: groupArticles.map((article) => ({
        article,
        feedName: feedNameMap.get(article.feed_id),
        isSelected: selectedArticleId === article.id,
        isRecentlyRead: recentlyReadIds.has(article.id),
      })),
    }));
  }, [feedNameMap, groupBy, groupedArticles, recentlyReadIds, selectedArticleId, t]);

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
      Result.pipe(await updateFeedDisplaySettings(feedId, nextModes.readerMode, nextModes.webPreviewMode));
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

  const openSearch = useCallback(() => {
    setShowSearch(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const handleToggleSearch = useCallback(() => {
    setShowSearch((v) => !v);
    if (!showSearch) openSearch();
    else setSearchQuery("");
  }, [showSearch, openSearch]);

  const handleCloseSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery("");
  }, []);

  const handleSidebarToggle = useCallback(() => {
    if (layoutMode === "wide") {
      toggleSidebar();
      return;
    }
    openSidebar();
  }, [layoutMode, openSidebar, toggleSidebar]);

  const navigateArticle = useCallback(
    (direction: 1 | -1) => {
      const nextArticleId = getAdjacentArticleId(filteredArticles, selectedArticleId, direction);
      if (Result.isFailure(nextArticleId)) {
        return;
      }

      const articleId = Result.unwrap(nextArticleId);
      const viewport = viewportRef.current;
      const btn = listRef.current?.querySelector<HTMLElement>(`[data-article-id="${articleId}"]`);

      selectArticle(articleId);

      if (!viewport || !btn) {
        return;
      }

      const stickyHeaderHeight =
        listRef.current?.querySelector<HTMLElement>("[data-group-header]")?.getBoundingClientRect().height ?? 0;
      const viewportRect = viewport.getBoundingClientRect();
      const buttonRect = btn.getBoundingClientRect();
      const nextScrollTop = calculateArticleNavigationScrollTop({
        currentScrollTop: viewport.scrollTop,
        viewportTop: viewportRect.top,
        viewportHeight: viewport.clientHeight,
        itemTop: buttonRect.top,
        itemHeight: buttonRect.height,
        direction,
        stickyTopOffset: stickyHeaderHeight,
        maxScrollTop: viewport.scrollHeight - viewport.clientHeight,
      });

      if (nextScrollTop !== null) {
        viewport.scrollTop = nextScrollTop;
      }

      btn.focus({ preventScroll: true });
    },
    [filteredArticles, selectedArticleId, selectArticle],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const direction = (e as CustomEvent<1 | -1>).detail;
      navigateArticle(direction);
    };
    window.addEventListener(APP_EVENTS.navigateArticle, handler);
    return () => window.removeEventListener(APP_EVENTS.navigateArticle, handler);
  }, [navigateArticle]);

  useEffect(() => {
    const handleFocusSearch = () => openSearch();
    const handleMarkAllReadEvent = () => {
      void handleMarkAllRead();
    };

    window.addEventListener(keyboardEvents.focusSearch, handleFocusSearch);
    window.addEventListener(keyboardEvents.markAllRead, handleMarkAllReadEvent);
    return () => {
      window.removeEventListener(keyboardEvents.focusSearch, handleFocusSearch);
      window.removeEventListener(keyboardEvents.markAllRead, handleMarkAllReadEvent);
    };
  }, [handleMarkAllRead, openSearch]);

  const handleListKeyDownCapture = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('[role="option"]')) {
        return;
      }

      const action = resolveKeyboardAction({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        targetTag: target.tagName,
        selectedArticleId,
        contentMode: useUiStore.getState().contentMode,
        viewMode: useUiStore.getState().viewMode,
        keyToAction,
      });

      if (Result.isFailure(action)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const resolvedAction = Result.unwrap(action);
      emitDebugInputTrace(`list-key ${event.key} -> ${resolvedAction.type}`);
      switch (resolvedAction.type) {
        case "open-settings":
          executeAction("open-settings");
          break;
        case "open-command-palette":
          executeAction("open-command-palette");
          break;
        case "open-shortcuts-help":
          useUiStore.getState().openShortcutsHelp();
          break;
        case "emit":
          window.dispatchEvent(new Event(resolvedAction.eventName));
          break;
        case "set-view-mode":
          executeAction(`set-filter-${resolvedAction.mode}`);
          break;
        case "close-browser":
          executeAction("close-browser");
          break;
        case "clear-article":
          clearArticle();
          break;
        case "toggle-sidebar":
          toggleSidebar();
          break;
        case "focus-sidebar":
          openSidebar();
          break;
        case "navigate-article":
          executeAction(resolvedAction.direction === 1 ? "next-article" : "prev-article");
          break;
        case "navigate-feed":
          executeAction(resolvedAction.direction === 1 ? "next-feed" : "prev-feed");
          break;
        case "reload-webview":
          executeAction("reload-webview");
          break;
        case "noop":
          break;
      }
    },
    [clearArticle, keyToAction, openSidebar, selectedArticleId, toggleSidebar],
  );

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
