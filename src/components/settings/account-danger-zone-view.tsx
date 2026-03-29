import { Button } from "@/components/ui/button";

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
          <Button variant="destructive" onClick={onRequestDelete} className="text-sm">
            {deleteLabel}
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-destructive">{confirmDeleteLabel}</span>
            <Button variant="destructive" size="sm" onClick={onConfirmDelete}>
              {deleteLabel}
            </Button>
            <Button variant="outline" size="sm" onClick={onCancelDelete}>
              {cancelLabel}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
