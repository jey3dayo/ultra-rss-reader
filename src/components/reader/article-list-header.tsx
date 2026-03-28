import { CheckCheck, Search, X } from "lucide-react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ArticleListHeaderProps = {
  showSearch: boolean;
  searchQuery: string;
  feedName: string;
  unreadCount: number;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onMarkAllRead: () => void;
  onToggleSearch: () => void;
  onCloseSearch: () => void;
  onSearchQueryChange: (query: string) => void;
};

export function ArticleListHeader({
  showSearch,
  searchQuery,
  feedName,
  unreadCount,
  searchInputRef,
  onMarkAllRead,
  onToggleSearch,
  onCloseSearch,
  onSearchQueryChange,
}: ArticleListHeaderProps) {
  const { t } = useTranslation("reader");
  return (
    <>
      {/* Header Toolbar - draggable for window move */}
      <div data-tauri-drag-region className="flex h-12 items-center justify-end border-b border-border px-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("mark_all_as_read")}
            onClick={onMarkAllRead}
            className="text-muted-foreground"
          >
            <CheckCheck className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSearch}
            aria-label={t("search_articles")}
            className={cn("text-muted-foreground", showSearch && "text-foreground")}
          >
            <Search className="h-4 w-4" />
          </Button>
          {showSearch && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCloseSearch}
              aria-label={t("close_search")}
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
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={t("search_articles_placeholder")}
            className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      )}

      {/* Feed Title */}
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold text-foreground">{feedName}</h2>
        <p className="text-xs text-muted-foreground">{t("unread_items", { count: unreadCount })}</p>
      </div>
    </>
  );
}
