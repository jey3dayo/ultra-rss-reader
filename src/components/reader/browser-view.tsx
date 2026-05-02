import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MOTION_BROWSER_OVERLAY_CLASS_NAME } from "@/constants/motion";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { BrowserOverlayChrome } from "./browser-overlay-chrome";
import { BrowserOverlayStage } from "./browser-overlay-stage";
import type { BrowserViewProps } from "./browser-view.types";
import { useBrowserViewController } from "./use-browser-view-controller";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function BrowserOverlayShell({
  controller,
  scope,
  labels,
  toolbarActions,
}: {
  controller: ReturnType<typeof useBrowserViewController>;
  scope: BrowserViewProps["scope"];
  labels: BrowserViewProps["labels"];
  toolbarActions?: BrowserViewProps["toolbarActions"];
}) {
  const browserCloseInFlight = useUiStore((s) => s.browserCloseInFlight);
  const [overlayOpen, setOverlayOpen] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (browserCloseInFlight) {
      setOverlayOpen(false);
      return undefined;
    }

    if (prefersReducedMotion()) {
      setOverlayOpen(true);
      return undefined;
    }

    setOverlayOpen(false);
    const frame = window.requestAnimationFrame(() => {
      setOverlayOpen(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [browserCloseInFlight]);

  return (
    <div
      ref={controller.overlayRef}
      data-testid="browser-overlay-shell"
      data-open={overlayOpen ? "true" : "false"}
      className={cn(
        MOTION_BROWSER_OVERLAY_CLASS_NAME,
        "pointer-events-auto absolute inset-0 z-20 isolate overflow-hidden bg-browser-overlay-shell backdrop-blur-sm",
      )}
    >
      <div
        aria-hidden="true"
        data-testid="browser-overlay-veil"
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "var(--browser-overlay-shell-veil)" }}
      />
      {controller.geometry.chromeRail.visible ? (
        <div
          data-tauri-drag-region
          aria-hidden="true"
          data-testid="browser-overlay-top-rail"
          style={{
            left: `${controller.geometry.chromeRail.left}px`,
            right: `${controller.geometry.chromeRail.right}px`,
            top: `${controller.geometry.chromeRail.top}px`,
            height: `${controller.geometry.chromeRail.height}px`,
            backgroundImage: "var(--browser-overlay-rail)",
            borderColor: "var(--color-browser-overlay-rail-border)",
          }}
          className={cn(
            "absolute z-[50] border-b backdrop-blur-md",
            scope === "main-stage" ? "rounded-none" : "rounded-t-lg",
          )}
        />
      ) : null}
      <div
        aria-hidden="true"
        data-testid="browser-overlay-scrim"
        className="absolute inset-0 z-0 cursor-default bg-background/0"
        onClick={scope === "main-stage" ? undefined : controller.handleCloseOverlay}
      />
      <BrowserOverlayChrome
        controller={controller}
        presentation={controller.presentation}
        closeWebPreviewLabel={labels.closeWebPreview}
        toolbarActions={toolbarActions}
      />
      <BrowserOverlayStage controller={controller} />
    </div>
  );
}

export function BrowserView({ scope = "content-pane", onCloseOverlay, labels, toolbarActions }: BrowserViewProps) {
  const controller = useBrowserViewController({ scope, onCloseOverlay });

  if (!controller.browserUrl) return null;

  if (scope === "main-stage" && typeof document !== "undefined") {
    const portalTarget = document.querySelector<HTMLElement>("[data-browser-overlay-root]");
    if (portalTarget) {
      return createPortal(
        <BrowserOverlayShell controller={controller} scope={scope} labels={labels} toolbarActions={toolbarActions} />,
        portalTarget,
      );
    }
  }

  return <BrowserOverlayShell controller={controller} scope={scope} labels={labels} toolbarActions={toolbarActions} />;
}
