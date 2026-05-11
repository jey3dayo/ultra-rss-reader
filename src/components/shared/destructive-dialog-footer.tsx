import { DeleteButton } from "@/components/shared/delete-button";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

type DestructiveDialogFooterProps = {
  cancelLabel: string;
  confirmLabel: string;
  confirmAccessibleLabel?: string;
  confirmDescriptionId?: string;
  confirmDisabled?: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DestructiveDialogFooter({
  cancelLabel,
  confirmLabel,
  confirmAccessibleLabel,
  confirmDescriptionId,
  confirmDisabled = false,
  pending = false,
  onCancel,
  onConfirm,
}: DestructiveDialogFooterProps) {
  const actionDisabled = pending || confirmDisabled;

  return (
    <DialogFooter>
      <Button variant="outline" onClick={onCancel} disabled={pending} className="min-h-11">
        {cancelLabel}
      </Button>
      <DeleteButton
        onClick={onConfirm}
        disabled={actionDisabled}
        aria-label={confirmAccessibleLabel}
        aria-describedby={confirmDescriptionId}
        aria-busy={pending}
        className="min-h-11"
      >
        {confirmLabel}
      </DeleteButton>
    </DialogFooter>
  );
}
