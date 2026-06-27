import { lazy, type ReactNode, Suspense } from "react";
import { useTranslation } from "react-i18next";
import type { UiDisplayState } from "@/lib/ui/display-state.types";
import type { BrowserOverlayCloseHandler, BrowserOverlayToolbarAction, BrowserViewScope } from "./browser-view.types";

const LazyBrowserView = lazy(async () => {
  const mod = await import("./browser-view");
  return { default: mod.BrowserView };
});

type BrowserOverlaySurfaceProps = {
  children?: ReactNode;
  onCloseOverlay: () => void;
  onBrowserWebviewClosed?: () => void;
  showBrowserView?: boolean;
  scope?: BrowserViewScope;
  toolbarActions?: BrowserOverlayToolbarAction[];
};

type ArticleEmptyStateShellProps = {
  toolbar: ReactNode;
  body: ReactNode;
};

type BrowserOnlyStateViewProps = BrowserOverlayCloseHandler;

type ArticleNotFoundStateViewProps = UiDisplayState;

export function BrowserOverlaySurface({
  children,
  onCloseOverlay,
  onBrowserWebviewClosed,
  showBrowserView = true,
  scope = "content-pane",
  toolbarActions,
}: BrowserOverlaySurfaceProps) {
  const { t } = useTranslation("reader");

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {children}
      {showBrowserView ? (
        <Suspense fallback={null}>
          <LazyBrowserView
            scope={scope}
            onCloseOverlay={onCloseOverlay}
            onBrowserWebviewClosed={onBrowserWebviewClosed}
            labels={{
              closeWebPreview: t("close_browser_overlay"),
            }}
            toolbarActions={toolbarActions}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

export function ArticleEmptyStateShell({ toolbar, body }: ArticleEmptyStateShellProps) {
  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      {toolbar}
      {body}
    </div>
  );
}

export function BrowserOnlyStateView({ onCloseOverlay }: BrowserOnlyStateViewProps) {
  return (
    <div className="relative flex h-full flex-1 flex-col bg-background">
      <BrowserOverlaySurface onCloseOverlay={onCloseOverlay} />
    </div>
  );
}

export function ArticleNotFoundStateView({ message }: ArticleNotFoundStateViewProps) {
  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <div className="flex flex-1 items-center justify-center text-foreground-soft">{message}</div>
    </div>
  );
}
