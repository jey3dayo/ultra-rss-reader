import { CircleAlert, ExternalLink, LoaderCircle, RotateCcw, X } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { IconToolbarButton } from "@/components/shared/icon-toolbar-control";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  type BrowserDebugGeometryLayoutDiagnostics,
  type BrowserDebugGeometryNativeDiagnostics,
  getBrowserGeometryStripItems,
} from "@/lib/browser-debug-geometry";
import { useBrowserViewController } from "./use-browser-view-controller";

type BrowserWebviewDiagnosticsPayload = BrowserDebugGeometryNativeDiagnostics;

type BrowserViewLayoutDiagnostics = BrowserDebugGeometryLayoutDiagnostics;

type BrowserSurfaceIssue = {
  kind: "failed" | "unsupported";
  title: string;
  description: string;
  detail?: string | null;
  canRetry?: boolean;
};

function BrowserSurfaceStateCard({
  issue,
  showTechnicalDetail,
  onRetry,
  onOpenExternal,
  labels,
}: {
  issue: BrowserSurfaceIssue;
  showTechnicalDetail: boolean;
  onRetry: () => void;
  onOpenExternal: () => void;
  labels: {
    technicalDetail: string;
    retryWebPreview: string;
    openInExternalBrowser: string;
  };
}) {
  return (
    <div
      data-testid="browser-surface-state"
      className="max-w-md rounded-2xl border border-white/10 bg-black/62 px-5 py-4 text-center shadow-[0_18px_40px_rgba(0,0,0,0.32)] backdrop-blur-md"
    >
      <div className="flex items-center justify-center gap-2 text-white">
        <CircleAlert aria-hidden="true" className="size-4 text-orange-300" />
        <p className="text-sm font-semibold">{issue.title}</p>
      </div>
      <p className="mt-2 text-sm text-white/72">{issue.description}</p>
      {showTechnicalDetail && issue.detail ? (
        <div className="mt-3 space-y-1.5 text-left">
          <p className="text-[11px] font-medium tracking-[0.08em] text-white/45 uppercase">{labels.technicalDetail}</p>
          <p className="rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-xs text-white/68">{issue.detail}</p>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {issue.canRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" />
            {labels.retryWebPreview}
          </Button>
        ) : null}
        <Button type="button" variant="secondary" size="sm" onClick={onOpenExternal}>
          <ExternalLink className="h-3.5 w-3.5" />
          {labels.openInExternalBrowser}
        </Button>
      </div>
    </div>
  );
}

type BrowserViewProps = {
  scope?: "content-pane" | "main-stage";
  onCloseOverlay: () => void;
  labels: {
    closeOverlay: string;
  };
  toolbarActions?: ReactNode;
};

function BrowserDiagnosticsRail({
  layoutDiagnostics,
  nativeDiagnostics,
  compact,
  top,
}: {
  layoutDiagnostics: BrowserViewLayoutDiagnostics | null;
  nativeDiagnostics: BrowserWebviewDiagnosticsPayload | null;
  compact: boolean;
  top: number;
}) {
  const items = getBrowserGeometryStripItems({ layoutDiagnostics, nativeDiagnostics }, compact);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="browser-overlay-diagnostics"
      style={{ top: `${top}px` }}
      className={
        compact
          ? "pointer-events-none absolute left-1/2 z-[90] w-[calc(100vw-7.5rem)] max-w-[calc(100vw-7.5rem)] -translate-x-1/2"
          : "pointer-events-none absolute left-1/2 z-[90] w-[min(780px,calc(100vw-11rem))] -translate-x-1/2"
      }
    >
      <div
        className={
          compact
            ? "mx-auto flex min-w-0 max-w-full items-center justify-start gap-2 overflow-x-auto rounded-2xl border border-white/12 bg-black/68 px-3 py-1.5 whitespace-nowrap font-mono text-[10px] leading-4 text-white/96 shadow-[0_16px_36px_rgba(0,0,0,0.46)] backdrop-blur-xl [text-shadow:0_1px_8px_rgba(0,0,0,0.72)]"
            : "mx-auto flex min-w-0 max-w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-white/12 bg-black/62 px-4 py-2 whitespace-nowrap font-mono text-[10px] leading-4 text-white/96 shadow-[0_16px_36px_rgba(0,0,0,0.46)] backdrop-blur-xl [text-shadow:0_1px_8px_rgba(0,0,0,0.72)]"
        }
      >
        {items.map((item, index) => (
          <span key={item} className="contents">
            <span className="shrink-0">{item}</span>
            {index < items.length - 1 ? <span className="shrink-0 text-white/44">•</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BrowserView({ scope = "content-pane", onCloseOverlay, labels, toolbarActions }: BrowserViewProps) {
  const { t } = useTranslation("reader");
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
      <TooltipProvider>
        <div
          data-testid="browser-overlay-chrome"
          style={{
            left: `${controller.geometry.chrome.close.left}px`,
            top: `${controller.geometry.chrome.close.top}px`,
          }}
          className="pointer-events-none absolute z-[60]"
        >
          <IconToolbarButton
            label={labels.closeOverlay}
            onClick={controller.handleCloseOverlay}
            className={controller.closeButtonClass}
          >
            <X aria-hidden="true" className="size-4" />
          </IconToolbarButton>
        </div>
        <div
          data-testid="browser-overlay-actions"
          style={{
            right: `${controller.geometry.chrome.action.right}px`,
            top: `${controller.geometry.chrome.action.top}px`,
          }}
          className="pointer-events-none absolute z-[60]"
        >
          <div className="pointer-events-auto flex items-center gap-2">
            {toolbarActions ?? (
              <IconToolbarButton
                label={t("open_in_external_browser")}
                onClick={() => {
                  void controller.handleOpenExternal();
                }}
                className={controller.actionButtonClass}
              >
                <ExternalLink className="h-4 w-4" />
              </IconToolbarButton>
            )}
          </div>
        </div>
      </TooltipProvider>
      <div
        ref={controller.stageRef}
        data-testid="browser-overlay-stage"
        className={controller.stageClass}
        style={{
          left: `${controller.geometry.stage.left}px`,
          top: `${controller.geometry.stage.top}px`,
          right: `${controller.geometry.stage.right}px`,
          bottom: `${controller.geometry.stage.bottom}px`,
          borderRadius: `${controller.geometry.stage.radius}px`,
        }}
      >
        <div
          ref={controller.hostRef}
          data-testid="browser-webview-host"
          className="absolute bg-background"
          style={{
            left: `${controller.geometry.host.left}px`,
            top: `${controller.geometry.host.top}px`,
            right: `${controller.geometry.host.right}px`,
            bottom: `${controller.geometry.host.bottom}px`,
          }}
        />
        {controller.isLoading ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
            <div data-testid="browser-loading-state" className="flex max-w-sm flex-col items-center gap-4 text-center">
              <div className="relative flex items-center justify-center">
                <div aria-hidden="true" className="absolute size-24 rounded-full bg-white/10 blur-3xl" />
                <LoaderCircle aria-hidden="true" className="relative size-12 animate-spin text-white/92" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium tracking-[0.02em] text-white/92">{t("browser_loading")}</p>
                <p className="text-sm text-white/60">{t("browser_loading_hint")}</p>
              </div>
            </div>
          </div>
        ) : null}
        {controller.activeSurfaceIssue ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
            <BrowserSurfaceStateCard
              issue={controller.activeSurfaceIssue}
              showTechnicalDetail={controller.showDiagnostics}
              onRetry={controller.handleRetry}
              onOpenExternal={controller.handleOpenExternal}
              labels={{
                technicalDetail: t("browser_embed_technical_detail"),
                retryWebPreview: t("retry_web_preview"),
                openInExternalBrowser: t("open_in_external_browser"),
              }}
            />
          </div>
        ) : null}
      </div>
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
