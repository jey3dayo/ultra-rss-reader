import { X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import type { SettingsModalViewProps } from "@/components/settings/settings-modal.types";
import { IndeterminateProgress } from "@/components/shared/indeterminate-progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type { SettingsModalViewProps } from "@/components/settings/settings-modal.types";

const HIDDEN_SCROLLBAR_CLASS = "[&>[data-slot='scroll-area-scrollbar']]:hidden";

function useScrollOverflowState(dependency: unknown) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useLayoutEffect(() => {
    void dependency;

    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const updateOverflow = () => {
      setHasOverflow(viewport.scrollHeight > viewport.clientHeight + 1);
    };

    updateOverflow();
    const animationFrame = window.requestAnimationFrame(() => {
      updateOverflow();
    });
    window.addEventListener("resize", updateOverflow);

    if (typeof ResizeObserver === "undefined") {
      return () => {
        window.cancelAnimationFrame(animationFrame);
        window.removeEventListener("resize", updateOverflow);
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
      window.removeEventListener("resize", updateOverflow);
      mutationObserver?.disconnect();
      resizeObserver.disconnect();
    };
  }, [dependency]);

  return {
    hasOverflow,
    viewportRef,
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
  contentScrollBehavior = "auto",
  isLoading,
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
        showCloseButton={false}
      >
        {isLoading && <IndeterminateProgress className="absolute inset-x-0 top-0 z-10" />}
        <div
          data-testid="settings-nav-shell"
          className="flex max-h-[42vh] w-full shrink-0 flex-col border-b border-border/80 sm:max-h-none sm:w-[292px] sm:border-r sm:border-b-0"
          style={{ backgroundColor: "var(--settings-shell-rail)" }}
        >
          <DialogHeader
            data-testid="settings-modal-header"
            className="flex min-h-[4.5rem] flex-row items-center gap-3 border-b border-border/80 px-5 py-0 backdrop-blur-sm"
            style={{ backgroundColor: "var(--settings-shell-rail)" }}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label={closeLabel}
              className="text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
            <DialogTitle className="font-sans text-[15px] font-medium tracking-[-0.01em] text-sidebar-foreground">
              {title}
            </DialogTitle>
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
              className={cn("h-full min-h-0", !navigationOverflow.hasOverflow && HIDDEN_SCROLLBAR_CLASS)}
            >
              {navigation}
              <div
                data-testid="settings-mobile-accounts-section"
                className="mx-3 mb-3 rounded-lg border border-border/70 px-3 py-3 shadow-elevation-1 sm:hidden"
                style={{ backgroundColor: "var(--settings-shell-account-surface)" }}
              >
                {accountsHeading ? (
                  <p className="mb-2 px-1 font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/48">
                    {accountsHeading}
                  </p>
                ) : null}
                {accountsNavigation}
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
            className="mx-3 mb-3 hidden rounded-lg border border-border/70 px-3 py-3 shadow-elevation-1 sm:block"
            style={{ backgroundColor: "var(--settings-shell-account-surface)" }}
          >
            {accountsHeading ? (
              <p className="mb-2 px-1 font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/48">
                {accountsHeading}
              </p>
            ) : null}
            <div data-testid="settings-accounts-scroll-area" className="min-h-0 max-h-[22rem] overflow-y-auto">
              {accountsNavigation}
            </div>
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
              data-testid="settings-content-scroll-area"
              viewportRef={contentOverflow.viewportRef}
              className={cn("h-full min-h-0", !contentHasOverflow && HIDDEN_SCROLLBAR_CLASS)}
            >
              {content}
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
