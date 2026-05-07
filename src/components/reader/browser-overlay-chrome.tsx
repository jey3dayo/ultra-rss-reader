import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RotateCw,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { IconToolbarSurfaceButton } from "@/components/shared/icon-toolbar-control";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BrowserOverlayChromeProps } from "./browser-view.types";

const ACCEPTED_ACTION_SPIN_MS = 1_000;

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
    <IconToolbarSurfaceButton
      label={closeLabel}
      onClick={onClose}
      variant="chrome"
    >
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
  spinning = false,
  tooltipSide,
  children,
}: {
  actionKey: string;
  compact: boolean;
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  spinning?: boolean;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  children: ReactNode;
}) {
  const content = isValidElement<{ className?: string }>(children)
    ? cloneElement(children, {
        className: cn(children.props.className, spinning && "animate-spin"),
      })
    : children;

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
      tooltipSide={tooltipSide}
    >
      {content}
    </IconToolbarSurfaceButton>
  );
}

export function BrowserOverlayChrome(props: BrowserOverlayChromeProps) {
  const { t } = useTranslation("reader");
  const [activeFeedbackAction, setActiveFeedbackAction] = useState<
    string | null
  >(null);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  if (isCloseOnlyProps(props)) {
    return <BrowserOverlayCloseOnlyChrome {...props} />;
  }

  const { controller, presentation, closeWebPreviewLabel, toolbarActions } =
    props;

  const startAcceptedFeedback = (actionKey: string) => {
    setActiveFeedbackAction(actionKey);

    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }

    feedbackTimerRef.current = window.setTimeout(() => {
      setActiveFeedbackAction(null);
      feedbackTimerRef.current = null;
    }, ACCEPTED_ACTION_SPIN_MS);
  };

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
        <div
          data-testid="browser-overlay-chrome"
          className="pointer-events-auto flex items-center gap-2"
        >
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
            onClick={() => {
              startAcceptedFeedback("browser-back");
              return controller.browserState?.can_go_back
                ? controller.handleGoBack()
                : controller.handleCloseOverlay();
            }}
            disabled={!controller.browserState}
            spinning={activeFeedbackAction === "browser-back"}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </BrowserOverlayIconAction>
          <BrowserOverlayIconAction
            actionKey="browser-forward"
            compact={presentation.leadingActionSurface.compact}
            label={t("web_forward")}
            onClick={() => {
              startAcceptedFeedback("browser-forward");
              return controller.handleGoForward();
            }}
            disabled={!controller.browserState?.can_go_forward}
            spinning={activeFeedbackAction === "browser-forward"}
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
            tooltipSide="left"
            onClick={() => {
              startAcceptedFeedback("reload-web-preview");
              return controller.handleReload();
            }}
            disabled={!controller.browserState}
            spinning={activeFeedbackAction === "reload-web-preview"}
          >
            <RotateCw aria-hidden="true" className="size-4" />
          </BrowserOverlayIconAction>
          <BrowserOverlayIconAction
            actionKey="open-external-browser"
            compact={presentation.actionButtonSurface.compact}
            label={t("open_in_external_browser")}
            tooltipSide="left"
            onClick={controller.handleOpenExternal}
            disabled={!controller.browserState}
          >
            <ExternalLink aria-hidden="true" className="size-4" />
          </BrowserOverlayIconAction>
          {toolbarActions?.map((action) => (
            <BrowserOverlayIconAction
              key={action.key}
              actionKey={action.key}
              compact={presentation.actionButtonSurface.compact}
              label={action.label}
              tooltipSide="left"
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.icon}
            </BrowserOverlayIconAction>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
