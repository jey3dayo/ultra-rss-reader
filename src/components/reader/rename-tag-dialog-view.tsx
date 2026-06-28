import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { FormDialogShell, StackedInputField, TagColorPicker } from "@/design-system";
import { useTagDialogAutofocus } from "./use-tag-dialog-autofocus";

const EMPTY_COLOR_OPTIONS: string[] = [];
const NO_OP_COLOR_CHANGE = () => {};

type RenameTagDialogViewProps = {
  open: boolean;
  modal?: boolean;
  portalContainer?: ComponentProps<typeof FormDialogShell>["portalContainer"];
  name: string;
  color?: string | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onNameChange: (value: string) => void;
  onColorChange?: (value: string | null) => void;
  colorOptions?: string[];
  noColorLabel?: string;
  onSubmit: () => void;
};

export function RenameTagDialogView({
  open,
  modal = true,
  portalContainer,
  name,
  color = null,
  loading,
  onOpenChange,
  onNameChange,
  onColorChange = NO_OP_COLOR_CHANGE,
  colorOptions = EMPTY_COLOR_OPTIONS,
  noColorLabel,
  onSubmit,
}: RenameTagDialogViewProps) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const inputRef = useTagDialogAutofocus(open);

  return (
    <FormDialogShell
      open={open}
      modal={modal}
      portalContainer={portalContainer}
      title={t("edit_tag")}
      cancelLabel={tc("cancel")}
      submitLabel={tc("save")}
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
      {colorOptions.length > 0 && (
        <TagColorPicker
          label={t("color")}
          color={color}
          colorOptions={colorOptions}
          noColorLabel={noColorLabel ?? t("no_color")}
          optionAriaLabel={(option) => `${t("color")} ${option}`}
          density="compact"
          showNoColorOption={false}
          disabled={loading}
          onChange={onColorChange}
        />
      )}
    </FormDialogShell>
  );
}
