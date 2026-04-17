import { ChevronLeft, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
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

const MAC_OVERLAY_DRAG_REGION_WIDTH = 72;
const MAC_OVERLAY_TITLE_OFFSET_CLASS_NAME = "pl-6 sm:pl-6";

export const workspaceHeaderActionClassName =
  "h-7 rounded-md border border-border/60 font-sans text-[0.8rem] font-normal text-foreground-soft shadow-none hover:bg-surface-2 hover:text-foreground";

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
  const useDesktopOverlay = shouldUseDesktopOverlayTitlebar({
    platformKind,
    hasTauriRuntime: hasRuntime,
  });
  const hasBackAction = Boolean(backLabel && onBack);
  const isDesktopApp = hasRuntime;
  const contentKey = `${eyebrow}::${title}::${subtitle}`;
  const previousContentKeyRef = useRef(contentKey);
  const [contentMotionPhase, setContentMotionPhase] = useState<"steady" | "entering">("steady");

  useEffect(() => {
    if (previousContentKeyRef.current === contentKey) {
      return;
    }

    previousContentKeyRef.current = contentKey;
    setContentMotionPhase("entering");

    let resetHandle = 0;
    const frameHandle = requestAnimationFrame(() => {
      resetHandle = requestAnimationFrame(() => {
        setContentMotionPhase("steady");
      });
    });

    return () => {
      cancelAnimationFrame(frameHandle);
      cancelAnimationFrame(resetHandle);
    };
  }, [contentKey]);

  return (
    <div
      className="relative border-b border-border/70 px-5 py-2 backdrop-blur-sm sm:px-6"
      style={{ backgroundColor: "var(--workspace-header-surface)" }}
    >
      {useDesktopOverlay ? (
        <div
          data-testid="workspace-header-drag-region"
          data-tauri-drag-region
          aria-hidden="true"
          className="absolute top-0 left-0 h-10"
          style={{ width: `${MAC_OVERLAY_DRAG_REGION_WIDTH}px` }}
        />
      ) : null}
      <div data-testid="workspace-header-body" className="flex flex-col gap-1.5">
        <div
          data-testid="workspace-header-top-row"
          className="relative flex min-h-5 items-center justify-between gap-4"
        >
          {useDesktopOverlay ? (
            <div
              // Keep one large drag surface across the visible top row and layer
              // interactive controls above it so the empty header area stays draggable.
              data-testid="workspace-header-top-row-drag-region"
              data-tauri-drag-region
              aria-hidden="true"
              className="absolute inset-0 z-10"
            />
          ) : null}
          <div
            data-testid="workspace-header-leading"
            className={cn("relative z-20 flex min-w-0 items-center gap-2", isDesktopApp && "flex-1")}
          >
            {hasBackAction ? (
              isBrowserPreview ? (
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
              ) : null
            ) : null}
            {isBrowserPreview ? (
              <p
                data-motion-phase={contentMotionPhase}
                className="motion-content-swap font-sans text-[11px] font-medium tracking-[0.18em] text-foreground-soft uppercase"
              >
                {eyebrow}
              </p>
            ) : null}
          </div>
          <div data-testid="workspace-header-actions" className="relative z-30 flex shrink-0 items-center gap-2">
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
        <div
          data-testid="workspace-header-title-group"
          className={cn(
            "relative min-w-0 space-y-0.5 pb-0.5",
            useDesktopOverlay && MAC_OVERLAY_TITLE_OFFSET_CLASS_NAME,
          )}
        >
          {useDesktopOverlay ? (
            <div
              // Keep one large drag surface across the title block and lift the
              // back button above it so the whole passive header band can be grabbed.
              data-testid="workspace-header-title-group-drag-region"
              data-tauri-drag-region
              aria-hidden="true"
              className="absolute inset-0 z-10"
            />
          ) : null}
          {isDesktopApp ? (
            <div className={cn("relative z-20", useDesktopOverlay && "pointer-events-none")}>
              <div
                data-testid="workspace-header-context-row"
                className={cn(
                  "flex flex-wrap items-center gap-x-2 gap-y-0.5",
                  useDesktopOverlay && "pointer-events-none",
                )}
              >
                <p
                  data-motion-phase={contentMotionPhase}
                  className="motion-content-swap font-sans text-[11px] font-medium tracking-[0.18em] text-foreground-soft uppercase"
                >
                  {eyebrow}
                </p>
              </div>
            </div>
          ) : null}
          {isDesktopApp ? (
            <div
              data-testid="workspace-header-navigation-row"
              className={cn(
                "relative z-20 flex min-w-0 items-center gap-2.5",
                useDesktopOverlay && "pointer-events-none",
              )}
            >
              {hasBackAction ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn(
                    `${workspaceHeaderActionClassName} w-7 justify-center px-0`,
                    "relative z-30",
                    useDesktopOverlay && "pointer-events-auto",
                  )}
                  style={{ backgroundColor: "var(--workspace-header-action-surface)" }}
                  aria-label={backLabel}
                  onClick={onBack}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              ) : null}
              <div
                data-testid="workspace-header-title-drag-content"
                className={cn("min-w-0 flex-1", useDesktopOverlay && "pointer-events-none")}
              >
                <h1
                  data-motion-phase={contentMotionPhase}
                  className="motion-content-swap font-sans text-[1.65rem] leading-[0.96] font-normal tracking-[-0.04em] text-foreground"
                >
                  {title}
                </h1>
              </div>
            </div>
          ) : (
            <h1
              data-motion-phase={contentMotionPhase}
              className="motion-content-swap font-sans text-[1.65rem] leading-[0.96] font-normal tracking-[-0.04em] text-foreground"
            >
              {title}
            </h1>
          )}
          <div className={cn("relative z-20", useDesktopOverlay && "pointer-events-none")}>
            <p
              data-testid="workspace-header-subtitle-content"
              data-motion-phase={contentMotionPhase}
              className={cn(
                "motion-content-swap max-w-2xl font-serif text-[0.95rem] leading-[1.42] text-foreground-soft",
                useDesktopOverlay && "pointer-events-none",
              )}
            >
              {subtitle}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
