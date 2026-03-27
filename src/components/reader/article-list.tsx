import { ContextMenu } from "@base-ui/react/context-menu";
import { Result } from "@praha/byethrow";
import { CheckCircle, Filter, Search, Star, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccountArticles, useArticles, useMarkAllRead, useSearchArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useArticlesByTag } from "@/hooks/use-tags";
import {
  countUnreadArticles,
  formatArticleTime,
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

  const navigateArticle = useCallback(
    (direction: 1 | -1) => {
      const nextArticleId = getAdjacentArticleId(filteredArticles, selectedArticleId, direction);
      if (Result.isFailure(nextArticleId)) {
        return;
      }

      const articleId = Result.unwrap(nextArticleId);
      selectArticle(articleId);
      // Scroll selected item into view
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
      {/* Header Toolbar */}
      <div className="flex h-12 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Mark all as read"
            onClick={handleMarkAllRead}
            className="text-muted-foreground"
          >
            <CheckCircle className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setShowSearch((v) => !v);
              if (!showSearch) openSearch();
              else setSearchQuery("");
            }}
            aria-label="Search articles"
            className={cn("text-muted-foreground", showSearch && "text-foreground")}
          >
            <Search className="h-4 w-4" />
          </Button>
          {showSearch && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowSearch(false);
                setSearchQuery("");
              }}
              aria-label="Close search"
              className="text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="border-b border-border px-4 py-2">
          <input
            ref={searchInputRef}
            name="article-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search articles..."
            className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      )}

      {/* Feed Title */}
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold text-foreground">{feedName}</h2>
        <p className="text-xs text-muted-foreground">{unreadCount} Unread Items</p>
      </div>

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
                    {/* Group Header (hidden when groupBy is "none") */}
                    {groupBy !== "none" && (
                      <div className="sticky top-0 bg-card px-4 py-2">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {groupLabel}
                        </span>
                      </div>
                    )}

                    {/* Articles in Group */}
                    {groupArticles.map((article) => (
                      <ArticleContextMenu key={article.id} article={article}>
                        <button
                          type="button"
                          data-article-id={article.id}
                          role="option"
                          aria-selected={selectedArticleId === article.id}
                          aria-label={`${article.title}${article.is_read ? "" : " (unread)"}${article.is_starred ? " (starred)" : ""}`}
                          onClick={() => selectArticle(article.id)}
                          className={cn(
                            "relative flex w-full flex-col gap-1 border-l-2 px-4 py-3 text-left transition-colors",
                            selectedArticleId === article.id
                              ? "border-l-accent bg-accent/10"
                              : !article.is_read
                                ? "border-l-accent/60 hover:bg-muted/50"
                                : dimArchived === "true"
                                  ? "border-l-transparent hover:bg-muted/50 opacity-60"
                                  : "border-l-transparent hover:bg-muted/50",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-1">
                              {/* Title */}
                              <h3
                                className={cn(
                                  "line-clamp-2 text-sm leading-snug text-foreground",
                                  !article.is_read && "font-medium",
                                )}
                              >
                                {article.title}
                              </h3>
                              {/* Feed Name */}
                              {feedNameMap.has(article.feed_id) && (
                                <p className="text-xs text-muted-foreground">{feedNameMap.get(article.feed_id)}</p>
                              )}
                              {/* Summary */}
                              {textPreview === "true" && article.summary && (
                                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                  {article.summary}
                                </p>
                              )}
                            </div>

                            {/* Thumbnail */}
                            {imagePreviews !== "off" && article.thumbnail && (
                              <div
                                className={cn(
                                  "relative shrink-0 overflow-hidden rounded",
                                  imagePreviews === "small" && "h-12 w-16",
                                  imagePreviews === "medium" && "h-16 w-20",
                                  imagePreviews === "large" && "h-20 w-28",
                                )}
                              >
                                <img src={article.thumbnail} alt="" className="h-full w-full object-cover" />
                              </div>
                            )}
                          </div>

                          {/* Time */}
                          <div className="absolute right-4 top-3 text-xs text-muted-foreground">
                            {formatArticleTime(article.published_at)}
                          </div>
                        </button>
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

      {/* Bottom Toolbar */}
      <div className="flex h-10 items-center justify-center gap-4 border-t border-border bg-card">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Show starred"
          onClick={() => setViewMode("starred")}
          className={cn("text-muted-foreground", viewMode === "starred" && "text-foreground")}
        >
          <Star className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewMode("unread")}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            viewMode === "unread" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50",
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          UNREAD
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Show all"
          onClick={() => setViewMode("all")}
          className={cn("text-muted-foreground", viewMode === "all" && "text-foreground")}
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
