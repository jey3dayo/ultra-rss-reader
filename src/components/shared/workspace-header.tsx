import { ChevronLeft, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { hasTauriRuntime, shouldUseDesktopOverlayTitlebar } from "@/lib/window-chrome";
import { usePlatformStore } from "@/stores/platform-store";

type WorkspaceHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  backLabel?: string;
  onBack?: () => void;
  closeLabel: string;
  onClose: () => void;
  actions?: ReactNode;
};

const MAC_OVERLAY_DRAG_REGION_WIDTH = 72;
const MAC_OVERLAY_CONTENT_START = 52;

export const workspaceHeaderActionClassName =
  "h-7 rounded-[min(var(--radius-md),12px)] border border-border/60 font-sans text-[0.8rem] font-normal text-foreground-soft shadow-none hover:bg-surface-2 hover:text-foreground";

function looksLikeMacPlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgentDataPlatform =
    "userAgentData" in navigator
      ? (() => {
          const userAgentData = (
            navigator as Navigator & {
              userAgentData?: {
                platform?: string;
              };
            }
          ).userAgentData;

          return typeof userAgentData?.platform === "string" ? userAgentData.platform : null;
        })()
      : null;
  const platform = userAgentDataPlatform ?? navigator.platform ?? "";

  return /mac/i.test(platform);
}

export function WorkspaceHeader({
  eyebrow,
  title,
  subtitle,
  backLabel,
  onBack,
  closeLabel,
  onClose,
  actions = null,
}: WorkspaceHeaderProps) {
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const hasRuntime = hasTauriRuntime();
  const isBrowserPreview = !hasRuntime;
  const useDesktopOverlay =
    shouldUseDesktopOverlayTitlebar({
      platformKind,
      hasTauriRuntime: hasRuntime,
    }) ||
    (hasRuntime && platformKind === "unknown" && looksLikeMacPlatform());
  const hasBackAction = Boolean(backLabel && onBack);

  return (
    <div
      className="relative border-b border-border/70 px-5 py-4 backdrop-blur-sm sm:px-6"
      style={{ backgroundColor: "var(--workspace-header-surface)" }}
    >
      {useDesktopOverlay ? (
        <div
          data-testid="workspace-header-drag-region"
          data-tauri-drag-region
          aria-hidden="true"
          className="absolute inset-y-0 left-0"
          style={{ width: `${MAC_OVERLAY_DRAG_REGION_WIDTH}px` }}
        />
      ) : null}
      <div
        data-testid="workspace-header-body"
        className="flex flex-col gap-4"
        style={useDesktopOverlay ? { paddingLeft: `${MAC_OVERLAY_CONTENT_START}px` } : undefined}
      >
        <div data-testid="workspace-header-top-row" className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            {hasBackAction ? (
              <Button
                variant="ghost"
                size="icon-sm"
                className={`${workspaceHeaderActionClassName} w-7 justify-center px-0`}
                style={{ backgroundColor: "var(--workspace-header-action-surface)" }}
                aria-label={backLabel}
                onClick={onBack}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : null}
            {isBrowserPreview ? (
              <p className="font-sans text-[11px] font-medium tracking-[0.18em] text-foreground-soft uppercase">
                {eyebrow}
              </p>
            ) : null}
          </div>
          <div data-testid="workspace-header-actions" className="flex shrink-0 items-center gap-2">
            {actions}
            <Button
              variant="ghost"
              size="icon-sm"
              className={`${workspaceHeaderActionClassName} w-7 justify-center px-0`}
              style={{ backgroundColor: "var(--workspace-header-action-surface)" }}
              aria-label={closeLabel}
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div data-testid="workspace-header-title-group" className="min-w-0 space-y-2 pb-1">
          {!isBrowserPreview ? (
            <div data-testid="workspace-header-context-row" className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <p className="font-sans text-[11px] font-medium tracking-[0.18em] text-foreground-soft uppercase">
                {eyebrow}
              </p>
            </div>
          ) : null}
          <h1 className="font-sans text-[1.65rem] leading-none font-normal tracking-[-0.04em] text-foreground">
            {title}
          </h1>
          <p className="max-w-2xl font-serif text-[0.95rem] leading-6 text-foreground-soft">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
