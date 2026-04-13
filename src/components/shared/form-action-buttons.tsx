import type { FormActionButtonsProps } from "@/components/shared/button.types";
import { Button } from "@/components/ui/button";

export function FormActionButtons({
  cancelLabel,
  submitLabel,
  submittingLabel,
  loading = false,
  submitDisabled = false,
  cancelDisabled = false,
  onCancel,
  onSubmit,
  cancelType = "button",
  submitType = "button",
}: FormActionButtonsProps) {
  return (
    <>
      <Button type={cancelType} variant="outline" onClick={onCancel} disabled={cancelDisabled} className="min-h-11">
        {cancelLabel}
      </Button>
      <Button type={submitType} onClick={onSubmit} disabled={submitDisabled} className="min-h-11">
        {loading && submittingLabel ? submittingLabel : submitLabel}
      </Button>
    </>
  );
}
