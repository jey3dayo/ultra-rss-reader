import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OverlayStageSurface } from "@/components/shared/overlay-stage-surface";
import { BrowserSurfaceStateCard } from "./browser-surface-state-card";
import type { BrowserOverlayStageProps } from "./browser-view.types";

function BrowserOverlayLoadingState({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
      <div data-testid="browser-loading-state" className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="relative flex items-center justify-center">
          <div aria-hidden="true" className="absolute h-12 w-20 rounded-lg bg-browser-overlay-loading-halo blur-2xl" />
          <LoaderCircle aria-hidden="true" className="relative size-12 animate-spin text-foreground" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium tracking-[0.02em] text-foreground">{label}</p>
          <p className="text-sm text-foreground-soft">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function BrowserOverlayIssueState({
  issue,
  showTechnicalDetail,
  onRetry,
  onOpenExternal,
  technicalDetailLabel,
  retryWebPreviewLabel,
  openInExternalBrowserLabel,
}: {
  issue: BrowserOverlayStageProps["controller"]["activeSurfaceIssue"];
  showTechnicalDetail: boolean;
  onRetry: () => void;
  onOpenExternal: () => void;
  technicalDetailLabel: string;
  retryWebPreviewLabel: string;
  openInExternalBrowserLabel: string;
}) {
  if (!issue) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
      <BrowserSurfaceStateCard
        issue={issue}
        showTechnicalDetail={showTechnicalDetail}
        onRetry={onRetry}
        onOpenExternal={onOpenExternal}
        labels={{
          technicalDetail: technicalDetailLabel,
          retryWebPreview: retryWebPreviewLabel,
          openInExternalBrowser: openInExternalBrowserLabel,
        }}
      />
    </div>
  );
}

export function BrowserOverlayStage({ controller }: BrowserOverlayStageProps) {
  const { t } = useTranslation("reader");

  return (
    <OverlayStageSurface
      data-testid="browser-overlay-stage-shell"
      scope={controller.presentation.stageSurface.scope}
      style={{
        left: `${controller.geometry.stage.left}px`,
        top: `${controller.geometry.stage.top}px`,
        right: `${controller.geometry.stage.right}px`,
        bottom: `${controller.geometry.stage.bottom}px`,
        borderRadius: `${controller.geometry.stage.radius}px`,
      }}
    >
      <div ref={controller.stageRef} data-testid="browser-overlay-stage" className="absolute inset-0">
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
          <BrowserOverlayLoadingState label={t("browser_loading")} hint={t("browser_loading_hint")} />
        ) : null}
        <BrowserOverlayIssueState
          issue={controller.activeSurfaceIssue}
          showTechnicalDetail={controller.showDiagnostics}
          onRetry={controller.handleRetry}
          onOpenExternal={controller.handleOpenExternal}
          technicalDetailLabel={t("browser_embed_technical_detail")}
          retryWebPreviewLabel={t("retry_web_preview")}
          openInExternalBrowserLabel={t("open_in_external_browser")}
        />
      </div>
    </OverlayStageSurface>
  );
}
