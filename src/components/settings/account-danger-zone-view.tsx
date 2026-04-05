import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/shared/delete-button";

export type AccountDangerZoneViewProps = {
  exportLabel: string;
  deleteLabel: string;
  cancelLabel: string;
  confirmDeleteLabel: string;
  isConfirmingDelete: boolean;
  onExport: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

export function AccountDangerZoneView({
  exportLabel,
  deleteLabel,
  cancelLabel,
  confirmDeleteLabel,
  isConfirmingDelete,
  onExport,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: AccountDangerZoneViewProps) {
  return (
    <>
      <div className="mt-6 border-t border-border pt-6">
        <Button variant="outline" onClick={onExport} className="text-sm">
          {exportLabel}
        </Button>
      </div>

      <div className="mt-2 border-t border-border pt-6">
        {!isConfirmingDelete ? (
          <DeleteButton onClick={onRequestDelete} className="text-sm">
            {deleteLabel}
          </DeleteButton>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-destructive">{confirmDeleteLabel}</span>
            <DeleteButton size="sm" onClick={onConfirmDelete}>
              {deleteLabel}
            </DeleteButton>
            <Button variant="outline" size="sm" onClick={onCancelDelete}>
              {cancelLabel}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
