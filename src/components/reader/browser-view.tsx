import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { BrowserDiagnosticsRail } from "./browser-diagnostics-rail";
import { BrowserOverlayChrome } from "./browser-overlay-chrome";
import { BrowserOverlayStage } from "./browser-overlay-stage";
import { useBrowserViewController } from "./use-browser-view-controller";

type BrowserViewProps = {
  scope?: "content-pane" | "main-stage";
  onCloseOverlay: () => void;
  labels: {
    closeOverlay: string;
  };
  toolbarActions?: ReactNode;
};

export function BrowserView({ scope = "content-pane", onCloseOverlay, labels, toolbarActions }: BrowserViewProps) {
  const controller = useBrowserViewController({ scope, onCloseOverlay });

  if (!controller.browserUrl) return null;

  const overlay = (
    <div
      ref={controller.overlayRef}
      data-testid="browser-overlay-shell"
      className="pointer-events-auto absolute inset-0 z-20 isolate overflow-hidden bg-black/88 backdrop-blur-sm"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.9)_0%,rgba(0,0,0,0.885)_16%,rgba(0,0,0,0.87)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_15rem_at_10rem_0.5rem,rgba(255,255,255,0.04),transparent_58%)]"
      />
      {controller.showDiagnostics ? (
        <BrowserDiagnosticsRail
          layoutDiagnostics={controller.layoutDiagnostics}
          nativeDiagnostics={controller.nativeDiagnostics}
          compact={controller.geometry.diagnostics.compact}
          top={controller.geometry.diagnostics.top}
        />
      ) : null}
      {controller.geometry.chromeRail.visible ? (
        <div
          aria-hidden="true"
          data-testid="browser-overlay-top-rail"
          style={{
            left: `${controller.geometry.chromeRail.left}px`,
            right: `${controller.geometry.chromeRail.right}px`,
            top: `${controller.geometry.chromeRail.top}px`,
            height: `${controller.geometry.chromeRail.height}px`,
            borderRadius: `${controller.geometry.chromeRail.radius}px`,
          }}
          className="pointer-events-none absolute z-[50] border border-white/7 bg-white/[0.035] shadow-[0_14px_32px_rgba(0,0,0,0.24)] backdrop-blur-md"
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
        closeOverlayLabel={labels.closeOverlay}
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
