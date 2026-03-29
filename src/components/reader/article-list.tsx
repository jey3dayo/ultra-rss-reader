import { ContextMenu } from "@base-ui/react/context-menu";
import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAccountArticles, useArticles, useMarkAllRead, useSearchArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { navigateArticleEvent } from "@/hooks/use-keyboard";
import { useArticlesByTag } from "@/hooks/use-tags";
import {
  countUnreadArticles,
  getAdjacentArticleId,
  getUnreadArticleIds,
  groupArticles,
  selectVisibleArticles,
} from "@/lib/article-list";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { ArticleContextMenu } from "./article-context-menu";
import type { ArticleGroupsViewGroup } from "./article-groups-view";
import { ArticleListFooter } from "./article-list-footer";
import { ArticleListHeader } from "./article-list-header";
import { ArticleListScreenView } from "./article-list-screen-view";
import { contextMenuStyles } from "./context-menu-styles";

export function ArticleList() {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const selection = useUiStore((s) => s.selection);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectedArticleId = useUiStore((s) => s.selectedArticleId);
  const selectArticle = useUiStore((s) => s.selectArticle);
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const layoutMode = useUiStore((s) => s.layoutMode);
  const sortUnread = usePreferencesStore((s) => s.prefs.reading_sort ?? s.prefs.sort_unread ?? "newest_first");
  const groupBy = usePreferencesStore((s) => s.prefs.group_by ?? "date");
  const dimArchived = usePreferencesStore((s) => s.prefs.dim_archived ?? "true");
  const textPreview = usePreferencesStore((s) => s.prefs.text_preview ?? "true");
  const imagePreviews = usePreferencesStore((s) => s.prefs.image_previews ?? "medium");
  const selectionStyle = usePreferencesStore((s) => s.prefs.list_selection_style ?? "modern");
  const recentlyReadIds = useUiStore((s) => s.recentlyReadIds);
  const showConfirm = useUiStore((s) => s.showConfirm);
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const tagId = selection.type === "tag" ? selection.tagId : null;
  const { data: articles, isLoading } = useArticles(feedId);
  const { data: accountArticles, isLoading: isLoadingAccountArticles } = useAccountArticles(selectedAccountId);
  const { data: tagArticles, isLoading: isLoadingTagArticles } = useArticlesByTag(tagId);
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
  const { data: searchResults } = useSearchArticles(selectedAccountId, debouncedQuery);

  const feedNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of feeds ?? []) map.set(f.id, f.title);
    return map;
  }, [feeds]);

  const feedName = useMemo(() => {
    if (selection.type === "feed") return t("articles");
    if (selection.type === "smart") return selection.kind === "unread" ? t("unread") : t("starred");
    if (selection.type === "tag") return t("tagged_articles");
    return t("all_articles");
  }, [selection, t]);

  const filteredArticles = useMemo(() => {
    return selectVisibleArticles({
      articles,
      accountArticles,
      tagArticles,
      searchResults,
      feedId,
      tagId,
      viewMode,
      showSearch,
      searchQuery,
      sortUnread,
      recentlyReadIds,
    });
  }, [
    accountArticles,
    articles,
    feedId,
    tagArticles,
    tagId,
    viewMode,
    showSearch,
    searchQuery,
    searchResults,
    sortUnread,
    recentlyReadIds,
  ]);

  const unreadCount = useMemo(() => {
    return countUnreadArticles(filteredArticles);
  }, [filteredArticles]);

  const groupedArticles = useMemo(() => {
    return groupArticles({
      articles: filteredArticles,
      groupBy,
      feedNameMap,
    });
  }, [filteredArticles, groupBy, feedNameMap]);

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
  const scrollToTopOnChange = usePreferencesStore((s) => s.prefs.scroll_to_top_on_change ?? "true");
  const askBeforeMarkAll = usePreferencesStore((s) => s.prefs.ask_before_mark_all ?? "true");
  const markAllRead = useMarkAllRead();
  const addRecentlyRead = useUiStore((s) => s.addRecentlyRead);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to top when selection changes
  useEffect(() => {
    if (scrollToTopOnChange === "true" && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [selection, scrollToTopOnChange]);

  const doMarkAllRead = useCallback(() => {
    const unreadIds = getUnreadArticleIds(filteredArticles);
    for (const id of unreadIds) addRecentlyRead(id);
    markAllRead.mutate(unreadIds);
  }, [filteredArticles, markAllRead, addRecentlyRead]);

  const handleMarkAllRead = useCallback(() => {
    const unreadIds = getUnreadArticleIds(filteredArticles);
    if (unreadIds.length === 0) return;
    if (askBeforeMarkAll === "true") {
      showConfirm(t("confirm_mark_read", { count: unreadIds.length }), doMarkAllRead, tc("mark_as_read_action"));
    } else {
      doMarkAllRead();
    }
  }, [askBeforeMarkAll, filteredArticles, showConfirm, doMarkAllRead, t, tc]);

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

  const navigateArticle = useCallback(
    (direction: 1 | -1) => {
      const nextArticleId = getAdjacentArticleId(filteredArticles, selectedArticleId, direction);
      if (Result.isFailure(nextArticleId)) {
        return;
      }

      const articleId = Result.unwrap(nextArticleId);
      selectArticle(articleId);
      const btn = listRef.current?.querySelector(`[data-article-id="${articleId}"]`);
      btn?.scrollIntoView({ block: "nearest" });
    },
    [filteredArticles, selectedArticleId, selectArticle],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const direction = (e as CustomEvent<1 | -1>).detail;
      navigateArticle(direction);
    };
    window.addEventListener(navigateArticleEvent, handler);
    return () => window.removeEventListener(navigateArticleEvent, handler);
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
        feedName={feedName}
        unreadCount={unreadCount}
        searchInputRef={searchInputRef}
        onMarkAllRead={handleMarkAllRead}
        onToggleSearch={handleToggleSearch}
        onCloseSearch={handleCloseSearch}
        onSearchQueryChange={setSearchQuery}
      />

      {/* Article List */}
      <ContextMenu.Root>
        <ContextMenu.Trigger render={<div />} className="flex-1 overflow-hidden">
          <ArticleListScreenView
            listAriaLabel={t("article_list")}
            listRef={listRef}
            isLoading={isLoading || isLoadingAccountArticles || isLoadingTagArticles}
            loadingMessage={tc("loading")}
            emptyMessage={t("no_articles")}
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

      <ArticleListFooter viewMode={viewMode} onSetViewMode={setViewMode} />
    </div>
  );
}
