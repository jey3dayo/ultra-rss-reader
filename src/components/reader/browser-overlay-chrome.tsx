import { ChevronLeft, ChevronRight, ExternalLink, RotateCw, X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { IconToolbarSurfaceButton } from "@/components/shared/icon-toolbar-control";
import { OverlayActionSurface } from "@/components/shared/overlay-action-surface";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { BrowserOverlayChromeProps } from "./browser-view.types";

function isCloseOnlyProps(
  props: BrowserOverlayChromeProps,
): props is Extract<BrowserOverlayChromeProps, { closeLabel: string }> {
  return "closeLabel" in props;
}

function BrowserOverlayCloseOnlyChrome({
  closeLabel,
  onClose,
}: Extract<BrowserOverlayChromeProps, { closeLabel: string }>) {
  return (
    <IconToolbarSurfaceButton label={closeLabel} onClick={onClose} variant="chrome">
      <X aria-hidden="true" className="size-4" />
    </IconToolbarSurfaceButton>
  );
}

function BrowserOverlayIconAction({
  actionKey,
  compact,
  label,
  onClick,
  disabled = false,
  children,
}: {
  actionKey: string;
  compact: boolean;
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <IconToolbarSurfaceButton
      key={actionKey}
      compact={compact}
      variant="chrome"
      label={label}
      onClick={() => {
        void onClick();
      }}
      disabled={disabled}
    >
      {children}
    </IconToolbarSurfaceButton>
  );
}

function renderBrowserOverlayActionSurface(
  content: ReactNode,
  compact: boolean,
  tone: "default" | "subtle",
  options?: { key?: string },
) {
  return (
    <OverlayActionSurface key={options?.key} compact={compact} tone={tone} variant="chrome">
      {content}
    </OverlayActionSurface>
  );
}

export function BrowserOverlayChrome(props: BrowserOverlayChromeProps) {
  const { t } = useTranslation("reader");

  if (isCloseOnlyProps(props)) {
    return <BrowserOverlayCloseOnlyChrome {...props} />;
  }

  const { controller, presentation, closeWebPreviewLabel, toolbarActions } = props;
  return (
    <TooltipProvider>
      <div
        data-testid="browser-overlay-leading-action"
        style={{
          left: `${controller.geometry.chrome.leading.left}px`,
          top: `${controller.geometry.chrome.leading.top}px`,
        }}
        className="pointer-events-none absolute z-[60]"
      >
        <div data-testid="browser-overlay-chrome" className="pointer-events-auto flex items-center gap-2">
          <BrowserOverlayIconAction
            actionKey="close-web-preview"
            compact={presentation.leadingActionSurface.compact}
            label={closeWebPreviewLabel}
            onClick={controller.handleCloseOverlay}
          >
            <X aria-hidden="true" className="size-4" />
          </BrowserOverlayIconAction>
          <BrowserOverlayIconAction
            actionKey="browser-back"
            compact={presentation.leadingActionSurface.compact}
            label={t("web_back")}
            onClick={controller.handleGoBack}
            disabled={!controller.browserState?.can_go_back}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </BrowserOverlayIconAction>
          <BrowserOverlayIconAction
            actionKey="browser-forward"
            compact={presentation.leadingActionSurface.compact}
            label={t("web_forward")}
            onClick={controller.handleGoForward}
            disabled={!controller.browserState?.can_go_forward}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </BrowserOverlayIconAction>
        </div>
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
          <BrowserOverlayIconAction
            actionKey="reload-web-preview"
            compact={presentation.actionButtonSurface.compact}
            label={t("reload_page")}
            onClick={controller.handleReload}
            disabled={!controller.browserState}
          >
            <RotateCw aria-hidden="true" className="size-4" />
          </BrowserOverlayIconAction>
          <BrowserOverlayIconAction
            actionKey="open-external-browser"
            compact={presentation.actionButtonSurface.compact}
            label={t("open_in_external_browser")}
            onClick={controller.handleOpenExternal}
            disabled={!controller.browserState}
          >
            <ExternalLink aria-hidden="true" className="size-4" />
          </BrowserOverlayIconAction>
          {toolbarActions?.map((action) =>
            renderBrowserOverlayActionSurface(
              action.content,
              presentation.actionButtonSurface.compact,
              presentation.actionButtonSurface.tone,
              { key: action.key },
            ),
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
