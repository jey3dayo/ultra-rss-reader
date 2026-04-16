import { createPortal } from "react-dom";
import { BrowserOverlayChrome } from "./browser-overlay-chrome";
import { BrowserOverlayStage } from "./browser-overlay-stage";
import type { BrowserViewProps } from "./browser-view.types";
import { useBrowserViewController } from "./use-browser-view-controller";

export function BrowserView({ scope = "content-pane", onCloseOverlay, labels, toolbarActions }: BrowserViewProps) {
  const controller = useBrowserViewController({ scope, onCloseOverlay });

  if (!controller.browserUrl) return null;

  const overlay = (
    <div
      ref={controller.overlayRef}
      data-testid="browser-overlay-shell"
      className="pointer-events-auto absolute inset-0 z-20 isolate overflow-hidden bg-background/88 backdrop-blur-sm"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/96 to-background/82"
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
            borderRadius: `${controller.geometry.chromeRail.radius}px`,
          }}
          className="pointer-events-none absolute z-[50] border-b border-border/55 bg-gradient-to-b from-background/86 via-background/60 to-background/15 backdrop-blur-md"
        />
      ) : null}
      <div
        aria-hidden="true"
        data-testid="browser-overlay-scrim"
        className="absolute inset-0 z-0 cursor-default bg-transparent"
        onClick={scope === "main-stage" ? undefined : controller.handleCloseOverlay}
      />
      <BrowserOverlayChrome
        controller={controller}
        backToReaderLabel={labels.backToReader}
        toolbarActions={toolbarActions}
      />
      <BrowserOverlayStage controller={controller} />
    </div>
  );

  if (scope === "main-stage" && typeof document !== "undefined") {
    const portalTarget = document.querySelector<HTMLElement>("[data-browser-overlay-root]");
    if (portalTarget) {
      return createPortal(overlay, portalTarget);
    }
  }

  return overlay;
}
