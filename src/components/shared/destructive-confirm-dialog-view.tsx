import { DestructiveDialogFooter } from "@/components/shared/destructive-dialog-footer";
import type { DestructiveConfirmDialogViewProps } from "@/components/shared/dialog.types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function DestructiveConfirmDialogView({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  pending = false,
  onOpenChange,
  onConfirm,
}: DestructiveConfirmDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">{description}</div>
        <DestructiveDialogFooter
          cancelLabel={cancelLabel}
          confirmLabel={confirmLabel}
          pending={pending}
          onCancel={() => onOpenChange(false)}
          onConfirm={onConfirm}
        />
      </DialogContent>
    </Dialog>
  );
}
