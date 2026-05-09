import { useTranslation } from "react-i18next";
import { FormDialogShell } from "@/components/shared/form-dialog-shell";
import { StackedInputField } from "@/components/shared/stacked-input-field";
import { useTagDialogAutofocus } from "./use-tag-dialog-autofocus";

type CreateTagDialogViewProps = {
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
  const inputRef = useTagDialogAutofocus(open);

  return (
    <FormDialogShell
      open={open}
      title={t("create_tag")}
      cancelLabel={tc("cancel")}
      submitLabel={t("create_tag")}
      submittingLabel={tc("saving")}
      loading={loading}
      submitDisabled={!name.trim() || loading}
      cancelDisabled={loading}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
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
    </FormDialogShell>
  );
}
