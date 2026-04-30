import { CheckCheck, PanelLeft, Search, X } from "lucide-react";
import { IconToolbarButton } from "@/components/shared/icon-toolbar-control";
import { Button } from "@/components/ui/button";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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
  const iconToolbarActiveClassName = "bg-surface-3/88 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]";

  return (
    <TooltipProvider>
      <div className="flex items-center">
        {showSidebarButton &&
          (sidebarButtonText ? (
            <AppTooltip label={sidebarButtonLabel}>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleSidebar}
                aria-label={sidebarButtonLabel}
                aria-pressed={isSidebarVisible}
                className={cn(
                  "gap-2 px-3 text-sm font-medium text-foreground-soft transition-colors duration-200 hover:text-foreground motion-reduce:transition-none",
                  isSidebarVisible && "bg-surface-1/72 text-foreground",
                )}
              >
                <PanelLeft className="h-4 w-4" />
                <span>{sidebarButtonText}</span>
              </Button>
            </AppTooltip>
          ) : (
            <IconToolbarButton
              label={sidebarButtonLabel}
              onClick={onToggleSidebar}
              ariaPressed={isSidebarVisible}
              className={cn(isSidebarVisible && iconToolbarActiveClassName)}
            >
              <PanelLeft className="h-4 w-4" />
            </IconToolbarButton>
          ))}
      </div>
      <div data-tauri-drag-region aria-hidden="true" className="h-full min-w-0 flex-1" />
      <div className="flex items-center gap-2">
        {feedModeControl}
        {feedModeControl && <hr className="mx-0.5 h-5 w-px border-0 bg-border" />}
        <IconToolbarButton label={markAllReadLabel} onClick={onMarkAllRead}>
          <CheckCheck className="h-4 w-4" />
        </IconToolbarButton>
        <IconToolbarButton
          label={searchArticlesLabel}
          onClick={onToggleSearch}
          ariaPressed={showSearch}
          className={cn(showSearch && iconToolbarActiveClassName)}
        >
          <Search className="h-4 w-4" />
        </IconToolbarButton>
        {showSearch && (
          <IconToolbarButton label={closeSearchLabel} onClick={onCloseSearch}>
            <X className="h-4 w-4" />
          </IconToolbarButton>
        )}
      </div>
    </TooltipProvider>
  );
}
