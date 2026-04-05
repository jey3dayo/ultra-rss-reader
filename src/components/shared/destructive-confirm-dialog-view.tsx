import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteButton } from "@/components/shared/delete-button";

export function DestructiveConfirmDialogView({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  pending = false,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">{description}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <DeleteButton onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </DeleteButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
