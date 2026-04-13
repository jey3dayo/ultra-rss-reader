import { DeleteButton } from "@/components/shared/delete-button";
import { Button } from "@/components/ui/button";
import type { AccountDangerZoneViewProps } from "./account-detail.types";

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
        <Button variant="outline" onClick={onExport} className="w-full justify-center text-sm sm:w-auto">
          {exportLabel}
        </Button>
      </div>

      <div className="mt-2 border-t border-border pt-6">
        {!isConfirmingDelete ? (
          <DeleteButton onClick={onRequestDelete} className="w-full justify-center text-sm sm:w-auto">
            {deleteLabel}
          </DeleteButton>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="text-sm text-destructive sm:flex-1">{confirmDeleteLabel}</span>
            <DeleteButton size="sm" className="w-full justify-center sm:w-auto" onClick={onConfirmDelete}>
              {deleteLabel}
            </DeleteButton>
            <Button variant="outline" size="sm" className="w-full justify-center sm:w-auto" onClick={onCancelDelete}>
              {cancelLabel}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
