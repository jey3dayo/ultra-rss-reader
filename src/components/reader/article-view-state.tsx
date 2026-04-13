import { useTranslation } from "react-i18next";
import type {
  ArticleEmptyStateShellProps,
  ArticleNotFoundStateViewProps,
  BrowserOnlyStateViewProps,
  BrowserOverlaySurfaceProps,
} from "./article-view.types";
import { BrowserView } from "./browser-view";

export function BrowserOverlaySurface({
  children,
  onCloseOverlay,
  showBrowserView = true,
  toolbarActions,
}: BrowserOverlaySurfaceProps) {
  const { t } = useTranslation("reader");

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {children}
      {showBrowserView ? (
        <BrowserView
          scope="main-stage"
          onCloseOverlay={onCloseOverlay}
          labels={{
            closeOverlay: t("close_browser_overlay"),
          }}
          toolbarActions={toolbarActions}
        />
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
      <div className="flex flex-1 items-center justify-center text-muted-foreground">{message}</div>
    </div>
  );
}
