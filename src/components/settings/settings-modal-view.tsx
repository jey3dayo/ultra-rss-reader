import { X } from "lucide-react";
import type { ReactNode } from "react";
import { IndeterminateProgress } from "@/components/shared/indeterminate-progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export type SettingsModalViewProps = {
  open: boolean;
  title: string;
  closeLabel: string;
  navigation: ReactNode;
  accountsNavigation: ReactNode;
  content: ReactNode;
  isLoading?: boolean;
  onClose: () => void;
  onOpenChange: (open: boolean) => void;
};

export function SettingsModalView({
  open,
  title,
  closeLabel,
  navigation,
  accountsNavigation,
  content,
  isLoading,
  onClose,
  onOpenChange,
}: SettingsModalViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[80vh] max-h-[720px] max-w-[920px] gap-0 overflow-hidden p-0 sm:max-w-[920px]"
        showCloseButton={false}
      >
        {isLoading && <IndeterminateProgress className="absolute inset-x-0 top-0 z-10" />}
        <div className="flex w-[260px] flex-col border-r border-border bg-sidebar">
          <DialogHeader className="flex flex-row items-center gap-3 border-b border-border px-4 py-4">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label={closeLabel}
              className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
            <DialogTitle className="text-base font-medium">{title}</DialogTitle>
          </DialogHeader>

          <ScrollArea data-testid="settings-scroll-area" className="min-h-0 flex-1">
            {navigation}
          </ScrollArea>

          <div className="border-t border-border p-2">{accountsNavigation}</div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden bg-popover">
          <ScrollArea data-testid="settings-scroll-area" className="min-h-0 flex-1">
            {content}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
