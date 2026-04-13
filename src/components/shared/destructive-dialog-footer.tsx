import { DeleteButton } from "@/components/shared/delete-button";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import type { DestructiveDialogFooterProps } from "./button.types";

export function DestructiveDialogFooter({
  cancelLabel,
  confirmLabel,
  pending = false,
  onCancel,
  onConfirm,
}: DestructiveDialogFooterProps) {
  return (
    <DialogFooter>
      <Button variant="outline" onClick={onCancel} disabled={pending} className="min-h-11">
        {cancelLabel}
      </Button>
      <DeleteButton onClick={onConfirm} disabled={pending} className="min-h-11">
        {confirmLabel}
      </DeleteButton>
    </DialogFooter>
  );
}
