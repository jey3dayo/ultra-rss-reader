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
}: {
  cancelLabel: string;
  submitLabel: string;
  submittingLabel?: string;
  loading?: boolean;
  submitDisabled?: boolean;
  cancelDisabled?: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <Button variant="outline" onClick={onCancel} disabled={cancelDisabled}>
        {cancelLabel}
      </Button>
      <Button onClick={onSubmit} disabled={submitDisabled}>
        {loading && submittingLabel ? submittingLabel : submitLabel}
      </Button>
    </>
  );
}
