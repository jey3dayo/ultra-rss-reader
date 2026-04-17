import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import type { SidebarHeaderProps } from "./sidebar.types";

export function SidebarHeaderView({
  isSyncing,
  onSync,
  onAddFeed,
  syncButtonLabel,
  syncButtonText,
  addFeedButtonLabel,
  addFeedButtonText,
  isSyncDisabled = false,
  isAddFeedDisabled = false,
}: SidebarHeaderProps) {
  const isMobile = useUiStore((state) => state.layoutMode === "mobile");

  return (
    <div className="flex h-12 items-center justify-between border-b border-border/70 px-4 pl-20">
      <div data-tauri-drag-region aria-hidden="true" className="h-full min-w-0 flex-1" />
      <TooltipProvider>
        <div className="flex items-center gap-2">
          <AppTooltip label={syncButtonLabel}>
            <Button
              variant="ghost"
              onClick={onSync}
              disabled={isSyncing || isSyncDisabled}
              className={cn(
                "h-11 gap-1.5 px-3 text-foreground-soft hover:bg-[var(--sidebar-hover-surface)] hover:text-sidebar-foreground md:size-7 md:px-0",
                !isMobile && "w-11",
              )}
              aria-label={syncButtonLabel}
            >
              <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
              {isMobile ? <span className="text-sm font-medium">{syncButtonText}</span> : null}
            </Button>
          </AppTooltip>
          <AppTooltip label={addFeedButtonLabel}>
            <Button
              variant="ghost"
              onClick={onAddFeed}
              disabled={isAddFeedDisabled}
              className={cn(
                "h-11 gap-1.5 px-3 text-foreground-soft hover:bg-[var(--sidebar-hover-surface)] hover:text-sidebar-foreground md:size-7 md:px-0",
                !isMobile && "w-11",
              )}
              aria-label={addFeedButtonLabel}
            >
              <Plus className="h-4 w-4" />
              {isMobile ? <span className="text-sm font-medium">{addFeedButtonText}</span> : null}
            </Button>
          </AppTooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
