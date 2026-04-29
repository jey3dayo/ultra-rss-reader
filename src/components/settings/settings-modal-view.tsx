import { X } from "lucide-react";
import { useCallback, useLayoutEffect, useReducer, useRef } from "react";
import { SettingsActionButton } from "@/components/settings/settings-action-button";
import type { SettingsModalViewProps } from "@/components/settings/settings-modal.types";
import { IndeterminateProgress } from "@/components/shared/indeterminate-progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import { cn } from "@/lib/utils";
import { bindWindowEvents } from "@/lib/window-events";

export type { SettingsModalViewProps } from "@/components/settings/settings-modal.types";

const HIDDEN_SCROLLBAR_CLASS = "[&>[data-slot='scroll-area-scrollbar']]:hidden";
const SHELL_SECTION_LABEL_CLASS =
  "mb-2 px-1 font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--settings-shell-section-label)]";

type ScrollOverflowState = {
  viewportElement: HTMLDivElement | null;
  hasOverflow: boolean;
};

type ScrollOverflowAction =
  | { type: "set-viewport-element"; value: HTMLDivElement | null }
  | { type: "set-has-overflow"; value: boolean };

const initialScrollOverflowState: ScrollOverflowState = {
  viewportElement: null,
  hasOverflow: false,
};

function scrollOverflowReducer(state: ScrollOverflowState, action: ScrollOverflowAction): ScrollOverflowState {
  switch (action.type) {
    case "set-viewport-element":
      return { ...state, viewportElement: action.value };
    case "set-has-overflow":
      return { ...state, hasOverflow: action.value };
    default:
      return state;
  }
}

function useScrollOverflowState(dependency: unknown) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(scrollOverflowReducer, initialScrollOverflowState);
  const { viewportElement, hasOverflow } = state;

  const setViewportNode = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
    dispatch({ type: "set-viewport-element", value: node });
  }, []);

  useLayoutEffect(() => {
    void dependency;

    const viewport = viewportElement;

    if (!viewport) {
      return;
    }

    const updateOverflow = () => {
      dispatch({ type: "set-has-overflow", value: viewport.scrollHeight > viewport.clientHeight + 1 });
    };

    updateOverflow();
    const animationFrame = window.requestAnimationFrame(() => {
      updateOverflow();
    });
    const removeWindowEvents = bindWindowEvents([{ type: "resize", listener: updateOverflow }]);

    if (typeof ResizeObserver === "undefined") {
      return () => {
        window.cancelAnimationFrame(animationFrame);
        removeWindowEvents();
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateOverflow();
    });
    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            updateOverflow();
          });

    resizeObserver.observe(viewport);

    const content = viewport.firstElementChild;
    if (content instanceof HTMLElement) {
      resizeObserver.observe(content);
    }
    mutationObserver?.observe(viewport, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      removeWindowEvents();
      mutationObserver?.disconnect();
      resizeObserver.disconnect();
    };
  }, [dependency, viewportElement]);

  return {
    hasOverflow,
    viewportElement,
    viewportRef: setViewportNode,
  };
}

export function SettingsModalView({
  open,
  title,
  closeLabel,
  navigation,
  accountsHeading,
  accountsNavigation,
  content,
  contentResetKey = "",
  contentScrollBehavior = "auto",
  isLoading,
  isCloseDisabled = false,
  lockMessage,
  onClose,
  onOpenChange,
}: SettingsModalViewProps) {
  const navigationOverflow = useScrollOverflowState(navigation);
  const contentOverflow = useScrollOverflowState(content);
  const contentHasOverflow =
    contentScrollBehavior === "always" ? true : contentScrollBehavior === "never" ? false : contentOverflow.hasOverflow;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="settings-modal-surface"
        className="flex h-[88vh] max-h-[860px] max-w-[980px] flex-col gap-0 overflow-hidden rounded-xl border border-border/70 bg-popover p-0 shadow-elevation-3 sm:flex-row sm:max-w-[980px]"
        overlayPreset="readable"
        showCloseButton={false}
      >
        {isLoading && <IndeterminateProgress className="absolute inset-x-0 top-0 z-10" />}
        <div
          data-testid="settings-nav-shell"
          className="flex max-h-[15rem] w-full shrink-0 flex-col border-b border-border/80 sm:max-h-none sm:w-[292px] sm:border-r sm:border-b-0"
          style={{ backgroundColor: "var(--settings-shell-rail)" }}
        >
          <DialogHeader
            data-testid="settings-modal-header"
            className="flex min-h-[4.5rem] flex-row items-center gap-3 border-b border-border/80 px-5 py-0 backdrop-blur-sm"
            style={{ backgroundColor: "var(--settings-shell-rail)" }}
          >
            <SettingsActionButton
              size="icon"
              tone="rail"
              onClick={onClose}
              disabled={isCloseDisabled}
              aria-label={closeLabel}
            >
              <X className="h-4 w-4" />
            </SettingsActionButton>
            <div className="min-w-0">
              <DialogTitle className="font-sans text-[15px] font-medium tracking-[-0.01em] text-sidebar-foreground">
                {title}
              </DialogTitle>
              {lockMessage ? (
                <p
                  className="mt-1 text-xs leading-[1.4] text-sidebar-foreground/56"
                  data-testid="settings-lock-message"
                >
                  {lockMessage}
                </p>
              ) : null}
            </div>
          </DialogHeader>

          <div className="relative min-h-0 flex-1">
            {navigationOverflow.hasOverflow ? (
              <div
                data-testid="settings-nav-fade-top"
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-4"
                style={{ backgroundImage: "var(--settings-shell-rail-fade)" }}
              />
            ) : null}
            <ScrollArea
              data-testid="settings-nav-scroll-area"
              viewportRef={navigationOverflow.viewportRef}
              contentClassName="pr-3"
              className={cn("h-full min-h-0", !navigationOverflow.hasOverflow && HIDDEN_SCROLLBAR_CLASS)}
            >
              {navigation}
              <div
                data-testid="settings-mobile-accounts-section"
                className="mx-3 mb-3 overflow-hidden rounded-md border border-border/60 shadow-none sm:hidden"
                style={{ backgroundColor: "var(--settings-shell-account-surface)" }}
              >
                <ScrollArea
                  data-testid="settings-mobile-accounts-scroll-area"
                  className="min-h-0 max-h-[5.5rem]"
                  contentClassName="px-3 py-2.5 pr-5"
                >
                  {accountsHeading ? <p className={SHELL_SECTION_LABEL_CLASS}>{accountsHeading}</p> : null}
                  {accountsNavigation}
                </ScrollArea>
              </div>
            </ScrollArea>
            {navigationOverflow.hasOverflow ? (
              <div
                data-testid="settings-nav-fade-bottom"
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6"
                style={{ backgroundImage: "var(--settings-shell-rail-fade-reverse)" }}
              />
            ) : null}
          </div>

          <div
            data-testid="settings-accounts-section"
            className="mx-3 mb-3 hidden rounded-md border border-border/60 px-3 py-3 shadow-none sm:block"
            style={{ backgroundColor: "var(--settings-shell-account-surface)" }}
          >
            {accountsHeading ? <p className={SHELL_SECTION_LABEL_CLASS}>{accountsHeading}</p> : null}
            <ScrollArea
              data-testid="settings-accounts-scroll-area"
              className="min-h-0 max-h-[15rem]"
              contentClassName="pr-2"
            >
              {accountsNavigation}
            </ScrollArea>
          </div>
        </div>

        <div
          data-testid="settings-content-shell"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          style={{ backgroundColor: "var(--settings-shell-content)" }}
        >
          <div className="relative min-h-0 flex-1">
            {contentHasOverflow ? (
              <div
                data-testid="settings-content-fade-top"
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5"
                style={{ backgroundImage: "var(--settings-shell-content-fade)" }}
              />
            ) : null}
            <ScrollArea
              key={contentResetKey}
              data-testid="settings-content-scroll-area"
              viewportRef={contentOverflow.viewportRef}
              contentClassName="pr-3"
              className={cn("h-full min-h-0", !contentHasOverflow && HIDDEN_SCROLLBAR_CLASS)}
            >
              <div
                data-testid="settings-content-motion"
                {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
                className={MOTION_CONTENT_SWAP_CLASS_NAME}
              >
                {content}
              </div>
            </ScrollArea>
            {contentHasOverflow ? (
              <div
                data-testid="settings-content-fade-bottom"
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8"
                style={{ backgroundImage: "var(--settings-shell-content-fade-reverse)" }}
              />
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
