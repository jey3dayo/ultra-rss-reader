import { ContextMenu } from "@base-ui/react/context-menu";
import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccountArticles, useArticles, useMarkAllRead, useSearchArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useArticlesByTag } from "@/hooks/use-tags";
import {
  countUnreadArticles,
  getAdjacentArticleId,
  getUnreadArticleIds,
  groupArticles,
  selectVisibleArticles,
} from "@/lib/article-list";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { ArticleContextMenu } from "./article-context-menu";
import { ArticleListFooter } from "./article-list-footer";
import { ArticleListHeader } from "./article-list-header";
import { ArticleListItem } from "./article-list-item";
import { contextMenuStyles } from "./context-menu-styles";

export function ArticleList() {
  const selection = useUiStore((s) => s.selection);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectedArticleId = useUiStore((s) => s.selectedArticleId);
  const selectArticle = useUiStore((s) => s.selectArticle);
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const sortUnread = usePreferencesStore((s) => s.prefs.sort_unread ?? "newest_first");
  const groupBy = usePreferencesStore((s) => s.prefs.group_by ?? "date");
  const dimArchived = usePreferencesStore((s) => s.prefs.dim_archived ?? "true");
  const textPreview = usePreferencesStore((s) => s.prefs.text_preview ?? "true");
  const imagePreviews = usePreferencesStore((s) => s.prefs.image_previews ?? "medium");
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
    if (selection.type === "feed") return "Articles";
    if (selection.type === "smart") return selection.kind === "unread" ? "Unread" : "Starred";
    if (selection.type === "tag") return "Tagged Articles";
    return "All Articles";
  }, [selection]);

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

  const listRef = useRef<HTMLDivElement>(null);
  const scrollToTopOnChange = usePreferencesStore((s) => s.prefs.scroll_to_top_on_change ?? "true");
  const askBeforeMarkAll = usePreferencesStore((s) => s.prefs.ask_before_mark_all ?? "true");
  const markAllRead = useMarkAllRead();

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to top when selection changes
  useEffect(() => {
    if (scrollToTopOnChange === "true" && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [selection, scrollToTopOnChange]);

  const handleMarkAllRead = useCallback(async () => {
    const unreadIds = getUnreadArticleIds(filteredArticles);
    if (unreadIds.length === 0) return;
    if (askBeforeMarkAll === "true") {
      if (!window.confirm(`Mark ${unreadIds.length} articles as read?`)) return;
    }
    markAllRead.mutate(unreadIds);
  }, [askBeforeMarkAll, filteredArticles, markAllRead]);

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
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "j") {
        e.preventDefault();
        navigateArticle(1);
      } else if (e.key === "k") {
        e.preventDefault();
        navigateArticle(-1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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
    <div className="flex h-full w-[380px] flex-col border-r border-border bg-card">
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
          <ScrollArea className="h-full">
            <div ref={listRef} role="listbox" aria-label="Article list" className="pb-4">
              {isLoading || isLoadingAccountArticles || isLoadingTagArticles ? (
                <div className="p-6 text-center text-muted-foreground">Loading...</div>
              ) : filteredArticles.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">No articles</div>
              ) : (
                Object.entries(groupedArticles).map(([groupLabel, groupArticles]) => (
                  <div key={groupLabel}>
                    {groupBy !== "none" && (
                      <div className="sticky top-0 bg-card px-4 py-2">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {groupLabel}
                        </span>
                      </div>
                    )}

                    {groupArticles.map((article) => (
                      <ArticleContextMenu key={article.id} article={article}>
                        <ArticleListItem
                          article={article}
                          isSelected={selectedArticleId === article.id}
                          dimArchived={dimArchived}
                          textPreview={textPreview}
                          imagePreviews={imagePreviews}
                          feedName={feedNameMap.get(article.feed_id)}
                          onSelect={() => selectArticle(article.id)}
                        />
                      </ArticleContextMenu>
                    ))}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup className={contextMenuStyles.popup}>
              <ContextMenu.Item className={contextMenuStyles.item} onClick={handleMarkAllRead}>
                Mark All as Read
              </ContextMenu.Item>
            </ContextMenu.Popup>
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      <ArticleListFooter viewMode={viewMode} onSetViewMode={setViewMode} />
    </div>
  );
}
