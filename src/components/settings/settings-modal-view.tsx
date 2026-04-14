import { X } from "lucide-react";
import type { SettingsModalViewProps } from "@/components/settings/settings-modal.types";
import { IndeterminateProgress } from "@/components/shared/indeterminate-progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export type { SettingsModalViewProps } from "@/components/settings/settings-modal.types";

export function SettingsModalView({
  open,
  title,
  closeLabel,
  navigation,
  accountsHeading,
  accountsNavigation,
  content,
  isLoading,
  onClose,
  onOpenChange,
}: SettingsModalViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="settings-modal-surface"
        className="flex h-[88vh] max-h-[840px] max-w-[920px] flex-col gap-0 overflow-hidden p-0 sm:flex-row sm:max-w-[920px]"
        showCloseButton={false}
      >
        {isLoading && <IndeterminateProgress className="absolute inset-x-0 top-0 z-10" />}
        <div className="flex max-h-[42vh] w-full shrink-0 flex-col border-b border-border bg-sidebar sm:max-h-none sm:w-[260px] sm:border-r sm:border-b-0">
          <DialogHeader className="flex flex-row items-center gap-3 border-b border-border px-4 py-4">
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
            <div
              data-testid="settings-nav-fade-top"
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-gradient-to-b from-sidebar via-sidebar/92 to-transparent"
            />
            <ScrollArea data-testid="settings-scroll-area" className="h-full min-h-0">
              {navigation}
            </ScrollArea>
            <div
              data-testid="settings-nav-fade-bottom"
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-sidebar via-sidebar/94 to-transparent"
            />
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
            <div
              data-testid="settings-content-fade-top"
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-popover via-popover/94 to-transparent"
            />
            <ScrollArea data-testid="settings-scroll-area" className="h-full min-h-0">
              {content}
            </ScrollArea>
            <div
              data-testid="settings-content-fade-bottom"
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-popover via-popover/95 to-transparent"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
