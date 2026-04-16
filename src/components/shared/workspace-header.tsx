import { ArrowLeft, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

export const workspaceHeaderActionClassName =
  "h-7 rounded-[min(var(--radius-md),12px)] border border-border/60 px-2.5 font-sans text-[0.8rem] font-normal text-foreground-soft shadow-none hover:bg-surface-2 hover:text-foreground";

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
  const useDesktopOverlay =
    shouldUseDesktopOverlayTitlebar({
      platformKind,
      hasTauriRuntime: hasRuntime,
    }) ||
    (hasRuntime && platformKind === "unknown" && looksLikeMacPlatform());

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
          className="absolute inset-y-0 left-0 w-20"
        />
      ) : null}
      <div
        data-testid="workspace-header-body"
        className={cn("flex items-start justify-between gap-4", useDesktopOverlay && "pl-20")}
      >
        <div className="min-w-0 flex-1">
          <div data-testid="workspace-header-context-row" className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {backLabel && onBack ? (
              <Button
                variant="ghost"
                className={workspaceHeaderActionClassName}
                style={{ backgroundColor: "var(--workspace-header-action-surface)" }}
                onClick={onBack}
              >
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </Button>
            ) : null}
            <p className="font-sans text-[11px] font-medium tracking-[0.18em] text-foreground-soft uppercase">
              {eyebrow}
            </p>
          </div>
          <div data-testid="workspace-header-title-group" className="mt-2 space-y-1">
            <h1 className="font-sans text-[1.65rem] leading-none font-normal tracking-[-0.04em] text-foreground">
              {title}
            </h1>
            <p className="max-w-2xl font-serif text-[0.95rem] leading-6 text-foreground-soft">{subtitle}</p>
          </div>
        </div>
        <div data-testid="workspace-header-actions" className="flex shrink-0 items-center gap-2 self-start pt-0.5">
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
    </div>
  );
}
