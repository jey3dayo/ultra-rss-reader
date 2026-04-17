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

export function BrowserOverlayChrome(props: BrowserOverlayChromeProps) {
  const { t } = useTranslation("reader");

  if (isCloseOnlyProps(props)) {
    return (
      <IconToolbarSurfaceButton label={props.closeLabel} onClick={props.onClose} variant="chrome">
        <X aria-hidden="true" className="size-4" />
      </IconToolbarSurfaceButton>
    );
  }

  const { controller, presentation, closeWebPreviewLabel, toolbarActions } = props;
  const overlayActionRenderer = {
    compact: presentation.actionButtonSurface.compact,
    renderAction: (content: ReactNode, options?: { key?: string }) => (
      <OverlayActionSurface key={options?.key} variant="chrome" {...presentation.actionButtonSurface}>
        {content}
      </OverlayActionSurface>
    ),
  } as const;

  function renderIconAction({
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
          {renderIconAction({
            actionKey: "close-web-preview",
            compact: presentation.leadingActionSurface.compact,
            label: closeWebPreviewLabel,
            onClick: controller.handleCloseOverlay,
            children: <X aria-hidden="true" className="size-4" />,
          })}
          {renderIconAction({
            actionKey: "browser-back",
            compact: presentation.leadingActionSurface.compact,
            label: t("web_back"),
            onClick: controller.handleGoBack,
            disabled: !controller.browserState?.can_go_back,
            children: <ChevronLeft aria-hidden="true" className="size-4" />,
          })}
          {renderIconAction({
            actionKey: "browser-forward",
            compact: presentation.leadingActionSurface.compact,
            label: t("web_forward"),
            onClick: controller.handleGoForward,
            disabled: !controller.browserState?.can_go_forward,
            children: <ChevronRight aria-hidden="true" className="size-4" />,
          })}
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
          {renderIconAction({
            actionKey: "reload-web-preview",
            compact: presentation.actionButtonSurface.compact,
            label: t("reload_page"),
            onClick: controller.handleReload,
            disabled: !controller.browserState,
            children: <RotateCw aria-hidden="true" className="size-4" />,
          })}
          {renderIconAction({
            actionKey: "open-external-browser",
            compact: presentation.actionButtonSurface.compact,
            label: t("open_in_external_browser"),
            onClick: controller.handleOpenExternal,
            disabled: !controller.browserState,
            children: <ExternalLink aria-hidden="true" className="size-4" />,
          })}
          {toolbarActions ? toolbarActions(overlayActionRenderer) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}
