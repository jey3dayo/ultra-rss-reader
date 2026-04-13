import { DeleteButton } from "@/components/shared/delete-button";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

type DestructiveDialogFooterProps = {
  cancelLabel: string;
  confirmLabel: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DestructiveDialogFooter({
  cancelLabel,
  confirmLabel,
  pending = false,
  onCancel,
  onConfirm,
}: DestructiveDialogFooterProps) {
  return (
    <DialogFooter>
      <Button variant="outline" onClick={onCancel} disabled={pending}>
        {cancelLabel}
      </Button>
      <DeleteButton onClick={onConfirm} disabled={pending}>
        {confirmLabel}
      </DeleteButton>
    </DialogFooter>
  );
}
