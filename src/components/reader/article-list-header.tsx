import { CheckCheck, Search, X } from "lucide-react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ArticleListHeaderProps = {
  showSearch: boolean;
  searchQuery: string;
  feedName: string;
  unreadCount: number;
  searchInputRef: RefObject<HTMLInputElement | null>;
  displayModeControl?: React.ReactNode;
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
  displayModeControl,
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
        <TooltipProvider>
          <div className="flex items-center gap-2">
            {displayModeControl}
            {displayModeControl && <hr className="mx-0.5 h-5 w-px border-0 bg-border" />}
            <AppTooltip label={t("mark_all_as_read")}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("mark_all_as_read")}
                onClick={onMarkAllRead}
                className="text-muted-foreground"
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
            </AppTooltip>
            <AppTooltip label={t("search_articles")}>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleSearch}
                aria-label={t("search_articles")}
                className={cn("text-muted-foreground", showSearch && "text-foreground")}
              >
                <Search className="h-4 w-4" />
              </Button>
            </AppTooltip>
            {showSearch && (
              <AppTooltip label={t("close_search")}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCloseSearch}
                  aria-label={t("close_search")}
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </AppTooltip>
            )}
          </div>
        </TooltipProvider>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="border-b border-border px-4 py-2">
          <Input
            ref={searchInputRef}
            name="article-search"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={t("search_articles_placeholder")}
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
