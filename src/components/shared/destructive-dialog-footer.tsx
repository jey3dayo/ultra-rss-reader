import { DeleteButton } from "@/components/shared/delete-button";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

type DestructiveDialogFooterProps = {
  cancelLabel: string;
  confirmLabel: string;
  confirmAccessibleLabel?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DestructiveDialogFooter({
  cancelLabel,
  confirmLabel,
  confirmAccessibleLabel,
  pending = false,
  onCancel,
  onConfirm,
}: DestructiveDialogFooterProps) {
  return (
    <DialogFooter>
      <Button variant="outline" onClick={onCancel} disabled={pending} className="min-h-11">
        {cancelLabel}
      </Button>
      <DeleteButton
        onClick={onConfirm}
        disabled={pending}
        aria-label={confirmAccessibleLabel}
        aria-busy={pending}
        className="min-h-11"
      >
        {confirmLabel}
      </DeleteButton>
    </DialogFooter>
  );
}
