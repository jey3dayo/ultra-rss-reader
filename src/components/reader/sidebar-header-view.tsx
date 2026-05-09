import { Plus, RefreshCw } from "lucide-react";
import { useEffect, useReducer, useRef } from "react";
import { IconToolbarButton } from "@/components/shared/icon-toolbar-control";
import { cn } from "@/lib/utils";

export type SidebarHeaderProps = {
  onSync: () => void;
  onAddFeed: () => void;
  syncButtonLabel: string;
  syncTooltipLabel?: string;
  syncButtonText: string;
  addFeedButtonLabel: string;
  addFeedButtonText: string;
  displayState: SidebarHeaderDisplayState;
  syncState: SidebarHeaderSyncState;
  actionAvailability?: SidebarHeaderActionAvailability;
};

type SidebarHeaderDisplayState = {
  layout: "desktop" | "mobile";
  titlebar: "standard" | "desktop-overlay";
};

type SidebarHeaderSyncState = {
  status: "idle" | "syncing" | "disabled" | "cooldown";
};

type SidebarHeaderActionAvailability = {
  addFeed: "available" | "disabled";
};

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
  onSync,
  onAddFeed,
  syncButtonLabel,
  syncTooltipLabel,
  syncButtonText: _syncButtonText,
  addFeedButtonLabel,
  addFeedButtonText: _addFeedButtonText,
  displayState,
  syncState,
  actionAvailability,
}: SidebarHeaderProps) {
  const [state, dispatch] = useReducer(sidebarHeaderReducer, initialSidebarHeaderState);
  const { isFeedbackSpinning } = state;
  const isMobile = displayState.layout === "mobile";
  const useDesktopOverlay = displayState.titlebar === "desktop-overlay";
  const isSyncing = syncState.status === "syncing";
  const isSyncDisabled = syncState.status === "disabled";
  const isSyncCoolingDown = syncState.status === "cooldown";
  const isAddFeedDisabled = actionAvailability?.addFeed === "disabled";
  const feedbackSpinTimerRef = useRef<number | null>(null);
  const headerActionButtonClassName = "hover:bg-[var(--sidebar-hover-surface)] hover:text-sidebar-foreground md:px-0";
  const mobileHeaderActionButtonClassName = "size-11";

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
    if (isSyncCoolingDown) {
      return;
    }

    if (!isSyncing && !isSyncDisabled) {
      startFeedbackSpin(ACCEPTED_SYNC_SPIN_MS);
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
      <div className="flex items-center gap-2">
        <IconToolbarButton
          label={syncButtonLabel}
          tooltipLabel={syncTooltipLabel ?? syncButtonLabel}
          onClick={handleSyncClick}
          disabled={isSyncing || isSyncDisabled}
          ariaDisabled={isSyncCoolingDown}
          className={cn(
            headerActionButtonClassName,
            isMobile ? mobileHeaderActionButtonClassName : "w-11",
            isSyncCoolingDown && "opacity-70",
          )}
        >
          <RefreshCw className={cn("size-4", (isSyncing || isFeedbackSpinning) && "animate-spin")} />
        </IconToolbarButton>
        <IconToolbarButton
          label={addFeedButtonLabel}
          onClick={onAddFeed}
          disabled={isAddFeedDisabled}
          className={cn(headerActionButtonClassName, isMobile ? mobileHeaderActionButtonClassName : "w-11")}
        >
          <Plus className="size-4" />
        </IconToolbarButton>
      </div>
    </div>
  );
}
