import { ChevronLeft, ExternalLink, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconToolbarButton } from "@/components/shared/icon-toolbar-control";
import { Button } from "@/components/ui/button";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import type { BrowserOverlayChromeProps } from "./browser-view.types";

const browserOverlayChromeCloseButtonClassName =
  "size-[46px] rounded-full border border-border/70 bg-background/72 text-foreground shadow-elevation-2 backdrop-blur-md focus-visible:ring-2 focus-visible:ring-ring/70 active:scale-[0.97] active:bg-card active:shadow-elevation-1";

function isCloseOnlyProps(
  props: BrowserOverlayChromeProps,
): props is Extract<BrowserOverlayChromeProps, { closeLabel: string }> {
  return "closeLabel" in props;
}

export function BrowserOverlayChrome(props: BrowserOverlayChromeProps) {
  const { t } = useTranslation("reader");

  if (isCloseOnlyProps(props)) {
    return (
      <IconToolbarButton
        label={props.closeLabel}
        onClick={props.onClose}
        className={browserOverlayChromeCloseButtonClassName}
      >
        <X aria-hidden="true" className="size-4" />
      </IconToolbarButton>
    );
  }

  const { controller, backToReaderLabel, toolbarActions } = props;
  const visibleBackLabel = t("back_to_reader_short");
  const leadingAction = (
    <Button
      variant="ghost"
      size={controller.geometry.compact ? "icon" : "sm"}
      onClick={controller.handleCloseOverlay}
      aria-label={backToReaderLabel}
      className={controller.leadingActionClass}
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      {!controller.geometry.compact ? <span className="truncate">{visibleBackLabel}</span> : null}
    </Button>
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
  );
}
