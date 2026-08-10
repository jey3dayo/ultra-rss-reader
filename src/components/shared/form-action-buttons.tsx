import { LoadingActionContent } from "@/components/shared/loading-action-content";
import { Button } from "@/components/ui/button";

type FormActionButtonsProps = {
  cancelLabel: string;
  submitLabel: string;
  submittingLabel?: string;
  loading?: boolean;
  submitDisabled?: boolean;
  cancelDisabled?: boolean;
  onCancel: () => void;
  onSubmit?: () => void;
  cancelType?: "button" | "submit";
  submitType?: "button" | "submit";
};

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
  const submitBlocked = loading || submitDisabled;

  const handleSubmit = () => {
    if (submitBlocked) {
      return;
    }

    onSubmit?.();
  };

  return (
    <div
      data-slot="form-action-buttons"
      className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3"
    >
      <Button
        type={cancelType}
        variant="outline"
        onClick={onCancel}
        disabled={cancelDisabled}
        className="min-h-11 min-w-20 px-4"
      >
        {cancelLabel}
      </Button>
      <Button
        type={submitType}
        onClick={handleSubmit}
        disabled={submitBlocked}
        aria-busy={loading || undefined}
        className="min-h-11 min-w-20 px-4"
      >
        <LoadingActionContent loading={loading} loadingLabel={submittingLabel}>
          {submitLabel}
        </LoadingActionContent>
      </Button>
    </div>
  );
}
