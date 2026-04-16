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
  "h-8 rounded-[min(var(--radius-md),12px)] border border-border/70 px-3 font-sans text-[0.88rem] font-normal shadow-none hover:bg-surface-2";

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
      className="relative border-b border-border/70 px-5 py-5 backdrop-blur-sm sm:px-6"
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
        <div className="min-w-0">
          {backLabel && onBack ? (
            <div className="mb-4">
              <Button
                variant="ghost"
                className={workspaceHeaderActionClassName}
                style={{ backgroundColor: "var(--workspace-header-action-surface)" }}
                onClick={onBack}
              >
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </Button>
            </div>
          ) : null}
          <p className="font-sans text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-sans text-2xl font-normal tracking-[-0.03em] text-foreground">{title}</h1>
          <p className="mt-1 font-serif text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <Button
            variant="ghost"
            size="icon-sm"
            className={`${workspaceHeaderActionClassName} w-8 justify-center px-0`}
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
