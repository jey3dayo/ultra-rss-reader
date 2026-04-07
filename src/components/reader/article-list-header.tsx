import { CheckCheck, PanelLeft, Search, X } from "lucide-react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ArticleListHeaderProps = {
  showSearch: boolean;
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  showSidebarButton: boolean;
  sidebarButtonLabel: string;
  sidebarButtonText?: string;
  isSidebarVisible?: boolean;
  feedModeControl?: React.ReactNode;
  onMarkAllRead: () => void;
  onToggleSidebar: () => void;
  onToggleSearch: () => void;
  onCloseSearch: () => void;
  onSearchQueryChange: (query: string) => void;
};

export function ArticleListHeader({
  showSearch,
  searchQuery,
  searchInputRef,
  showSidebarButton,
  sidebarButtonLabel,
  sidebarButtonText,
  isSidebarVisible,
  feedModeControl,
  onMarkAllRead,
  onToggleSidebar,
  onToggleSearch,
  onCloseSearch,
  onSearchQueryChange,
}: ArticleListHeaderProps) {
  const { t } = useTranslation("reader");
  return (
    <>
      <div className="flex h-12 items-center border-b border-border px-3">
        <TooltipProvider>
          <div className="flex items-center">
            {showSidebarButton && (
              <AppTooltip label={sidebarButtonLabel}>
                <Button
                  variant="ghost"
                  size={sidebarButtonText ? "sm" : "icon"}
                  onClick={onToggleSidebar}
                  aria-label={sidebarButtonLabel}
                  aria-pressed={isSidebarVisible}
                  className={cn(
                    "text-muted-foreground transition-colors duration-200 hover:text-foreground",
                    sidebarButtonText && "gap-1.5 px-2.5 text-xs font-semibold tracking-wide",
                    isSidebarVisible && "bg-muted text-foreground",
                  )}
                >
                  <PanelLeft className="h-4 w-4" />
                  {sidebarButtonText && <span>{sidebarButtonText}</span>}
                </Button>
              </AppTooltip>
            )}
          </div>
          <div data-tauri-drag-region aria-hidden="true" className="h-full min-w-0 flex-1" />
          <div className="flex items-center gap-2">
            {feedModeControl}
            {feedModeControl && <hr className="mx-0.5 h-5 w-px border-0 bg-border" />}
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
            aria-label={t("search_articles")}
            placeholder={t("search_articles_placeholder")}
          />
        </div>
      )}
    </>
  );
}
