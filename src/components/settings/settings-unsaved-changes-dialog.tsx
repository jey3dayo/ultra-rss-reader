import { AlertTriangle } from "lucide-react";
import { useRef } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  LoadingActionContent,
} from "@/design-system";

type SettingsUnsavedChangesDialogProps = {
  open: boolean;
  title: string;
  message: string;
  saveLabel: string;
  savingLabel: string;
  discardLabel: string;
  cancelLabel: string;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
};

export function SettingsUnsavedChangesDialog({
  open,
  title,
  message,
  saveLabel,
  savingLabel,
  discardLabel,
  cancelLabel,
  saving,
  onSave,
  onDiscard,
  onCancel,
}: SettingsUnsavedChangesDialogProps) {
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !saving) {
          onCancel();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        initialFocus={saveButtonRef}
        overlayPreset="readable"
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-6 sm:max-w-sm"
      >
        <div className="flex min-w-0 flex-col gap-6 text-left">
          <DialogHeader className="min-w-0 gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                data-testid="settings-unsaved-changes-dialog-icon"
                className="flex size-8 shrink-0 items-center justify-center rounded-md bg-state-warning-surface"
              >
                <AlertTriangle
                  aria-hidden="true"
                  data-testid="settings-unsaved-changes-dialog-icon-svg"
                  className="size-4 text-state-warning-foreground"
                />
              </div>
              <DialogTitle className="min-w-0 break-words text-base leading-snug font-semibold">{title}</DialogTitle>
            </div>
            <DialogDescription className="leading-relaxed">{message}</DialogDescription>
          </DialogHeader>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={saving}
              className="h-auto min-h-11 min-w-0 max-w-full shrink whitespace-normal py-2 text-foreground-soft [overflow-wrap:anywhere]"
            >
              <span className="min-w-0">{cancelLabel}</span>
            </Button>
            <Button
              variant="outline"
              onClick={onDiscard}
              disabled={saving}
              className="h-auto min-h-11 min-w-0 max-w-full shrink whitespace-normal py-2 [overflow-wrap:anywhere]"
            >
              <span className="min-w-0">{discardLabel}</span>
            </Button>
            <Button
              ref={saveButtonRef}
              onClick={onSave}
              disabled={saving}
              aria-busy={saving || undefined}
              className="h-auto min-h-11 min-w-0 max-w-full shrink whitespace-normal py-2 [overflow-wrap:anywhere]"
            >
              <LoadingActionContent loading={saving} loadingLabel={savingLabel}>
                {saveLabel}
              </LoadingActionContent>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
