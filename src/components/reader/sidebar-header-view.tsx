import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type SidebarHeaderViewProps = {
  isSyncing: boolean;
  onSync: () => void;
  onAddFeed: () => void;
  syncButtonLabel: string;
  addFeedButtonLabel: string;
  isSyncDisabled?: boolean;
  isAddFeedDisabled?: boolean;
};

export function SidebarHeaderView({
  isSyncing,
  onSync,
  onAddFeed,
  syncButtonLabel,
  addFeedButtonLabel,
  isSyncDisabled = false,
  isAddFeedDisabled = false,
}: SidebarHeaderViewProps) {
  return (
    <div className="flex h-12 items-center justify-between px-4 pl-20">
      <div data-tauri-drag-region aria-hidden="true" className="h-full min-w-0 flex-1" />
      <TooltipProvider>
        <div className="flex items-center gap-2">
          <AppTooltip label={syncButtonLabel}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onSync}
              disabled={isSyncing || isSyncDisabled}
              className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label={syncButtonLabel}
            >
              <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
            </Button>
          </AppTooltip>
          <AppTooltip label={addFeedButtonLabel}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onAddFeed}
              disabled={isAddFeedDisabled}
              className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label={addFeedButtonLabel}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </AppTooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
