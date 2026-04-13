import { ExternalLink, X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { IconToolbarButton } from "@/components/shared/icon-toolbar-control";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { BrowserViewController } from "./use-browser-view-controller";

type BrowserOverlayChromeOverlayProps = {
  controller: Pick<
    BrowserViewController,
    "geometry" | "handleCloseOverlay" | "handleOpenExternal" | "closeButtonClass" | "actionButtonClass"
  >;
  closeOverlayLabel: string;
  toolbarActions?: ReactNode;
};

type BrowserOverlayChromeCloseOnlyProps = {
  closeLabel: string;
  onClose: () => void;
};

type BrowserOverlayChromeProps = BrowserOverlayChromeOverlayProps | BrowserOverlayChromeCloseOnlyProps;

const browserOverlayChromeCloseButtonClassName =
  "size-[46px] rounded-full border border-white/10 bg-white/8 text-white shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-md focus-visible:ring-2 focus-visible:ring-white/70 active:scale-[0.97] active:bg-white/16";

function isCloseOnlyProps(props: BrowserOverlayChromeProps): props is BrowserOverlayChromeCloseOnlyProps {
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

  const { controller, closeOverlayLabel, toolbarActions } = props;

  return (
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
          label={closeOverlayLabel}
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
  );
}
