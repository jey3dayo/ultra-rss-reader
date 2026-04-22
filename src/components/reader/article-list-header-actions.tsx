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
  markAllReadButtonText: _markAllReadButtonText,
  searchArticlesLabel,
  searchArticlesButtonText: _searchArticlesButtonText,
  closeSearchLabel,
}: ArticleListHeaderActionsProps) {
  const isMobile = useUiStore((state) => state.layoutMode === "mobile");
  const mobileToolbarButtonClassName =
    "size-11 rounded-md border border-transparent bg-transparent text-foreground-soft shadow-none hover:bg-surface-2/72 hover:text-foreground focus-visible:border-border/60 focus-visible:bg-surface-2/72 focus-visible:ring-2 focus-visible:ring-ring/45";
  const mobileToolbarButtonActiveClassName =
    "border-border/60 bg-surface-2/84 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";

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
                !sidebarButtonText && isMobile && mobileToolbarButtonClassName,
                isSidebarVisible && "bg-surface-1/72 text-foreground",
                !sidebarButtonText && isMobile && isSidebarVisible && mobileToolbarButtonActiveClassName,
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
            className={cn("text-foreground-soft", isMobile && mobileToolbarButtonClassName)}
          >
            <CheckCheck className="h-4 w-4" />
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
              isMobile && mobileToolbarButtonClassName,
              showSearch && "text-foreground",
              isMobile && showSearch && mobileToolbarButtonActiveClassName,
            )}
          >
            <Search className="h-4 w-4" />
          </Button>
        </AppTooltip>
        {showSearch && (
          <AppTooltip label={closeSearchLabel}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCloseSearch}
              aria-label={closeSearchLabel}
              className={cn("text-foreground-soft", isMobile && mobileToolbarButtonClassName)}
            >
              <X className="h-4 w-4" />
            </Button>
          </AppTooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
