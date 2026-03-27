import { CheckCircle, Filter, Search, Star, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useArticles, useSearchArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const articleDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (articleDate.getTime() >= today.getTime()) return "TODAY";
  if (articleDate.getTime() >= yesterday.getTime()) return "YESTERDAY";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function ArticleList() {
  const { selection, selectedAccountId, selectedArticleId, selectArticle, viewMode, setViewMode } = useUiStore();
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const { data: articles, isLoading } = useArticles(feedId);
  const { data: feeds } = useFeeds(selectedAccountId);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { data: searchResults } = useSearchArticles(selectedAccountId, searchQuery);

  const feedNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of feeds ?? []) map.set(f.id, f.title);
    return map;
  }, [feeds]);

  const feedName = useMemo(() => {
    if (selection.type === "feed") return "Articles";
    if (selection.type === "smart") return selection.kind === "unread" ? "Unread" : "Starred";
    return "All Articles";
  }, [selection]);

  const filteredArticles = useMemo(() => {
    if (showSearch && searchQuery.length > 0) return searchResults ?? [];
    const list = articles ?? [];
    if (viewMode === "unread") return list.filter((a) => !a.is_read);
    if (viewMode === "starred") return list.filter((a) => a.is_starred);
    return list;
  }, [articles, viewMode, showSearch, searchQuery, searchResults]);

  const unreadCount = useMemo(() => {
    return (articles ?? []).filter((a) => !a.is_read).length;
  }, [articles]);

  const groupedArticles = useMemo(() => {
    const groups: Record<string, ArticleDto[]> = {};
    for (const article of filteredArticles) {
      const group = getDateGroup(article.published_at);
      if (!groups[group]) groups[group] = [];
      groups[group].push(article);
    }
    return groups;
  }, [filteredArticles]);

  return (
    <div className="flex h-full w-[380px] flex-col border-r border-border bg-card">
      {/* Header Toolbar */}
      <div className="flex h-12 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
          >
            <CheckCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowSearch((v) => !v);
              if (!showSearch) requestAnimationFrame(() => searchInputRef.current?.focus());
              else setSearchQuery("");
            }}
            className={cn(
              "rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground",
              showSearch && "text-foreground",
            )}
          >
            <Search className="h-4 w-4" />
          </button>
          {showSearch && (
            <button
              type="button"
              onClick={() => {
                setShowSearch(false);
                setSearchQuery("");
              }}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="border-b border-border px-4 py-2">
          <input
            ref={searchInputRef}
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
      <ScrollArea className="flex-1">
        <div className="pb-4">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">Loading...</div>
          ) : filteredArticles.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">No articles</div>
          ) : (
            Object.entries(groupedArticles).map(([dateGroup, groupArticles]) => (
              <div key={dateGroup}>
                {/* Date Group Header */}
                <div className="sticky top-0 bg-card px-4 py-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {dateGroup}
                  </span>
                </div>

                {/* Articles in Group */}
                {groupArticles.map((article) => (
                  <button
                    type="button"
                    key={article.id}
                    onClick={() => selectArticle(article.id)}
                    className={cn(
                      "relative flex w-full flex-col gap-1 border-l-2 px-4 py-3 text-left transition-colors",
                      selectedArticleId === article.id
                        ? "border-l-accent bg-accent/10"
                        : !article.is_read
                          ? "border-l-accent/60 hover:bg-muted/50"
                          : "border-l-transparent hover:bg-muted/50 opacity-60",
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
                        {article.summary && (
                          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {article.summary}
                          </p>
                        )}
                      </div>

                      {/* Thumbnail */}
                      {article.thumbnail && (
                        <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded">
                          <img src={article.thumbnail} alt="" className="h-full w-full object-cover" />
                        </div>
                      )}
                    </div>

                    {/* Time */}
                    <div className="absolute right-4 top-3 text-xs text-muted-foreground">
                      {formatTime(article.published_at)}
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Bottom Toolbar */}
      <div className="flex h-10 items-center justify-center gap-4 border-t border-border bg-card">
        <button
          type="button"
          onClick={() => setViewMode("starred")}
          className={cn(
            "rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground",
            viewMode === "starred" && "text-foreground",
          )}
        >
          <Star className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setViewMode("unread")}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            viewMode === "unread" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50",
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          UNREAD
        </button>
        <button
          type="button"
          onClick={() => setViewMode("all")}
          className={cn(
            "rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground",
            viewMode === "all" && "text-foreground",
          )}
        >
          <Filter className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
