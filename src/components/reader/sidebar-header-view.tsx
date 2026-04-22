import { Plus, RefreshCw } from "lucide-react";
import { useEffect, useReducer, useRef } from "react";
import { Button } from "@/components/ui/button";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { hasTauriRuntime, shouldUseDesktopOverlayTitlebar } from "@/lib/window-chrome";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";
import type { SidebarHeaderProps } from "./sidebar.types";

const ACCEPTED_SYNC_SPIN_MS = 1_000;
const COOLDOWN_SYNC_SPIN_MS = 450;

type SidebarHeaderState = {
  isFeedbackSpinning: boolean;
};

type SidebarHeaderAction = { type: "set-feedback-spinning"; value: boolean };

const initialSidebarHeaderState: SidebarHeaderState = {
  isFeedbackSpinning: false,
};

function sidebarHeaderReducer(state: SidebarHeaderState, action: SidebarHeaderAction): SidebarHeaderState {
  switch (action.type) {
    case "set-feedback-spinning":
      return { ...state, isFeedbackSpinning: action.value };
    default:
      return state;
  }
}

export function SidebarHeaderView({
  isSyncing,
  onSync,
  onAddFeed,
  syncButtonLabel,
  syncTooltipLabel,
  syncButtonText: _syncButtonText,
  addFeedButtonLabel,
  addFeedButtonText: _addFeedButtonText,
  isSyncDisabled = false,
  isSyncCoolingDown = false,
  isAddFeedDisabled = false,
}: SidebarHeaderProps) {
  const isMobile = useUiStore((state) => state.layoutMode === "mobile");
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const useDesktopOverlay = shouldUseDesktopOverlayTitlebar({
    platformKind,
    hasTauriRuntime: hasTauriRuntime(),
  });
  const [state, dispatch] = useReducer(sidebarHeaderReducer, initialSidebarHeaderState);
  const { isFeedbackSpinning } = state;
  const feedbackSpinTimerRef = useRef<number | null>(null);
  const headerActionButtonClassName =
    "text-foreground-soft hover:bg-[var(--sidebar-hover-surface)] hover:text-sidebar-foreground md:size-8 md:px-0";
  const mobileHeaderActionButtonClassName =
    "size-11 rounded-md border border-transparent bg-transparent shadow-none focus-visible:border-border/60 focus-visible:bg-surface-2/72 focus-visible:ring-2 focus-visible:ring-ring/45";

  useEffect(() => {
    return () => {
      if (feedbackSpinTimerRef.current) {
        window.clearTimeout(feedbackSpinTimerRef.current);
      }
    };
  }, []);

  const startFeedbackSpin = (durationMs: number) => {
    dispatch({ type: "set-feedback-spinning", value: true });

    if (feedbackSpinTimerRef.current) {
      window.clearTimeout(feedbackSpinTimerRef.current);
    }

    feedbackSpinTimerRef.current = window.setTimeout(() => {
      dispatch({ type: "set-feedback-spinning", value: false });
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
    <div
      className={cn(
        "flex h-12 items-center justify-between border-b border-border/70 bg-[var(--workspace-header-surface)] px-4 backdrop-blur-sm",
        useDesktopOverlay && "pl-20",
      )}
    >
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
                isMobile ? mobileHeaderActionButtonClassName : "w-11",
                isSyncCoolingDown && "opacity-70",
              )}
              aria-label={syncButtonLabel}
            >
              <RefreshCw className={cn("h-4 w-4", (isSyncing || isFeedbackSpinning) && "animate-spin")} />
            </Button>
          </AppTooltip>
          <AppTooltip label={addFeedButtonLabel}>
            <Button
              variant="ghost"
              onClick={onAddFeed}
              disabled={isAddFeedDisabled}
              className={cn(headerActionButtonClassName, isMobile ? mobileHeaderActionButtonClassName : "w-11")}
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
