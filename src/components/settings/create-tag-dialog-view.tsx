import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { StackedInputField } from "@/components/shared/stacked-input-field";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type CreateTagDialogViewProps = {
  open: boolean;
  name: string;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
};

export function CreateTagDialogView({
  open,
  name,
  loading,
  onOpenChange,
  onNameChange,
  onSubmit,
}: CreateTagDialogViewProps) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("create_tag")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          <StackedInputField
            label={t("name")}
            inputRef={inputRef}
            name="tag-name"
            type="text"
            value={name}
            onChange={onNameChange}
            inputClassName="mt-1"
            disabled={loading}
          />
        </form>
        <DialogFooter>
          <FormActionButtons
            cancelLabel={tc("cancel")}
            submitLabel={t("create_tag")}
            submittingLabel={tc("saving")}
            loading={loading}
            submitDisabled={!name.trim() || loading}
            cancelDisabled={loading}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
