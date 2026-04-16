import { ChevronLeft, ExternalLink, X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { OverlayActionSurface } from "@/components/shared/overlay-action-surface";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import type { BrowserOverlayChromeProps } from "./browser-view.types";

const compactOverlayActionButtonClassName =
  "flex size-full items-center justify-center rounded-full bg-transparent text-foreground outline-none focus-visible:outline-none";
const regularOverlayActionButtonClassName =
  "flex h-full items-center justify-center gap-1 rounded-full bg-transparent text-foreground outline-none focus-visible:outline-none";

function isCloseOnlyProps(
  props: BrowserOverlayChromeProps,
): props is Extract<BrowserOverlayChromeProps, { closeLabel: string }> {
  return "closeLabel" in props;
}

export function BrowserOverlayChrome(props: BrowserOverlayChromeProps) {
  const { t } = useTranslation("reader");

  if (isCloseOnlyProps(props)) {
    return (
      <OverlayActionSurface compact tone="subtle">
        <AppTooltip label={props.closeLabel}>
          <button
            type="button"
            aria-label={props.closeLabel}
            onClick={props.onClose}
            className={compactOverlayActionButtonClassName}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </AppTooltip>
      </OverlayActionSurface>
    );
  }

  const { controller, presentation, backToReaderLabel, toolbarActions } = props;
  const visibleBackLabel = t("back_to_reader_short");
  const actionButtonClassName = controller.geometry.compact
    ? compactOverlayActionButtonClassName
    : regularOverlayActionButtonClassName;
  const leadingActionButtonClassName = controller.geometry.compact
    ? compactOverlayActionButtonClassName
    : regularOverlayActionButtonClassName;
  const overlayActionRenderer = {
    compact: presentation.actionButtonSurface.compact,
    renderAction: (content: ReactNode, options?: { key?: string }) => (
      <OverlayActionSurface key={options?.key} {...presentation.actionButtonSurface}>
        {content}
      </OverlayActionSurface>
    ),
  } as const;
  const leadingAction = (
    <OverlayActionSurface {...presentation.leadingActionSurface}>
      <button
        type="button"
        onClick={controller.handleCloseOverlay}
        aria-label={backToReaderLabel}
        className={leadingActionButtonClassName}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        {!controller.geometry.compact ? <span className="truncate">{visibleBackLabel}</span> : null}
      </button>
    </OverlayActionSurface>
  );

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
        <div data-testid="browser-overlay-chrome" className="pointer-events-auto">
          {controller.geometry.compact ? (
            <AppTooltip label={backToReaderLabel}>{leadingAction}</AppTooltip>
          ) : (
            leadingAction
          )}
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
          {toolbarActions ? (
            toolbarActions(overlayActionRenderer)
          ) : (
            <OverlayActionSurface {...presentation.actionButtonSurface}>
              <AppTooltip label={t("open_in_external_browser")}>
                <button
                  type="button"
                  aria-label={t("open_in_external_browser")}
                  onClick={() => {
                    void controller.handleOpenExternal();
                  }}
                  className={actionButtonClassName}
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              </AppTooltip>
            </OverlayActionSurface>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
