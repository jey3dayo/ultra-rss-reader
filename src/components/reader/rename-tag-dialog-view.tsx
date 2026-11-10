import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { EditNameDialogView, type FormDialogShell, TagColorPicker } from "@/design-system";

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
  errorMessage?: string | null;
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
  errorMessage,
  onSubmit,
}: RenameTagDialogViewProps) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");

  return (
    <EditNameDialogView
      open={open}
      modal={modal}
      portalContainer={portalContainer}
      title={t("edit_tag")}
      nameLabel={t("name")}
      inputName="tag-name"
      name={name}
      loading={loading}
      cancelLabel={tc("cancel")}
      submitLabel={tc("save")}
      submittingLabel={tc("saving")}
      errorMessage={errorMessage}
      onOpenChange={onOpenChange}
      onNameChange={onNameChange}
      onSubmit={onSubmit}
    >
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
    </EditNameDialogView>
  );
}
