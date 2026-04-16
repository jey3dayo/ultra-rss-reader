import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OverlayStageSurface } from "@/components/shared/overlay-stage-surface";
import { BrowserSurfaceStateCard } from "./browser-surface-state-card";
import type { BrowserOverlayStageProps } from "./browser-view.types";

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
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
            <div data-testid="browser-loading-state" className="flex max-w-sm flex-col items-center gap-4 text-center">
              <div className="relative flex items-center justify-center">
                <div aria-hidden="true" className="absolute h-12 w-20 rounded-lg bg-primary/12 blur-2xl" />
                <LoaderCircle aria-hidden="true" className="relative size-12 animate-spin text-foreground/92" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium tracking-[0.02em] text-foreground">{t("browser_loading")}</p>
                <p className="text-sm text-foreground-soft">{t("browser_loading_hint")}</p>
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
    </OverlayStageSurface>
  );
}
