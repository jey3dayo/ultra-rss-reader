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
    window.addEventListener("resize", updateOverflow);

    if (typeof ResizeObserver === "undefined") {
      return () => {
        window.removeEventListener("resize", updateOverflow);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateOverflow();
    });

    resizeObserver.observe(viewport);

    const content = viewport.firstElementChild;
    if (content instanceof HTMLElement) {
      resizeObserver.observe(content);
    }

    return () => {
      window.removeEventListener("resize", updateOverflow);
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
  const contentHasOverflow = contentScrollBehavior === "never" ? false : contentOverflow.hasOverflow;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="settings-modal-surface"
        className="flex h-[88vh] max-h-[840px] max-w-[920px] flex-col gap-0 overflow-hidden p-0 sm:flex-row sm:max-w-[920px]"
        showCloseButton={false}
      >
        {isLoading && <IndeterminateProgress className="absolute inset-x-0 top-0 z-10" />}
        <div className="flex max-h-[42vh] w-full shrink-0 flex-col border-b border-border bg-sidebar sm:max-h-none sm:w-[260px] sm:border-r sm:border-b-0">
          <DialogHeader
            data-testid="settings-modal-header"
            className="flex min-h-16 flex-row items-center gap-3 border-b border-border px-4 py-0"
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
            <DialogTitle className="text-[15px] font-semibold tracking-[0.01em] text-sidebar-foreground">
              {title}
            </DialogTitle>
          </DialogHeader>

          <div className="relative min-h-0 flex-1">
            {navigationOverflow.hasOverflow ? (
              <div
                data-testid="settings-nav-fade-top"
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-gradient-to-b from-sidebar via-sidebar/92 to-transparent"
              />
            ) : null}
            <ScrollArea
              data-testid="settings-scroll-area"
              viewportRef={navigationOverflow.viewportRef}
              className={cn("h-full min-h-0", !navigationOverflow.hasOverflow && HIDDEN_SCROLLBAR_CLASS)}
            >
              {navigation}
            </ScrollArea>
            {navigationOverflow.hasOverflow ? (
              <div
                data-testid="settings-nav-fade-bottom"
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-sidebar via-sidebar/94 to-transparent"
              />
            ) : null}
          </div>

          <div data-testid="settings-accounts-section" className="border-t border-border/80 bg-sidebar/95 px-3 py-3">
            {accountsHeading ? (
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/48">
                {accountsHeading}
              </p>
            ) : null}
            {accountsNavigation}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-popover">
          <div className="relative min-h-0 flex-1">
            {contentHasOverflow ? (
              <div
                data-testid="settings-content-fade-top"
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-popover via-popover/94 to-transparent"
              />
            ) : null}
            <ScrollArea
              data-testid="settings-scroll-area"
              viewportRef={contentOverflow.viewportRef}
              className={cn("h-full min-h-0", !contentHasOverflow && HIDDEN_SCROLLBAR_CLASS)}
            >
              {content}
            </ScrollArea>
            {contentHasOverflow ? (
              <div
                data-testid="settings-content-fade-bottom"
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-popover via-popover/95 to-transparent"
              />
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
