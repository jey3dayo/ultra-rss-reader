import { Plus, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import type { SidebarHeaderProps } from "./sidebar.types";

const ACCEPTED_SYNC_SPIN_MS = 1_000;
const COOLDOWN_SYNC_SPIN_MS = 450;

export function SidebarHeaderView({
  isSyncing,
  onSync,
  onAddFeed,
  syncButtonLabel,
  syncTooltipLabel,
  syncButtonText,
  addFeedButtonLabel,
  addFeedButtonText,
  isSyncDisabled = false,
  isSyncCoolingDown = false,
  isAddFeedDisabled = false,
}: SidebarHeaderProps) {
  const isMobile = useUiStore((state) => state.layoutMode === "mobile");
  const [isFeedbackSpinning, setIsFeedbackSpinning] = useState(false);
  const feedbackSpinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerActionButtonClassName =
    "h-11 gap-1.5 px-3 text-foreground-soft hover:bg-[var(--sidebar-hover-surface)] hover:text-sidebar-foreground md:size-7 md:px-0";

  useEffect(() => {
    return () => {
      if (feedbackSpinTimerRef.current) {
        window.clearTimeout(feedbackSpinTimerRef.current);
      }
    };
  }, []);

  const startFeedbackSpin = (durationMs: number) => {
    setIsFeedbackSpinning(true);

    if (feedbackSpinTimerRef.current) {
      window.clearTimeout(feedbackSpinTimerRef.current);
    }

    feedbackSpinTimerRef.current = window.setTimeout(() => {
      setIsFeedbackSpinning(false);
      feedbackSpinTimerRef.current = null;
    }, durationMs);
  };

  const handleSyncClick = () => {
    if (!isSyncing && !isSyncDisabled) {
      startFeedbackSpin(isSyncCoolingDown ? COOLDOWN_SYNC_SPIN_MS : ACCEPTED_SYNC_SPIN_MS);
    }

    onSync();
  };

  return (
    <div className="flex h-12 items-center justify-between border-b border-border/70 px-4 pl-20">
      <div data-tauri-drag-region aria-hidden="true" className="h-full min-w-0 flex-1" />
      <TooltipProvider>
        <div className="flex items-center gap-2">
          <AppTooltip label={syncTooltipLabel ?? syncButtonLabel}>
            <Button
              variant="ghost"
              onClick={handleSyncClick}
              disabled={isSyncing || isSyncDisabled}
              aria-disabled={isSyncCoolingDown || undefined}
              className={cn(
                headerActionButtonClassName,
                isSyncCoolingDown && "opacity-70",
                !isMobile && "w-11",
              )}
              aria-label={syncButtonLabel}
            >
              <RefreshCw className={cn("h-4 w-4", (isSyncing || isFeedbackSpinning) && "animate-spin")} />
              {isMobile ? <span className="text-sm font-medium">{syncButtonText}</span> : null}
            </Button>
          </AppTooltip>
          <AppTooltip label={addFeedButtonLabel}>
            <Button
              variant="ghost"
              onClick={onAddFeed}
              disabled={isAddFeedDisabled}
              className={cn(
                headerActionButtonClassName,
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
