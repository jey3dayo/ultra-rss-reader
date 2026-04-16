import { CheckCheck, PanelLeft, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import type { ArticleListHeaderActionsProps } from "./article-list.types";

export function ArticleListHeaderActions({
  showSearch,
  showSidebarButton,
  sidebarButtonLabel,
  sidebarButtonText,
  isSidebarVisible,
  feedModeControl,
  onMarkAllRead,
  onToggleSidebar,
  onToggleSearch,
  onCloseSearch,
  markAllReadLabel,
  markAllReadButtonText,
  searchArticlesLabel,
  searchArticlesButtonText,
  closeSearchLabel,
}: ArticleListHeaderActionsProps) {
  const isMobile = useUiStore((state) => state.layoutMode === "mobile");

  return (
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
                "text-foreground-soft transition-colors duration-200 hover:text-foreground",
                sidebarButtonText && "gap-2 px-3 text-sm font-medium",
                isSidebarVisible && "bg-surface-1/72 text-foreground",
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
        <AppTooltip label={markAllReadLabel}>
          <Button
            variant="ghost"
            size={isMobile ? "sm" : "icon"}
            aria-label={markAllReadLabel}
            onClick={onMarkAllRead}
            className={cn("text-foreground-soft", isMobile && "h-11 gap-2 px-3.5 text-sm font-medium")}
          >
            <CheckCheck className="h-4 w-4" />
            {isMobile ? <span>{markAllReadButtonText}</span> : null}
          </Button>
        </AppTooltip>
        <AppTooltip label={searchArticlesLabel}>
          <Button
            variant="ghost"
            size={isMobile ? "sm" : "icon"}
            onClick={onToggleSearch}
            aria-label={searchArticlesLabel}
            className={cn(
              "text-foreground-soft",
              isMobile && "h-11 gap-2 px-3.5 text-sm font-medium",
              showSearch && "text-foreground",
            )}
          >
            <Search className="h-4 w-4" />
            {isMobile ? <span>{searchArticlesButtonText}</span> : null}
          </Button>
        </AppTooltip>
        {showSearch && (
          <AppTooltip label={closeSearchLabel}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCloseSearch}
              aria-label={closeSearchLabel}
              className="text-foreground-soft"
            >
              <X className="h-4 w-4" />
            </Button>
          </AppTooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
