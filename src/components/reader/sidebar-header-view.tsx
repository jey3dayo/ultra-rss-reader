import { Plus, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SidebarHeaderViewProps = {
  lastSyncedLabel: string;
  isSyncing: boolean;
  onSync: () => void;
  onAddFeed: () => void;
  syncButtonLabel: string;
  addFeedButtonLabel: string;
  isSyncDisabled?: boolean;
  isAddFeedDisabled?: boolean;
  children?: ReactNode;
};

export function SidebarHeaderView({
  lastSyncedLabel,
  isSyncing,
  onSync,
  onAddFeed,
  syncButtonLabel,
  addFeedButtonLabel,
  isSyncDisabled = false,
  isAddFeedDisabled = false,
  children,
}: SidebarHeaderViewProps) {
  return (
    <>
      <div data-tauri-drag-region className="flex h-12 items-center justify-end px-4 pl-20">
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <div className="px-4 pb-1">
        <p className="text-xs text-muted-foreground">{lastSyncedLabel}</p>
      </div>

      {children}
    </>
  );
}
